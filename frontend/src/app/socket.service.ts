import { Injectable, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import type { Config, Estado, LinhaPlacar, RespostaAcao, Resolvido } from './modelos';

export function urlBackend(): string {
  // Em "ng serve" (porta 4200) o backend está na 3000; em produção é a mesma origem.
  return location.port === '4200' ? `http://${location.hostname}:3000` : location.origin;
}

const CHAVE_TOKEN = 'jogo_token';
const CHAVE_NOME = 'jogo_nome';

function idAleatorio(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}

// Identidade do jogador: um token salvo no celular, não a conexão do socket. Assim,
// perder o wifi ou recarregar a página (comum em celular) não zera a pontuação: ao
// reconectar, o servidor reconhece o mesmo token e devolve o jogador de onde parou.
// localStorage pode falhar (aba anônima, navegador bloqueando) — nunca deixa a página quebrar.
function carregarToken(): string {
  try {
    const existente = localStorage.getItem(CHAVE_TOKEN);
    if (existente) return existente;
    const novo = idAleatorio();
    localStorage.setItem(CHAVE_TOKEN, novo);
    return novo;
  } catch {
    return idAleatorio(); // sem persistência nesta aba; ainda funciona, só não sobrevive a um F5
  }
}
function nomeSalvo(): string {
  try {
    return localStorage.getItem(CHAVE_NOME) ?? '';
  } catch {
    return '';
  }
}
function salvarNome(nome: string): void {
  try {
    localStorage.setItem(CHAVE_NOME, nome);
  } catch {
    /* sem persistência disponível; segue o jogo normalmente */
  }
}

@Injectable({ providedIn: 'root' })
export class SocketService {
  private socket: Socket = io(urlBackend(), { transports: ['websocket', 'polling'] });
  private readonly token = carregarToken();

  estado = signal<Estado | null>(null);
  placar = signal<LinhaPlacar[]>([]);
  config = signal<Config | null>(null);
  restante = signal<number>(0);
  entrou = signal<boolean>(false);
  meuNome = signal<string>('');
  feed = signal<Resolvido[]>([]);

  constructor() {
    this.socket.on('estado', (e: Estado) => {
      this.estado.set(e);
      this.restante.set(e.restanteSeg);
    });
    this.socket.on('placar', (p: LinhaPlacar[]) => this.placar.set(p));
    this.socket.on('config', (c: Config) => this.config.set(c));
    this.socket.on('timer', (s: number) => this.restante.set(s));
    this.socket.on('resolvido', (r: Resolvido) => this.feed.update((a) => [...a, r]));
    // Reconectou (wifi caiu e voltou, app saiu de segundo plano): reentra com o mesmo
    // token, retomando pontos e progresso sem o jogador precisar fazer nada.
    this.socket.on('connect', () => {
      if (this.entrou() && this.meuNome()) this.socket.emit('entrar', { nome: this.meuNome(), token: this.token });
    });
  }

  /** Identidade estável do jogador (sobrevive a reconexões), para destacar "eu" no placar. */
  get id(): string {
    return this.token;
  }

  /** Nome salvo de uma visita anterior, para a tela de entrada reentrar sozinha após um F5. */
  nomeSalvo(): string {
    return nomeSalvo();
  }

  async entrar(nome: string): Promise<{ ok: boolean; erro?: string }> {
    const r = await this.socket.emitWithAck('entrar', { nome, token: this.token });
    if (!r?.ok) return { ok: false, erro: r?.erro ?? 'Não foi possível entrar.' };
    this.entrou.set(true);
    this.meuNome.set(r.nome ?? nome);
    salvarNome(r.nome ?? nome);
    if (r.config) this.config.set(r.config);
    return { ok: true };
  }

  acao(cenarioId: number, entradas: Record<string, string>): Promise<RespostaAcao> {
    return this.socket.emitWithAck('acao', { cenarioId, entradas });
  }
  responder(cenarioId: number, valor: string): Promise<{ certo: boolean; resolvido: Resolvido | null }> {
    return this.socket.emitWithAck('responder', { cenarioId, valor });
  }
  dica(cenarioId: number): Promise<{ dica: string | null }> {
    return this.socket.emitWithAck('dica', { cenarioId });
  }
  resetarAmbiente(cenarioId: number): Promise<{ ok: boolean }> {
    return this.socket.emitWithAck('resetar-ambiente', { cenarioId });
  }
  hash(texto: string): Promise<{ md5: string }> {
    return this.socket.emitWithAck('hash', { texto });
  }
}
