/** Pontuação: base por dificuldade + bônus de rapidez + bônus de primeira a achar; dica desconta. */

/** Bônus de rapidez: até +50% da base no início, decaindo linearmente até 0 no fim. */
export function bonusRapidez(base: number, agora: number, inicio: number, fim: number): number {
  if (!inicio || !fim || fim <= inicio) return 0;
  const decorrido = Math.max(0, Math.min(fim, agora) - inicio);
  const fracaoRestante = 1 - decorrido / (fim - inicio); // 1 no início -> 0 no fim
  return Math.round(base * 0.5 * fracaoRestante);
}

/** Bônus para o primeiro jogador a resolver um cenário. */
export function bonusPrimeira(base: number): number {
  return Math.round(base * 0.2);
}

/** Custo de revelar a dica de um cenário. */
export function custoDica(base: number): number {
  return Math.round(base * 0.3);
}
