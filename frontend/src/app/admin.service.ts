import { Injectable, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import type { Config, Estado, LinhaPlacar } from './modelos';
import { urlBackend } from './socket.service';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private socket: Socket = io(`${urlBackend()}/admin`, { transports: ['websocket', 'polling'] });

  estado = signal<Estado | null>(null);
  placar = signal<LinhaPlacar[]>([]);
  config = signal<Config | null>(null);
  restante = signal<number>(0);
  autenticado = signal<boolean>(false);
  private chave = '';

  constructor() {
    this.socket.on('estado', (e: Estado) => {
      this.estado.set(e);
      this.restante.set(e.restanteSeg);
    });
    this.socket.on('placar', (p: LinhaPlacar[]) => this.placar.set(p));
    this.socket.on('config', (c: Config) => this.config.set(c));
    this.socket.on('timer', (s: number) => this.restante.set(s));
    // Se a conexão cair e voltar, reautentica sozinho para os botões seguirem valendo.
    this.socket.on('connect', () => {
      if (this.chave) this.socket.emit('auth', { chave: this.chave });
    });
  }

  async auth(chave: string): Promise<boolean> {
    const r = await this.socket.emitWithAck('auth', { chave });
    const ok = !!r?.ok;
    this.autenticado.set(ok);
    if (ok) this.chave = chave;
    return ok;
  }
  iniciar(duracaoSeg: number): void {
    this.socket.emit('start', { duracaoSeg });
  }
  encerrar(): void {
    this.socket.emit('stop');
  }
  resetar(): void {
    this.socket.emit('reset');
  }
}
