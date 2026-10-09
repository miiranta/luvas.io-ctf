// Tipos espelhados do backend (parte pública).

export type Fase = 'lobby' | 'running' | 'ended';
export type Dificuldade = 'facil' | 'medio' | 'dificil';
export type Kind = 'login' | 'busca' | 'stats' | 'relatorio';

// Campos opcionais (em vez de união discriminada) para o template acessar livremente.
export interface Pagina {
  tipo: 'texto' | 'tabela' | 'lista' | 'ficha' | 'codigo' | 'faq' | 'tiles' | 'form' | 'hash';
  id: string;
  nome: string;
  titulo: string;
  corpo?: string[];
  colunas?: string[];
  linhas?: string[][];
  itens?: { de?: string; txt: string }[];
  campos?: { rotulo: string; valor: string }[];
  codigo?: string[];
  linguagem?: string;
  qa?: { q: string; a: string }[];
  cards?: { rotulo: string; valor: string; sub?: string }[];
  nota?: string;
  instrucao?: string;
  meta?: boolean;
}

export interface CenarioPublico {
  id: number;
  nome: string;
  resumo: string;
  premissa: string;
  objetivo: string;
  dificuldade: Dificuldade;
  base: number;
  tipo: 'auto' | 'resposta';
  kind: Kind;
  revelaSQL: boolean;
  paginas: Pagina[];
}

export interface Config {
  total: number;
  cenarios: CenarioPublico[];
}

export interface Estado {
  fase: Fase;
  totalCenarios: number;
  duracaoSeg: number;
  restanteSeg: number;
}

export interface LinhaPlacar {
  id: string;
  nome: string;
  pontos: number;
  solves: { cenarioId: number; minuto: number }[];
}

export interface Resolvido {
  id: number;
  nome: string;
  pontos: number;
  base: number;
  bonusRapidez: number;
  bonusPrimeira: number;
}

export interface ResultadoSQL {
  sql: string;
  colunas: string[];
  linhas: Record<string, unknown>[];
  erro: string | null;
}

export interface RespostaAcao extends ResultadoSQL {
  resolvido: Resolvido | null;
}
