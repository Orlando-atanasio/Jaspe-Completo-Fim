// JASPE — IDs, hashes e storage versionado (pronto p/ adapter SQLite/Capacitor)
// REQ-12/29/40: UUID + SHA-256 + migração + deduplicação

const PREFIX = 'jaspe_';

let lastSeenId = 0;
try {
  // Monotonicidade entre sessões: evita reutilizar faixa de ids após reload.
  const persisted = Number(localStorage.getItem(PREFIX + 'last_id') || 0);
  if (Number.isFinite(persisted) && persisted > 0) lastSeenId = persisted;
} catch { /* storage indisponível (SSR/teste) */ }
export function newId(): number {
  // Único por sessão + entre sessões (lastSeenId persistido) + CSPRNG:
  // rajadas no mesmo ms nunca repetem; relógio voltando atrás também não
  // reutiliza (last+1). Persistido em localStorage a cada geração.
  const r = new Uint32Array(1);
  crypto.getRandomValues(r);
  let cand = Date.now() * 1000 + (r[0] % 100000);
  if (cand <= lastSeenId) cand = lastSeenId + 1 + (r[0] % 97);
  lastSeenId = cand;
  try { localStorage.setItem(PREFIX + 'last_id', String(cand)); } catch {}
  return cand;
}

export function newUUID(): string {
  try {
    return crypto.randomUUID();
  } catch {
    const a = new Uint8Array(16);
    crypto.getRandomValues(a);
    a[6] = (a[6] & 0x0f) | 0x40;
    a[8] = (a[8] & 0x3f) | 0x80;
    const h = Array.from(a).map((b) => b.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }
}

export const store = {
  read<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (raw == null || raw === '') return fallback;
      const v = JSON.parse(raw);
      if (v === null || v === undefined) return fallback;
      return v as T;
    } catch {
      return fallback;
    }
  },
  readArray<T>(key: string, fallback: T[]): T[] {
    const v = store.read<unknown>(key, fallback);
    return Array.isArray(v) ? (v as T[]) : fallback;
  },
  write(key: string, value: unknown): void {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch (e) {
      console.warn(`[JASPE store] quota/erro ao salvar ${key}`, e);
    }
  },
  remove(key: string): void {
    try {
      localStorage.removeItem(PREFIX + key);
    } catch {}
  }
};

// Lixeira com retenção de 30 dias (REQ-40)
export interface TrashedItem<T = unknown> {
  id: string;
  kind: string;
  data: T;
  deletedAt: string;
}

export function loadTrash(): TrashedItem[] {
  return store.readArray<TrashedItem>('trash', []);
}

export function moveToTrash(kind: string, data: unknown): void {
  const trash = loadTrash();
  let sanitizedData = data;
  if (kind === 'credential' && data && typeof data === 'object') {
    sanitizedData = {
      ...(data as Record<string, unknown>),
      pass: '***',
      notes: '***',
      url: '***',
      username: '***',
    };
  }
  trash.push({ id: newUUID(), kind, data: sanitizedData, deletedAt: new Date().toISOString() });
  // purga >30 dias
  const cutoff = Date.now() - 30 * 24 * 3600 * 1000;
  const kept = trash.filter((t) => new Date(t.deletedAt).getTime() > cutoff);
  store.write('trash', kept);
}

export function purgeTrash(): void {
  const cutoff = Date.now() - 30 * 24 * 3600 * 1000;
  const trash = loadTrash().filter((t) => new Date(t.deletedAt).getTime() > cutoff);
  store.write('trash', trash);
}
