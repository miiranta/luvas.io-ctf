import type { DatabaseSync } from 'node:sqlite';
import type { Cenario, ResultadoSQL } from './types.js';

// A injeção é real, mas o servidor atende todos no mesmo processo: uma consulta cara
// travaria a aula. O node:sqlite não deixa interromper a consulta em curso, então
// limitamos o custo ANTES (bloqueio) e DURANTE (tempo/linhas).
const MAX_LINHAS = 2000;
const MAX_MS = 500;
const PERIGO = /\b(recursive|zeroblob|randomblob|load_extension|attach)\b/i;

/** Executa UMA instrução e empacota o resultado, ou o erro cru como um app ingênuo faria. */
export function rodar(db: DatabaseSync, sql: string): ResultadoSQL {
  if (PERIGO.test(sql)) {
    return { sql, colunas: [], linhas: [], erro: 'Consulta bloqueada: construção pesada ou perigosa.' };
  }
  try {
    const it = db.prepare(sql).iterate() as IterableIterator<Record<string, unknown>>;
    const linhas: Record<string, unknown>[] = [];
    const t0 = Date.now();
    for (const linha of it) {
      linhas.push(linha);
      if (linhas.length >= MAX_LINHAS) {
        it.return?.();
        return { sql, colunas: [], linhas: [], erro: `Consulta interrompida: passou de ${MAX_LINHAS} linhas.` };
      }
      if ((linhas.length & 255) === 0 && Date.now() - t0 > MAX_MS) {
        it.return?.();
        return { sql, colunas: [], linhas: [], erro: 'Consulta interrompida: demorou demais.' };
      }
    }
    const colunas = linhas.length ? Object.keys(linhas[0]) : [];
    return { sql, colunas, linhas, erro: null };
  } catch (e) {
    return { sql, colunas: [], linhas: [], erro: (e as Error).message };
  }
}

/** Valida (se houver), monta e roda a consulta do cenário. */
export function executar(db: DatabaseSync, cenario: Cenario, entradas: Record<string, string>): ResultadoSQL {
  if (cenario.validar) {
    const erro = cenario.validar(entradas);
    if (erro) return { sql: '', colunas: [], linhas: [], erro };
  }
  return rodar(db, cenario.montarSQL(entradas));
}

/** Achata todos os valores de célula do resultado em strings (para a detecção). */
export function celulas(res: ResultadoSQL): Set<string> {
  const out = new Set<string>();
  for (const linha of res.linhas) {
    for (const v of Object.values(linha)) {
      if (v !== null && v !== undefined) out.add(String(v));
    }
  }
  return out;
}
