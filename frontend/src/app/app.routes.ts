import { Routes } from '@angular/router';
import { Entrar } from './entrar/entrar';
import { Jogo } from './jogo/jogo';
import { Admin } from './admin/admin';
import { entrouGuard } from './entrou.guard';

export const routes: Routes = [
  { path: '', component: Entrar },
  { path: 'jogo', component: Jogo, canActivate: [entrouGuard] },
  { path: 'admin', component: Admin },
  { path: '**', redirectTo: '' },
];
