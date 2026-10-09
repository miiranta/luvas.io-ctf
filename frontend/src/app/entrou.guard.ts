import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SocketService } from './socket.service';

// Sem ter entrado com um nome, /jogo volta para a tela de entrada.
export const entrouGuard: CanActivateFn = () => {
  const sock = inject(SocketService);
  const router = inject(Router);
  return sock.entrou() ? true : router.createUrlTree(['/']);
};
