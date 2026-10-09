import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';

export const md5 = (s: string): string => createHash('md5').update(s).digest('hex');

// Credenciais reais (fortes) do admin: só dá para entrar por injeção, não por adivinhação.
export const ADMIN_LOGIN = 'admin';
export const ADMIN_SENHA = 'G7p$Lw2q!zx';

// Alvos usados pela detecção de cada cenário (ver scenarios.ts).
export const ALVOS = {
  papelAdmin: 'admin',
  nomesForaDaView: ['Caio Reis', 'Duda Nunes'], // funcionários de depto != 5
  salarios: ['4500', '6200', '9800', '15000', '28000'],
  desempenhoClassificado: 'TOP-SECRET-A7', // sentinela da linha de classe S
  segredo: 'COFRE-9F3A-2025', // valor na tabela segredos
  rendaJane: 17350, // resposta da dedução estatística
  senhaFraca: '123456', // senha do estagiário (hash md5 vazável)
};
export const HASH_FRACO = md5(ALVOS.senhaFraca);

/**
 * Cria e popula um SGBD em memória. Cada jogador recebe um por cenário, então um
 * DROP ou UPDATE de um aluno nunca afeta os outros nem os demais cenários.
 */
export function criarBanco(): DatabaseSync {
  const db = new DatabaseSync(':memory:');

  db.exec(`
    CREATE TABLE usuarios (
      id INTEGER PRIMARY KEY, login TEXT, senha TEXT, papel TEXT, senha_hash TEXT
    );
    CREATE TABLE funcionario (
      id INTEGER PRIMARY KEY, nome TEXT, cpf TEXT, salario TEXT,
      depto INTEGER, desempenho TEXT, classe TEXT
    );
    CREATE TABLE pessoa (
      id INTEGER PRIMARY KEY, nome TEXT, renda INTEGER, cidade TEXT,
      estado TEXT, escolaridade TEXT, sexo TEXT
    );
    CREATE TABLE segredos (chave TEXT, valor TEXT);
  `);

  const addUser = db.prepare(
    'INSERT INTO usuarios (id, login, senha, papel, senha_hash) VALUES (?, ?, ?, ?, ?)'
  );
  // O estagiário é uma conta "migrada": o banco guarda SÓ o hash, nunca o texto (como
  // manda o slide). A única pista é o senha_hash, um MD5 sem sal de uma senha trivial.
  const usuarios: [number, string, string | null, string, string][] = [
    [1, ADMIN_LOGIN, ADMIN_SENHA, 'admin', md5(ADMIN_SENHA)],
    [2, 'suporte', 'n3Ve!8rQ', 'suporte', md5('n3Ve!8rQ')],
    [3, 'estagiario', null, 'leitor', HASH_FRACO],
  ];
  for (const [id, login, senha, papel, hash] of usuarios) addUser.run(id, login, senha, papel, hash);

  const addFunc = db.prepare(
    'INSERT INTO funcionario (id, nome, cpf, salario, depto, desempenho, classe) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const funcionarios: [number, string, string, string, number, string, string][] = [
    [1, 'Ana Prado', '111.111.111-11', '4500', 5, 'Regular', 'C'],
    [2, 'Beto Lima', '222.222.222-22', '6200', 5, 'Bom', 'C'],
    [3, 'Caio Reis', '333.333.333-33', '9800', 7, 'Bom', 'C'],
    [4, 'Duda Nunes', '444.444.444-44', '15000', 9, 'Excelente', 'C'],
    [5, 'Edu Sá', '555.555.555-55', '28000', 5, ALVOS.desempenhoClassificado, 'S'],
  ];
  for (const f of funcionarios) addFunc.run(...f);

  const addPessoa = db.prepare(
    'INSERT INTO pessoa (id, nome, renda, cidade, estado, escolaridade, sexo) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const pessoas: [number, string, number, string, string, string, string][] = [
    [1, 'Jane Silva', ALVOS.rendaJane, 'Curitiba', 'PR', 'Ph.D.', 'F'],
    [2, 'Marcos Antunes', 9200, 'Curitiba', 'PR', 'Graduação', 'M'],
    [3, 'Rita Souza', 11000, 'Curitiba', 'PR', 'Mestrado', 'F'],
    [4, 'Paulo Dias', 25000, 'São Paulo', 'SP', 'Ph.D.', 'M'],
    [5, 'Clara Mota', 8700, 'Curitiba', 'PR', 'Graduação', 'F'],
    [6, 'Igor Nunes', 14300, 'Campinas', 'SP', 'Ph.D.', 'M'],
    [7, 'Lúcia Reis', 9900, 'Curitiba', 'PR', 'Graduação', 'F'],
  ];
  for (const p of pessoas) addPessoa.run(...p);

  db.prepare('INSERT INTO segredos (chave, valor) VALUES (?, ?)').run('cofre', ALVOS.segredo);
  return db;
}
