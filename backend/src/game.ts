import type { Server } from 'socket.io';
import type { DatabaseSync } from 'node:sqlite';
import type { EstadoJogo, Fase, Jogador, LinhaPlacar } from './types.js';
import { criarBanco } from './seed.js';
import { CENARIOS, CENARIO_POR_ID } from './scenarios.js';
import { bonusPrimeira, bonusRapidez, custoDica } from './scoring.js';

export class Jogo {
  private io: Server;
  private jogadores = new Map<string, Jogador>();
  private fase: Fase = 'lobby';
  private inicio = 0;
  private fim = 0;
  private duracaoSeg = 20 * 60;
  private primeiraDe = new Set<number>();
  private cron: NodeJS.Timeout | null = null;

  constructor(io: Server) {
    this.io = io;
  }

  // ---------------------------------------------------------------- jogadores
  entrar(id: string, nome: string): { ok: boolean; erro?: string } {
    const limpo = nome.trim().slice(0, 24);
    if (!limpo) return { ok: false, erro: 'Escolha um nome.' };
    // nome único (ignorando maiúsculas/minúsculas), entre os outros jogadores
    const emUso = [...this.jogadores.values()].some(
      (j) => j.id !== id && j.nome.toLowerCase() === limpo.toLowerCase()
    );
    if (emUso) return { ok: false, erro: 'Esse nome já está em uso.' };

    const existente = this.jogadores.get(id);
    if (existente) {
      existente.nome = limpo;
    } else {
      this.jogadores.set(id, {
        id, nome: limpo, pontos: 0, solves: new Map(), dicas: new Set(), bancos: new Map(),
      });
    }
    this.transmitir();
    return { ok: true };
  }

  // Remove o jogador de vez (não é chamado numa simples queda de conexão: ver
  // socketToken em index.ts, que trata reconexão/F5 sem apagar pontos nem bancos).
  sair(id: string): void {
    const j = this.jogadores.get(id);
    if (!j) return;
    this.fecharBancos(j);
    this.jogadores.delete(id);
    this.transmitir();
  }

  jogador(id: string): Jogador | undefined {
    return this.jogadores.get(id);
  }

  /** SGBD isolado do jogador para um cenário (criado sob demanda). */
  banco(jogador: Jogador, cenarioId: number): DatabaseSync {
    let db = jogador.bancos.get(cenarioId);
    if (!db) {
      db = criarBanco();
      jogador.bancos.set(cenarioId, db);
    }
    return db;
  }

  /** Recria o SGBD de um cenário (botão "resetar ambiente"). */
  resetarBanco(jogador: Jogador, cenarioId: number): void {
    const antigo = jogador.bancos.get(cenarioId);
    if (antigo) {
      try {
        antigo.close();
      } catch {
        /* ignore */
      }
    }
    jogador.bancos.set(cenarioId, criarBanco());
  }

  private fecharBancos(j: Jogador): void {
    for (const db of j.bancos.values()) {
      try {
        db.close();
      } catch {
        /* ignore */
      }
    }
    j.bancos.clear();
  }

  // ---------------------------------------------------------------- pontuação
  rodando(): boolean {
    return this.fase === 'running';
  }

  /** Credita um cenário recém-resolvido. Devolve os pontos, ou null se nada mudou. */
  creditar(jogador: Jogador, cenarioId: number): { id: number; nome: string; pontos: number } | null {
    if (!this.rodando() || jogador.solves.has(cenarioId)) return null;
    const c = CENARIO_POR_ID.get(cenarioId);
    if (!c) return null;
    const agora = Date.now();
    let pontos = c.base + bonusRapidez(c.base, agora, this.inicio, this.fim);
    if (!this.primeiraDe.has(cenarioId)) {
      pontos += bonusPrimeira(c.base);
      this.primeiraDe.add(cenarioId);
    }
    jogador.solves.set(cenarioId, { cenarioId, at: agora, pontos });
    jogador.pontos += pontos;
    this.transmitir();
    return { id: cenarioId, nome: c.nome, pontos };
  }

  /** Revela a dica de um cenário, descontando o custo. Devolve o texto. */
  revelarDica(jogador: Jogador, cenarioId: number): string | null {
    if (!this.rodando()) return null; // dicas bloqueadas fora da partida
    const c = CENARIO_POR_ID.get(cenarioId);
    if (!c) return null;
    if (!jogador.dicas.has(cenarioId) && !jogador.solves.has(cenarioId)) {
      jogador.dicas.add(cenarioId);
      jogador.pontos -= custoDica(c.base); // pode ficar negativo
      this.transmitir();
    }
    return c.dica;
  }

  // ---------------------------------------------------------------- estado
  private limpar(): void {
    this.primeiraDe.clear();
    for (const j of this.jogadores.values()) {
      j.pontos = 0;
      j.solves.clear();
      j.dicas.clear();
      this.fecharBancos(j);
    }
  }

  iniciar(duracaoSeg: number): void {
    this.limpar();
    // mínimo 1 min; teto generoso (4 h) só para evitar valores absurdos
    this.duracaoSeg = Math.max(60, Math.min(14400, Math.round(duracaoSeg) || this.duracaoSeg));
    this.inicio = Date.now();
    this.fim = this.inicio + this.duracaoSeg * 1000;
    this.fase = 'running';
    if (this.cron) clearInterval(this.cron);
    this.cron = setInterval(() => this.tick(), 1000);
    this.transmitir();
  }

  encerrar(): void {
    this.fase = 'ended';
    if (this.cron) {
      clearInterval(this.cron);
      this.cron = null;
    }
    this.transmitir();
  }

  resetar(): void {
    if (this.cron) {
      clearInterval(this.cron);
      this.cron = null;
    }
    this.limpar();
    this.fase = 'lobby';
    this.inicio = 0;
    this.fim = 0;
    this.transmitir();
  }

  private tick(): void {
    if (this.fase !== 'running') return;
    if (Date.now() >= this.fim) {
      this.encerrar();
      return;
    }
    const r = this.restanteSeg();
    this.io.emit('timer', r);
    this.io.of('/admin').emit('timer', r);
  }

  private restanteSeg(): number {
    if (this.fase === 'lobby') return this.duracaoSeg;
    return Math.max(0, Math.round((this.fim - Date.now()) / 1000));
  }

  estado(): EstadoJogo {
    return {
      fase: this.fase,
      totalCenarios: CENARIOS.length,
      duracaoSeg: this.duracaoSeg,
      restanteSeg: this.restanteSeg(),
    };
  }

  placar(): LinhaPlacar[] {
    const linhas: LinhaPlacar[] = [];
    for (const j of this.jogadores.values()) {
      const solves = [...j.solves.values()].map((s) => ({
        cenarioId: s.cenarioId,
        minuto: this.inicio ? Math.floor((s.at - this.inicio) / 60000) : 0,
      }));
      linhas.push({ id: j.id, nome: j.nome, pontos: j.pontos, solves });
    }
    const ultimo = (j: LinhaPlacar) => (j.solves.length ? Math.max(...j.solves.map((s) => s.minuto)) : Infinity);
    linhas.sort((a, b) => b.pontos - a.pontos || ultimo(a) - ultimo(b));
    return linhas;
  }

  transmitir(): void {
    const estado = this.estado();
    const placar = this.placar();
    this.io.emit('estado', estado);
    this.io.emit('placar', placar);
    this.io.of('/admin').emit('estado', estado);
    this.io.of('/admin').emit('placar', placar);
  }
}
