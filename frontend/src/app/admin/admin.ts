import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../admin.service';
import type { LinhaPlacar } from '../modelos';

@Component({
  selector: 'app-admin',
  imports: [FormsModule],
  templateUrl: './admin.html',
  styleUrl: './admin.css',
})
export class Admin {
  private adm = inject(AdminService);

  estado = this.adm.estado;
  placar = this.adm.placar;
  config = this.adm.config;
  restante = this.adm.restante;
  autenticado = this.adm.autenticado;

  chave = signal('');
  erro = signal(false);
  duracaoMin = signal(20);

  fase = computed(() => this.estado()?.fase ?? 'lobby');
  cenarios = computed(() => this.config()?.cenarios ?? []);
  mmss = computed(() => {
    const s = this.restante();
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  });

  async entrar() {
    this.erro.set(!(await this.adm.auth(this.chave().trim())));
  }
  iniciar() {
    if (this.fase() !== 'lobby' && !confirm('Isso zera o placar e começa uma nova partida. Continuar?')) return;
    this.adm.iniciar(this.duracaoMin() * 60);
  }
  encerrar() {
    this.adm.encerrar();
  }
  resetar() {
    if (confirm('Zerar o placar e voltar ao lobby?')) this.adm.resetar();
  }

  minutoDe(l: LinhaPlacar, cenarioId: number): number | null {
    return l.solves.find((x) => x.cenarioId === cenarioId)?.minuto ?? null;
  }
}
