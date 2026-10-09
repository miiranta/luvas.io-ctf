import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SocketService } from '../socket.service';
import type { CenarioPublico, Pagina, RespostaAcao, Resolvido } from '../modelos';

@Component({
  selector: 'app-jogo',
  imports: [FormsModule],
  templateUrl: './jogo.html',
  styleUrl: './jogo.css',
})
export class Jogo {
  private sock = inject(SocketService);

  estado = this.sock.estado;
  config = this.sock.config;
  placar = this.sock.placar;
  restante = this.sock.restante;
  nome = this.sock.meuNome;

  aba = signal<'cenarios' | 'placar'>('cenarios');
  aberto = signal<CenarioPublico | null>(null);
  pagina = signal<Pagina | null>(null);

  // entradas dos ambientes (um cenário aberto por vez)
  loginUser = signal('');
  loginSenha = signal('');
  buscaNome = signal('');
  statsAgg = signal('COUNT(*)');
  statsOnde = signal('');
  relOrdem = signal('');
  hashEntrada = signal('');
  hashResultado = signal('');

  resultado = signal<RespostaAcao | null>(null);
  carregando = signal(false);
  resposta = signal('');
  respostaMsg = signal<'' | 'certo' | 'errado'>('');
  dicas = signal<Record<number, string>>({});
  detalhesGanhos = signal<Record<number, Resolvido>>({});
  toasts = signal<{ texto: string; pontos: number }[]>([]);
  private vistos = 0;

  constructor() {
    effect(() => {
      const feed = this.sock.feed();
      for (; this.vistos < feed.length; this.vistos++) {
        const r = feed[this.vistos];
        this.detalhesGanhos.update((p) => ({ ...p, [r.id]: r }));
        const t = { texto: r.nome, pontos: r.pontos };
        this.toasts.update((a) => [...a, t]);
        setTimeout(() => this.toasts.update((a) => a.filter((x) => x !== t)), 4000);
      }
    });
  }

  minhaLinha = computed(() => this.placar().find((l) => l.id === this.sock.id));
  meusPontos = computed(() => this.minhaLinha()?.pontos ?? 0);
  resolvidos = computed(() => new Set((this.minhaLinha()?.solves ?? []).map((s) => s.cenarioId)));
  encontradas = computed(() => this.resolvidos().size);
  rodando = computed(() => this.estado()?.fase === 'running');
  terminou = computed(() => this.estado()?.fase === 'ended');
  mmss = computed(() => {
    const s = this.restante();
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  });

  sockId(): string | undefined {
    return this.sock.id;
  }
  codigoTexto(linhas?: string[]): string {
    return (linhas ?? []).join('\n');
  }
  resolvido(c: CenarioPublico): boolean {
    return this.resolvidos().has(c.id);
  }
  pontosDe(id: number): number | null {
    return this.detalhesGanhos()[id]?.base ?? null;
  }
  bonusRapidezDe(id: number): number {
    return this.detalhesGanhos()[id]?.bonusRapidez ?? 0;
  }
  bonusPrimeiraDe(id: number): number {
    return this.detalhesGanhos()[id]?.bonusPrimeira ?? 0;
  }
  custoDica(base: number): number {
    return Math.round(base * 0.3);
  }

  // Páginas 'meta' (avisos ao jogador, fora da ficção do cenário) vêm primeiro na lista.
  paginasDe(c: CenarioPublico): Pagina[] {
    return [...c.paginas].sort((a, b) => Number(!!b.meta) - Number(!!a.meta));
  }

  abrir(c: CenarioPublico): void {
    if (!this.rodando()) return; // cenários bloqueados fora da partida
    this.aberto.set(c);
    this.pagina.set(this.paginasDe(c)[0] ?? null);
    this.resultado.set(null);
    this.resposta.set('');
    this.respostaMsg.set('');
    this.loginUser.set('');
    this.loginSenha.set('');
    this.buscaNome.set('');
    this.statsAgg.set('COUNT(*)');
    this.statsOnde.set('');
    this.relOrdem.set('');
    this.hashEntrada.set('');
    this.hashResultado.set('');
  }
  voltar(): void {
    this.aberto.set(null);
    this.pagina.set(null);
  }
  irPara(p: Pagina): void {
    this.pagina.set(p);
  }

  private entradas(c: CenarioPublico): Record<string, string> {
    switch (c.kind) {
      case 'login':
        return { usuario: this.loginUser(), senha: this.loginSenha() };
      case 'busca':
        return { nome: this.buscaNome() };
      case 'stats':
        return { agregado: this.statsAgg(), onde: this.statsOnde() };
      case 'relatorio':
        return { ordem: this.relOrdem() };
    }
  }

  async rodar(): Promise<void> {
    const c = this.aberto();
    if (!c) return;
    this.carregando.set(true);
    try {
      this.resultado.set(await this.sock.acao(c.id, this.entradas(c)));
    } finally {
      this.carregando.set(false);
    }
  }

  async responder(): Promise<void> {
    const c = this.aberto();
    if (!c) return;
    const r = await this.sock.responder(c.id, this.resposta());
    this.respostaMsg.set(r.certo ? 'certo' : 'errado');
  }

  async pedirDica(): Promise<void> {
    const c = this.aberto();
    if (!c) return;
    const r = await this.sock.dica(c.id);
    if (r.dica) this.dicas.update((d) => ({ ...d, [c.id]: r.dica! }));
  }

  async resetarAmbiente(): Promise<void> {
    const c = this.aberto();
    if (!c) return;
    await this.sock.resetarAmbiente(c.id);
    this.resultado.set(null);
  }

  async calcularHash(): Promise<void> {
    const r = await this.sock.hash(this.hashEntrada());
    this.hashResultado.set(r.md5);
  }
}
