import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SocketService } from '../socket.service';

@Component({
  selector: 'app-entrar',
  imports: [FormsModule],
  template: `
    <div class="wrap">
      @if (reconectando()) {
        <div class="card painel">
          <div class="marca"><i class="fa-solid fa-shield-halved"></i> MC536 - Segurança de BD</div>
          <p class="sub reconectando-msg">Reconectando como <strong>{{ nome() }}</strong>...</p>
        </div>
      } @else {
        <div class="card painel">
          <div class="marca"><i class="fa-solid fa-shield-halved"></i> MC536 - Segurança de BD</div>
          <h1>Caça às vulnerabilidades</h1>
          <p class="sub">Escolha um cenário, entre no ambiente e replique a falha. Quanto mais cedo, mais pontos.</p>

          <label for="nome">Seu nome no placar</label>
          <input id="nome" [(ngModel)]="nome" (keyup.enter)="entrar()" placeholder="ex.: Bobby Tables"
                 maxlength="24" autocomplete="off" autocapitalize="words" />

          @if (erro()) { <div class="err">{{ erro() }}</div> }

          <button class="block" [disabled]="!nome().trim() || entrando()" (click)="entrar()">
            {{ entrando() ? 'Entrando...' : 'Entrar' }}
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .wrap { min-height: 100dvh; display: grid; place-items: center; padding: 20px;
      background: radial-gradient(900px 500px at 50% -10%, #cdeedd, var(--cinza-claro)); }
    .painel { width: 100%; max-width: 420px; text-align: center; padding: 28px 22px; }
    .marca { font-size: 12px; font-weight: 700; color: var(--verde-escuro); letter-spacing: 0.04em; text-transform: uppercase; }
    h1 { margin: 8px 0 6px; font-size: 26px; }
    .sub { color: var(--cinza); margin: 0 0 22px; font-size: 15px; }
    .reconectando-msg { margin: 4px 0 0; }
    label { display: block; text-align: left; font-weight: 600; margin-bottom: 6px; font-size: 14px; }
    input { margin-bottom: 16px; text-align: center; font-size: 18px; }
    button { font-size: 17px; padding: 14px; }
    .err { color: var(--vermelho); font-size: 14px; margin-bottom: 14px; font-weight: 600; }
  `],
})
export class Entrar {
  private sock = inject(SocketService);
  private router = inject(Router);
  nome = signal('');
  entrando = signal(false);
  erro = signal('');
  reconectando = signal(false);

  constructor() {
    // Reabriu o app (F5, voltou do segundo plano) e já tinha entrado antes: reentra
    // sozinho com o mesmo nome, sem o aluno digitar de novo. O token do navegador garante
    // que o servidor devolve a MESMA pontuação; se o nome não existir mais, cai no formulário.
    const salvo = this.sock.nomeSalvo();
    if (salvo) {
      this.nome.set(salvo);
      this.reconectando.set(true);
      this.entrar().finally(() => this.reconectando.set(false));
    }
  }

  async entrar(): Promise<void> {
    if (!this.nome().trim()) return;
    this.entrando.set(true);
    this.erro.set('');
    try {
      const r = await this.sock.entrar(this.nome().trim());
      if (r.ok) this.router.navigate(['/jogo']);
      else this.erro.set(r.erro ?? 'Não foi possível entrar.');
    } finally {
      this.entrando.set(false);
    }
  }
}
