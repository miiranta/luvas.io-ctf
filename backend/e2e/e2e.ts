/**
 * Teste end-to-end: sobe o servidor de verdade e exercita, por Socket.IO, TODAS as funções
 * (entrar, ação por cenário, resposta, dica, resetar ambiente, admin) e CADA um dos 8 cenários
 * (as 8 vulnerabilidades), além de pontuação, first-blood, dica paga e placar.
 *
 * Rodar: npm run test:e2e
 */
import { io, Socket } from 'socket.io-client';

const PORT = 3999;
process.env.PORT = String(PORT);
process.env.ADMIN_KEY = 'testkey';

const URL = `http://localhost:${PORT}`;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

let falhas = 0;
function ok(nome: string, cond: boolean) {
  console.log(`${cond ? '✓' : '✗ FALHOU'} ${nome}`);
  if (!cond) falhas++;
}

interface Resolvido { id: number; nome: string; pontos: number }
interface RespAcao { erro: string | null; linhas: Record<string, unknown>[]; resolvido: Resolvido | null }
interface Linha { id: string; nome: string; pontos: number; solves: { cenarioId: number; minuto: number }[] }

class Cliente {
  sock: Socket;
  placar: Linha[] = [];
  estado: { fase: string } | null = null;
  // Identidade do JOGADOR no placar (agora um token, não mais o socket.id — ver
  // socketToken em index.ts). Por padrão igual ao socket.id, que é o que o servidor usa
  // de fallback quando o cliente não manda um token explícito no 'entrar'.
  idExplicito?: string;
  constructor(ns = '') {
    this.sock = io(URL + ns, { transports: ['websocket'], forceNew: true });
    this.sock.on('placar', (p: Linha[]) => (this.placar = p));
    this.sock.on('estado', (e: { fase: string }) => (this.estado = e));
  }
  conectar(): Promise<void> {
    return new Promise((res) => (this.sock.connected ? res() : this.sock.on('connect', () => res())));
  }
  emit<T = any>(ev: string, data?: unknown): Promise<T> {
    return this.sock.emitWithAck(ev, data);
  }
  acao(cenarioId: number, entradas: Record<string, string>) {
    return this.emit<RespAcao>('acao', { cenarioId, entradas });
  }
  linha(): Linha | undefined {
    const meuId = this.idExplicito ?? this.sock.id;
    return this.placar.find((l) => l.id === meuId);
  }
  pontos(): number {
    return this.linha()?.pontos ?? 0;
  }
  solves(): number {
    return this.linha()?.solves.length ?? 0;
  }
}

async function main() {
  await import('../src/index.js');
  await wait(400);

  // ---- admin ----
  const admin = new Cliente('/admin');
  await admin.conectar();
  ok('admin rejeita chave errada', (await admin.emit<{ ok: boolean }>('auth', { chave: 'x' })).ok === false);
  ok('admin aceita chave certa', (await admin.emit<{ ok: boolean }>('auth', { chave: 'testkey' })).ok === true);

  // ---- jogador entra antes de iniciar ----
  const p1 = new Cliente();
  await p1.conectar();
  await p1.emit('entrar', { nome: 'P1' });
  let r = await p1.acao(1, { usuario: "admin'--", senha: 'x' });
  ok('cenário bloqueado no lobby', r.resolvido === null && r.erro !== null);
  const dicaLobby = await p1.emit<{ dica: string | null }>('dica', { cenarioId: 1 });
  ok('dica bloqueada no lobby', dicaLobby.dica === null);

  // ---- iniciar ----
  admin.sock.emit('start', { duracaoSeg: 600 });
  await wait(200);
  ok('estado vira running', p1.estado?.fase === 'running');

  // ---- C1 Sésamo (login bypass) ----
  r = await p1.acao(1, { usuario: "admin'--", senha: 'x' });
  ok('C1 login bypass resolve', r.resolvido?.id === 1);
  const p1C1 = r.resolvido!.pontos;
  r = await p1.acao(1, { usuario: "admin'--", senha: 'x' });
  ok('C1 não resolve duas vezes', r.resolvido === null);

  // ---- C2 departamento vizinho ----
  r = await p1.acao(2, { nome: "' OR 1=1--" });
  ok('C2 linhas fora da view', r.resolvido?.id === 2);

  // ---- C3 cofre ----
  r = await p1.acao(3, { nome: "x' UNION SELECT chave, valor FROM segredos--" });
  ok('C3 abre o cofre', r.resolvido?.id === 3);

  // ---- C4 fora da vista ----
  r = await p1.acao(4, { nome: "x' UNION SELECT nome, salario FROM funcionario--" });
  ok('C4 vaza salário', r.resolvido?.id === 4);

  // ---- C5 a média de um (estatístico) ----
  r = await p1.acao(5, { agregado: 'nome', onde: '1=1' });
  ok('C5 rejeita coluna crua', r.erro !== null);
  r = await p1.acao(5, { agregado: 'COUNT(*)', onde: "escolaridade='Ph.D.' AND sexo='F' AND cidade='Curitiba'" });
  ok('C5 COUNT=1', Number(r.linhas[0]?.['resultado']) === 1);
  r = await p1.acao(5, { agregado: 'AVG(renda)', onde: "escolaridade='Ph.D.' AND sexo='F' AND cidade='Curitiba'" });
  const renda = String(r.linhas[0]?.['resultado']);
  let rr = await p1.emit<{ certo: boolean; resolvido: Resolvido | null }>('responder', { cenarioId: 5, valor: renda });
  ok('C5 dedução resolve', rr.certo && rr.resolvido?.id === 5);

  // ---- C6 elo fraco (senha) ----
  r = await p1.acao(6, { nome: "x' UNION SELECT login, senha_hash FROM usuarios--" });
  ok('C6 hash vaza pela busca', r.linhas.some((l) => String(l['depto']).length === 32));
  rr = await p1.emit('responder', { cenarioId: 6, valor: 'errada' });
  ok('C6 resposta errada não resolve', rr.certo === false && rr.resolvido === null);
  rr = await p1.emit('responder', { cenarioId: 6, valor: '123456' });
  ok('C6 senha quebrada resolve', rr.certo && rr.resolvido?.id === 6);

  // ---- C7 confidencial ----
  r = await p1.acao(7, { nome: "x' UNION SELECT nome, desempenho FROM funcionario--" });
  ok('C7 lê linha classificada', r.resolvido?.id === 7);
  r = await p1.acao(7, { nome: 'Edu Sá' });
  ok('C7 tela normal esconde classe S', r.resolvido === null);

  // ---- C8 ordem dos fatores ----
  r = await p1.acao(8, { ordem: '2' });
  ok('C8 injeta no ORDER BY', r.resolvido?.id === 8);
  r = await p1.acao(8, { ordem: 'nome' });
  ok('C8 ORDER BY legítimo não resolve', r.resolvido === null);

  await wait(120);
  ok('P1 resolveu os 8 cenários', p1.solves() === 8);
  ok('P1 tem pontos > 0', p1.pontos() > 0);

  // ---- resetar ambiente ----
  const reset = await p1.emit<{ ok: boolean }>('resetar-ambiente', { cenarioId: 2 });
  ok('resetar ambiente responde ok', reset.ok === true);

  // ---- identidade persistente: F5 / wifi caindo no celular não pode zerar a pontuação ----
  // É exatamente o que um recarregar de página faz: a conexão de socket morre e nasce outra;
  // só o token salvo no localStorage liga as duas pontas.
  {
    const token = 'tok-reconexao-teste';
    const antes = new Cliente();
    antes.idExplicito = token;
    await antes.conectar();
    await antes.emit('entrar', { nome: 'Reconectante', token });
    const rC1 = await antes.acao(1, { usuario: "admin'--", senha: 'x' }); // resolve o cenário 1
    ok('cliente original resolveu C1 antes de cair (ack)', rC1.resolvido !== null && rC1.resolvido.pontos > 0);
    await wait(150); // só agora esperamos o placar (evento à parte) propagar para o próprio cliente
    const pontosAntes = antes.pontos();
    const solvesAntes = antes.solves();
    ok('placar do cliente original refletiu o solve', solvesAntes === 1 && pontosAntes === rC1.resolvido?.pontos);

    antes.sock.disconnect(); // simula a conexão caindo (F5, wifi, app em segundo plano)
    await wait(200);

    const depois = new Cliente(); // nova conexão, socket.id diferente
    depois.idExplicito = token;
    await depois.conectar();
    const reentrada = await depois.emit<{ ok: boolean; nome?: string }>('entrar', { nome: 'Reconectante', token });
    await wait(150);
    ok('reconexão com o mesmo token é aceita', reentrada.ok === true);
    ok('pontuação sobrevive à reconexão', depois.pontos() === pontosAntes, `${pontosAntes} -> ${depois.pontos()}`);
    ok('soluções sobrevivem à reconexão', depois.solves() === solvesAntes);

    // o cenário já resolvido continua resolvido (não dá pra pontuar de novo com o mesmo token)
    const r2 = await depois.acao(1, { usuario: "admin'--", senha: 'x' });
    ok('cenário já resolvido não pontua de novo após reconectar', r2.resolvido === null);
  }

  // ---- P2: first-blood e dica paga ----
  const p2 = new Cliente();
  await p2.conectar();
  ok('P2 entra com nome livre', (await p2.emit<{ ok: boolean }>('entrar', { nome: 'P2' })).ok === true);
  ok('nome duplicado é rejeitado', (await p2.emit<{ ok: boolean }>('entrar', { nome: 'P1' })).ok === false);
  ok('nome duplicado ignora maiúsculas', (await p2.emit<{ ok: boolean }>('entrar', { nome: 'p1' })).ok === false);
  ok('nome vazio é rejeitado', (await p2.emit<{ ok: boolean }>('entrar', { nome: '   ' })).ok === false);
  const r2 = await p2.acao(1, { usuario: "' OR '1'='1'--", senha: 'x' });
  const p2C1 = r2.resolvido?.pontos ?? 0;
  ok('P2 também resolve C1', p2C1 > 0);
  ok('first-blood: P1 ganhou mais em C1 que P2', p1C1 > p2C1);

  await wait(80);
  const antes = p2.pontos();
  await p2.emit('dica', { cenarioId: 3 });
  await wait(100);
  ok('dica desconta 30% da base (250 -> -75)', p2.pontos() === antes - 75);

  // ---- pontos podem ficar negativos ----
  const p3 = new Cliente();
  await p3.conectar();
  await p3.emit('entrar', { nome: 'P3' });
  await p3.emit('dica', { cenarioId: 5 }); // base 400 -> custo 120, sem ter pontos
  await wait(100);
  ok('pontos podem ficar negativos', p3.pontos() === -120);

  await wait(80);
  ok('placar: P1 na frente de P2', admin.placar[0]?.nome === 'P1');

  // ---- encerrar ----
  admin.sock.emit('stop');
  await wait(150);
  ok('estado vira ended', p1.estado?.fase === 'ended');
  r = await p1.acao(1, { usuario: "admin'--", senha: 'x' });
  ok('cenário bloqueado após encerrar', r.resolvido === null && r.erro !== null);

  // ---- resetar ----
  admin.sock.emit('reset');
  await wait(150);
  ok('reset volta ao lobby e zera', p1.estado?.fase === 'lobby' && p1.pontos() === 0);

  console.log(falhas ? `\n${falhas} teste(s) falharam.` : '\nTodos os testes passaram.');
  process.exit(falhas ? 1 : 0);
}

const guarda = setTimeout(() => {
  console.error('Timeout do e2e.');
  process.exit(1);
}, 20000);
guarda.unref?.();

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
