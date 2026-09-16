// Categorias dinâmicas compartilhadas (cofre, contatos, ativos)
// Cada lista vive em localStorage e pode ganhar itens novos ou lixeira.

export type CategoryKind = 'geral' | 'ativo' | 'notas';

const KEY = (kind: CategoryKind) => (kind === 'notas' ? 'jaspe_note_categories' : `jaspe_cats_${kind}`);

export const DEFAULT_CATS: Record<CategoryKind, string[]> = {
  geral: ['Trabalho', 'Finanças', 'Pessoal'],
  ativo: ['Ações', 'FIIs', 'Renda Fixa', 'Cripto'],
  notas: ['Trabalho', 'Pessoal', 'Ideias']
};

export function loadCats(kind: CategoryKind): string[] {
  try {
    const raw = localStorage.getItem(KEY(kind));
    if (!raw) return [...DEFAULT_CATS[kind]];
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return [...DEFAULT_CATS[kind]];
    const clean = v
      .filter((x): x is string => typeof x === 'string' && x.trim() !== '')
      .map((x) => x.trim())
      .filter((x) => x !== 'Todas');
    const dedup = [...new Set(clean)];
    return dedup.length > 0 ? dedup : [...DEFAULT_CATS[kind]];
  } catch {
    return [...DEFAULT_CATS[kind]];
  }
}

export function saveCats(kind: CategoryKind, cats: string[]): void {
  try {
    localStorage.setItem(KEY(kind), JSON.stringify(cats));
  } catch {}
}

// Conta quantos itens usam cada categoria (para os distintivos do card)
export function countCats<T>(
  items: T[] | null | undefined,
  get: (t: T) => unknown
): Record<string, number> {
  const out: Record<string, number> = {};
  if (!Array.isArray(items)) return out;
  for (const it of items) {
    if (!it) continue;
    const k = String(get(it) || '').trim();
    if (!k) continue;
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}
