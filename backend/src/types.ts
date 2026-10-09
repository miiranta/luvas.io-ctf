import type { DatabaseSync } from 'node:sqlite';

export type Dificuldade = 'facil' | 'medio' | 'dificil';
export type TipoCenario = 'auto' | 'resposta';
// Qual widget o frontend desenha na página interativa do cenário.
export type Kind = 'login' | 'busca' | 'stats' | 'relatorio';

// Um cenário é um mini-app com várias páginas: umas para ler/explorar (texto, tabela)
// e uma interativa (form), onde o ataque acontece. As páginas são conteúdo público.
// `meta: true` marca páginas dirigidas ao jogador (fora da ficção do cenário, tipo um
// aviso de regras do jogo), em vez de conteúdo do mini-app fictício. Elas vêm primeiro
// na lista de abas e ganham uma cor diferente no frontend.
export type Pagina =
  | { tipo: 'texto'; id: string; nome: string; titulo: string; corpo: string[]; meta?: boolean }
  | { tipo: 'tabela'; id: string; nome: string; titulo: string; colunas: string[]; linhas: string[][]; nota?: string; meta?: boolean }
  | { tipo: 'lista'; id: string; nome: string; titulo: string; itens: { de?: string; txt: string }[]; nota?: string; meta?: boolean }
  | { tipo: 'ficha'; id: string; nome: string; titulo: string; campos: { rotulo: string; valor: string }[]; nota?: string; meta?: boolean }
  | { tipo: 'codigo'; id: string; nome: string; titulo: string; linguagem?: string; codigo: string[]; nota?: string; meta?: boolean }
  | { tipo: 'faq'; id: string; nome: string; titulo: string; qa: { q: string; a: string }[]; nota?: string; meta?: boolean }
  | { tipo: 'tiles'; id: string; nome: string; titulo: string; cards: { rotulo: string; valor: string; sub?: string }[]; nota?: string; meta?: boolean }
  | { tipo: 'form'; id: string; nome: string; titulo: string; instrucao: string; meta?: boolean }
  // ferramenta: digita um texto, recebe o hash MD5 dele. Sem internet, é o jeito de
  // testar candidatos de senha contra um hash vazado (força bruta manual).
  | { tipo: 'hash'; id: string; nome: string; titulo: string; instrucao: string; meta?: boolean };

export interface ResultadoSQL {
  sql: string;
  colunas: string[];
  linhas: Record<string, unknown>[];
  erro: string | null;
}

// Definição completa de um cenário (server-side).
export interface Cenario {
  id: number;
  nome: string; // nome vago: a única pista na lista
  resumo: string; // uma frase, também vaga
  premissa: string; // enunciado neutro mostrado dentro do cenário
  // o QUE precisa ser alcançado (subtítulo, visível ao abrir o cenário), sem revelar COMO.
  // Ex.: "entre como admin sem saber a senha" em vez de "use OR '1'='1'--".
  objetivo: string;
  dica: string; // dica paga, mais concreta
  dificuldade: Dificuldade;
  base: number;
  tipo: TipoCenario;
  kind: Kind;
  // páginas do mini-app (conteúdo para explorar + a página interativa)
  paginas: Pagina[];
  // mostra a consulta montada ao jogador. Só o cenário tutorial faz isso de propósito;
  // nos demais, a pessoa precisa inferir a forma da consulta (puzzle mais difícil).
  revelaSQL?: boolean;
  // validação opcional antes de rodar (ex.: BD estatístico só aceita agregados)
  validar?(entradas: Record<string, string>): string | null;
  // monta a consulta vulnerável a partir das entradas do jogador
  montarSQL(entradas: Record<string, string>): string;
  // detecção automática (tipo 'auto'): o ataque funcionou?
  conferir?(res: ResultadoSQL, entradas: Record<string, string>): boolean;
  // conferência de resposta (tipo 'resposta')
  conferirResposta?(valor: string): boolean;
}

// Metadados públicos enviados ao cliente (sem a lógica nem a dica).
export interface CenarioPublico {
  id: number;
  nome: string;
  resumo: string;
  premissa: string;
  objetivo: string;
  dificuldade: Dificuldade;
  base: number;
  tipo: TipoCenario;
  kind: Kind;
  revelaSQL: boolean;
  paginas: Pagina[];
}

export interface Solve {
  cenarioId: number;
  at: number; // epoch ms
  pontos: number;
}

export interface Jogador {
  id: string;
  nome: string;
  pontos: number;
  solves: Map<number, Solve>;
  dicas: Set<number>; // cenários com dica revelada
  bancos: Map<number, DatabaseSync>; // um SGBD isolado por cenário
}

export type Fase = 'lobby' | 'running' | 'ended';

export interface RespostaAcao extends ResultadoSQL {
  resolvido: { id: number; nome: string; pontos: number } | null;
}

export interface LinhaPlacar {
  id: string;
  nome: string;
  pontos: number;
  solves: { cenarioId: number; minuto: number }[];
}

export interface EstadoJogo {
  fase: Fase;
  totalCenarios: number;
  duracaoSeg: number;
  restanteSeg: number;
}
