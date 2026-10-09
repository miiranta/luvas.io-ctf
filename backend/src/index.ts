import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import express from 'express';
import { Server } from 'socket.io';

import { Jogo } from './game.js';
import { executar } from './engine.js';
import { CENARIO_POR_ID, CENARIOS_PUBLICOS } from './scenarios.js';
import { md5 } from './seed.js';
import type { RespostaAcao, ResultadoSQL } from './types.js';

const PORT = Number(process.env.PORT) || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || 'lucas123miranda';

const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
const jogo = new Jogo(io);

const config = { total: CENARIOS_PUBLICOS.length, cenarios: CENARIOS_PUBLICOS };
const erroSQL = (msg: string): ResultadoSQL => ({ sql: '', colunas: [], linhas: [], erro: msg });

// A identidade do jogador é um token que o celular guarda (localStorage), não a conexão
// do socket. Assim, uma queda de wifi ou um F5 no meio da partida reconecta na MESMA
// pontuação, em vez de criar um jogador zerado. socketToken mapeia a conexão atual -> token.
const socketToken = new Map<string, string>();
function jogadorDe(socketId: string) {
  const token = socketToken.get(socketId);
  return token ? jogo.jogador(token) : undefined;
}

// ---------------------------------------------------------------- jogadores
io.on('connection', (socket) => {
  socket.emit('estado', jogo.estado());
  socket.emit('placar', jogo.placar());
  socket.emit('config', config);

  socket.on('entrar', (d: { nome?: string; token?: string }, cb?: (r: unknown) => void) => {
    // Sem token (cliente antigo/teste), cada conexão vira um jogador novo, como antes.
    const token = String(d?.token ?? '').slice(0, 64) || socket.id;
    const r = jogo.entrar(token, String(d?.nome ?? ''));
    if (!r.ok) return cb?.({ ok: false, erro: r.erro });
    socketToken.set(socket.id, token);
    const j = jogo.jogador(token)!;
    cb?.({ ok: true, id: j.id, nome: j.nome, config, estado: jogo.estado() });
  });

  // Roda a consulta de um cenário. Para cenários 'auto', já detecta e credita.
  socket.on(
    'acao',
    (d: { cenarioId?: number; entradas?: Record<string, string> }, cb?: (r: RespostaAcao) => void) => {
      const j = jogadorDe(socket.id);
      const c = CENARIO_POR_ID.get(Number(d?.cenarioId));
      if (!j || !c) return cb?.({ ...erroSQL('Cenário inválido ou jogador não registrado.'), resolvido: null });
      if (!jogo.rodando()) return cb?.({ ...erroSQL('A partida não está em andamento.'), resolvido: null });
      const entradas = (d?.entradas ?? {}) as Record<string, string>;
      const res = executar(jogo.banco(j, c.id), c, entradas);
      // Só o cenário tutorial mostra a consulta montada; nos demais ela fica oculta.
      if (!c.revelaSQL) res.sql = '';
      let resolvido: RespostaAcao['resolvido'] = null;
      if (c.tipo === 'auto' && c.conferir && c.conferir(res, entradas)) {
        resolvido = jogo.creditar(j, c.id);
      }
      if (resolvido) socket.emit('resolvido', resolvido);
      cb?.({ ...res, resolvido });
    }
  );

  // Envia a resposta de um cenário 'resposta' (dedução / senha quebrada).
  socket.on(
    'responder',
    (d: { cenarioId?: number; valor?: string }, cb?: (r: { certo: boolean; resolvido: RespostaAcao['resolvido'] }) => void) => {
      const j = jogadorDe(socket.id);
      const c = CENARIO_POR_ID.get(Number(d?.cenarioId));
      if (!j || !c || c.tipo !== 'resposta' || !c.conferirResposta) return cb?.({ certo: false, resolvido: null });
      if (!jogo.rodando()) return cb?.({ certo: false, resolvido: null });
      const certo = c.conferirResposta(String(d?.valor ?? ''));
      const resolvido = certo ? jogo.creditar(j, c.id) : null;
      if (resolvido) socket.emit('resolvido', resolvido);
      cb?.({ certo, resolvido });
    }
  );

  socket.on('dica', (d: { cenarioId?: number }, cb?: (r: { dica: string | null }) => void) => {
    const j = jogadorDe(socket.id);
    if (!j) return cb?.({ dica: null });
    cb?.({ dica: jogo.revelarDica(j, Number(d?.cenarioId)) });
  });

  // Ferramenta de hash MD5 (offline, sem internet): usada para testar candidatos de
  // senha contra um hash vazado. Não depende de cenário nem de partida em andamento.
  socket.on('hash', (d: { texto?: string }, cb?: (r: { md5: string }) => void) => {
    const j = jogadorDe(socket.id);
    if (!j) return cb?.({ md5: '' });
    cb?.({ md5: md5(String(d?.texto ?? '').slice(0, 200)) });
  });

  socket.on('resetar-ambiente', (d: { cenarioId?: number }, cb?: (r: { ok: boolean }) => void) => {
    const j = jogadorDe(socket.id);
    if (j) jogo.resetarBanco(j, Number(d?.cenarioId));
    cb?.({ ok: true });
  });

  // Só esquece QUAL conexão é essa pessoa. O jogador (pontos, soluções, bancos de cada
  // cenário) continua existindo no servidor; se o token voltar, retoma de onde parou.
  socket.on('disconnect', () => socketToken.delete(socket.id));
});

// ---------------------------------------------------------------- admin
io.of('/admin').on('connection', (socket) => {
  let autenticado = false;

  socket.on('auth', (d: { chave?: string }, cb?: (r: { ok: boolean }) => void) => {
    autenticado = String(d?.chave ?? '') === ADMIN_KEY;
    cb?.({ ok: autenticado });
    if (autenticado) {
      socket.emit('estado', jogo.estado());
      socket.emit('placar', jogo.placar());
      socket.emit('config', config);
    }
  });

  socket.on('start', (d: { duracaoSeg?: number }) => {
    if (autenticado) jogo.iniciar(Number(d?.duracaoSeg) || 20 * 60);
  });
  socket.on('stop', () => {
    if (autenticado) jogo.encerrar();
  });
  socket.on('reset', () => {
    if (autenticado) jogo.resetar();
  });
});

// ---------------------------------------------------------------- estáticos (frontend)
const aqui = dirname(fileURLToPath(import.meta.url));
const candidatos = [
  process.env.STATIC_DIR,
  join(aqui, '../public'),
  join(aqui, '../../frontend/dist/frontend/browser'),
].filter(Boolean) as string[];
const estaticos = candidatos.find((c) => existsSync(c));
if (estaticos) {
  app.use(express.static(estaticos));
  app.get('*', (_req, res) => res.sendFile(join(estaticos, 'index.html')));
  console.log(`[estáticos] servindo ${estaticos}`);
} else {
  app.get('/', (_req, res) => res.send('Backend no ar. Compile o frontend ou rode-o com "ng serve".'));
}

server.listen(PORT, () => {
  console.log(`Jogo de Segurança no ar: http://localhost:${PORT}  (admin key: "${ADMIN_KEY}")`);
});
