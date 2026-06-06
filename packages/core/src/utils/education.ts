import type { HealthContent } from '../types/db';

/**
 * Recomenda conteúdos cujo `tags` (CID-10) batem com os CIDs do usuário.
 * Conteúdos sem correspondência vêm depois (feed geral). Ordena por relevância.
 */
export function recommendContentByCids(
  content: HealthContent[],
  userCids: string[],
): HealthContent[] {
  const set = new Set(userCids.map((c) => c.toUpperCase().trim()).filter(Boolean));
  const score = (c: HealthContent) =>
    c.tags.filter((t) => set.has(t.toUpperCase().trim())).length;
  return [...content].sort((a, b) => score(b) - score(a));
}

/** Conteúdos relevantes para o usuário (ao menos 1 tag em comum). */
export function isRelevant(content: HealthContent, userCids: string[]): boolean {
  const set = new Set(userCids.map((c) => c.toUpperCase().trim()));
  return content.tags.some((t) => set.has(t.toUpperCase().trim()));
}
