// JASPE — Backup granular + integridade + download/upload
// REQ-24/26/27/28/29

import { sha256Hex } from './crypto';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export interface BackupSelection {
  notes: boolean;
  contacts: boolean;
  tasks: boolean;
  credentials: boolean;
  assets: boolean;
  proventos: boolean;
  documents: boolean;
  profile: boolean;
}

export const ALL_SELECTED: BackupSelection = {
  notes: true, contacts: true, tasks: true, credentials: true,
  assets: true, proventos: true, documents: true, profile: true
};

export interface BackupEnvelope {
  app: 'JASPE';
  version: 3;
  exportedAt: string;
  selection: BackupSelection;
  integrity: Record<string, string>;
  data: Record<string, unknown>;
}

export async function buildEnvelope(
  full: Record<string, unknown>,
  sel: BackupSelection
): Promise<BackupEnvelope> {
  const data: Record<string, unknown> = {};
  const integrity: Record<string, string> = {};
  for (const k of Object.keys(sel) as (keyof BackupSelection)[]) {
    if (sel[k]) {
      const v = full[k] ?? null;
      data[k] = v;
      integrity[k] = await sha256Hex(JSON.stringify(v));
    }
  }
  return { app: 'JASPE', version: 3, exportedAt: new Date().toISOString(), selection: sel, integrity, data };
}

export async function verifyEnvelope(env: BackupEnvelope): Promise<string[]> {
  const errors: string[] = [];
  if (!env || typeof env !== 'object' || (env as any).app !== 'JASPE') { errors.push('Arquivo não é um backup JASPE.'); return errors; }
  const data = (env as any).data;
  if (!data || typeof data !== 'object') { errors.push('Backup sem dados (data ausente).'); return errors; }
  const integrity = (env as any).integrity || {};
  for (const k of Object.keys(data)) {
    const expect = integrity[k];
    if (!expect) { errors.push(`Seção "${k}" sem hash de integridade — possível adulteração.`); continue; }
    const got = await sha256Hex(JSON.stringify(data[k]));
    if (got !== expect) errors.push(`Integridade divergente em "${k}".`);
  }
  return errors;
}

export function downloadTextFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Salva o arquivo de backup de verdade em cada plataforma.
// Web/desktop: download via <a download> (como antes).
// Android (Capacitor WebView): <a download> é ignorado pela WebView —
// por isso o app mostrava "gerado com sucesso" sem abrir nada para salvar
// (falso positivo). No nativo o arquivo é gravado no cache e entregue ao
// compartilhamento do sistema (mesma técnica já usada no PDF do relatório),
// onde o usuário escolhe salvar/abrir (Arquivos, Drive, etc.).
// Retorna 'shared' no nativo e 'downloaded' na web.
export async function saveBackupFile(filename: string, content: string, _mime: string): Promise<'shared' | 'downloaded'> {
  if (Capacitor.isNativePlatform()) {
    const bytes = new TextEncoder().encode(content);
    let bin = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    const base64 = btoa(bin);
    const saved = await Filesystem.writeFile({ path: filename, data: base64, directory: Directory.Cache });
    await Share.share({
      title: filename,
      text: `Backup JASPE: ${filename}`,
      url: saved.uri,
      dialogTitle: 'Salvar backup',
    });
    return 'shared';
  }
  downloadTextFile(filename, content, _mime);
  return 'downloaded';
}

export function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

// Deduplicação na importação: identidade por id/uuid, conteúdo por SHA-256.
// Regra (anti-duplicata):
//  1) mesmo id OU mesmo uuid  → MESMO item (nunca duplica).
//     - conteúdo igual        → skipped
//     - conteúdo diferente    → mantém o mais novo por updatedAt (fallback: local),
//                               conta como updated, NÃO cria id novo.
//  2) sem identidade igual + hash igual → skipped (já existe com outro id).
//  3) caso contrário → item novo (com proteção contra colisão de id).
export async function dedupMerge<T extends { id: number | string; uuid?: string; updatedAt?: string }>(
  current: T[],
  incoming: T[]
): Promise<{ merged: T[]; skipped: number; updated: number; inserted: number }> {
  const cur = Array.isArray(current) ? current : [];
  const inc = Array.isArray(incoming) ? incoming : [];
  const hashOf = async (o: unknown) => sha256Hex(JSON.stringify(o));
  const byId = new Map<string, number>();
  const byUuid = new Map<string, number>();
  const merged = [...cur];
  cur.forEach((c, i) => {
    if (c && c.id !== undefined && c.id !== null) byId.set(String(c.id), i);
    const u = (c as { uuid?: unknown })?.uuid;
    if (typeof u === 'string' && u) byUuid.set(u, i);
  });
  const seenHashes = new Set<string>();
  for (const c of cur) {
    try { seenHashes.add(await hashOf(stripId(c))); } catch { /* ignora */ }
  }
  const usedIds = new Set(merged.map((m) => String(m?.id)));
  const rnd = new Uint32Array(8);
  try { crypto.getRandomValues(rnd); } catch { for (let i = 0; i < 8; i++) rnd[i] = (Math.random() * 0xffffffff) >>> 0; }
  const freshNumericId = (): number => {
    let n = Date.now() * 1000 + (rnd[0] % 100000);
    let guard = 0;
    while (usedIds.has(String(n)) && guard++ < 20) n = Date.now() * 1000 + (rnd[guard % 8] % 100000);
    return n;
  };
  let skipped = 0;
  let updated = 0;
  let inserted = 0;
  // Ids dos itens NOVOS, na ordem em que foram inseridos nesta chamada.
  // Usados só no final p/ reconstituir a ordem "mais novo primeiro" sem
  // jamais deslocar índices durante o loop (ver nota abaixo sobre unshift).
  const insertedIds: string[] = [];
  for (const item of inc) {
    if (!item || typeof item !== 'object') { skipped++; continue; }
    const idKey = item.id !== undefined && item.id !== null ? String(item.id) : '';
    const uuidVal = typeof (item as { uuid?: unknown }).uuid === 'string' ? String((item as { uuid?: unknown }).uuid) : '';
    let idx = -1;
    if (idKey && byId.has(idKey)) idx = byId.get(idKey)!;
    else if (uuidVal && byUuid.has(uuidVal)) idx = byUuid.get(uuidVal)!;
    if (idx >= 0) {
      // Mesmo item: compara conteúdo (sem id) p/ decidir.
      let same = false;
      try {
        const hCur = await hashOf(stripId(merged[idx]));
        const hInc = await hashOf(stripId(item));
        same = hCur === hInc;
      } catch { same = false; }
      if (same) { skipped++; continue; }
      // Versão diferente → mantém a mais nova, nunca duplica.
      const curT = Date.parse(String((merged[idx] as { updatedAt?: unknown }).updatedAt || '')) || 0;
      const incT = Date.parse(String((item as { updatedAt?: unknown }).updatedAt || '')) || 0;
      if (incT > curT) {
        merged[idx] = { ...item, id: merged[idx].id } as T; // preserva id local
        updated++;
      } else {
        skipped++;
      }
      continue;
    }
    const h = await hashOf(stripId(item));
    if (seenHashes.has(h)) { skipped++; continue; }
    // evita colisão de id (com re-checagem, sem Math.random)
    let finalId: number | string = item.id;
    if (usedIds.has(String(finalId))) {
      if (typeof item.id === 'number') {
        finalId = freshNumericId();
      } else {
        let s = String(item.id) + '-imp';
        let k = 1;
        while (usedIds.has(s)) s = String(item.id) + '-imp' + (++k);
        finalId = s;
      }
    }
    usedIds.add(String(finalId));
    // BUGFIX (integridade do import): a versão anterior fazia
    // `merged.unshift(...)` aqui, dentro do loop. unshift() desloca TODOS os
    // índices já existentes em `merged` uma posição para frente, mas os
    // índices guardados em `byId`/`byUuid` (tanto os de `cur` quanto os de
    // itens já inseridos neste mesmo loop) nunca eram atualizados. Resultado:
    // a partir do segundo item novo em diante, qualquer atualização de item
    // já existente (`merged[idx] = ...`) podia escrever no registro ERRADO —
    // sobrescrevendo silenciosamente um contato/nota/tarefa/ativo não
    // relacionado durante a restauração de backup. Agora usamos `push`
    // (não desloca nada) e só reordenamos os novos para o início do array
    // depois que o loop — e todas as atualizações por índice — já terminou.
    if (uuidVal) byUuid.set(uuidVal, merged.length);
    byId.set(String(finalId), merged.length);
    merged.push({ ...item, id: finalId } as T);
    insertedIds.push(String(finalId));
    seenHashes.add(h);
    inserted++;
  }
  if (insertedIds.length) {
    const insertedSet = new Set(insertedIds);
    const rest: T[] = [];
    const byIdFinal = new Map<string, T>();
    for (const m of merged) {
      const idStr = String((m as { id?: unknown })?.id);
      if (insertedSet.has(idStr) && !byIdFinal.has(idStr)) byIdFinal.set(idStr, m);
      else if (!insertedSet.has(idStr)) rest.push(m);
    }
    // Reaplica a ordem "mais novo primeiro": o último item novo processado
    // no loop fica na frente, igual ao comportamento do unshift original.
    const front = [...insertedIds].reverse().map((id) => byIdFinal.get(id)).filter((x): x is T => !!x);
    return { merged: [...front, ...rest], skipped, updated, inserted };
  }
  return { merged, skipped, updated, inserted };
}

function stripId<T>(o: T): Omit<T, 'id'> {
  if (o && typeof o === 'object' && 'id' in (o as object)) {
    const { id: _dropped, ...rest } = o as Record<string, unknown>;
    void _dropped;
    return rest as Omit<T, 'id'>;
  }
  return o as Omit<T, 'id'>;
}
