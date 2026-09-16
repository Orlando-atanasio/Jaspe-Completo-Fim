// JASPE — Alarmes: LocalNotifications nativas (Android) + Web Notification (fallback)
// Camada única: o app chama estas funções sem saber a plataforma.

import { Capacitor } from '@capacitor/core';
import { Task } from '../types';

const isNative = (): boolean => {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
};

/** ID int32 determinístico p/ o plugin nativo (task.id é 64-bit). */
export function nativeNotifId(taskId: number | string): number {
  const s = String(taskId);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h * 31 + s.charCodeAt(i)) | 0);
  const n = Math.abs(h) % 2000000000;
  return n === 0 ? 1 : n;
}

export async function ensureAlarmPermission(): Promise<boolean> {
  if (isNative()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const cur = await LocalNotifications.checkPermissions();
      if (cur.display === 'granted') return true;
      const req = await LocalNotifications.requestPermissions();
      return req.display === 'granted';
    } catch {
      return false;
    }
  }
  try {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const p = await Notification.requestPermission();
    return p === 'granted';
  } catch {
    return false;
  }
}

/** Normaliza antecedência (minutos antes). 0 = na hora. Limite 0..10080 (7 dias). */
export function clampRemindBeforeMin(v: unknown): number {
  const n = typeof v === 'string' ? Number(v) : (v as number);
  if (!Number.isFinite(n)) return 0;
  const i = Math.floor(n);
  if (i <= 0) return 0;
  return Math.min(i, 10080);
}

/** Normaliza repetição (a cada X min). 0/ausente = uma vez. Limite 0..1440 (24h). Mínimo prático 5min. */
export function clampRepeatEveryMin(v: unknown): number {
  const n = typeof v === 'string' ? Number(v) : (v as number);
  if (!Number.isFinite(n)) return 0;
  const i = Math.floor(n);
  if (i < 5) return 0;
  return Math.min(i, 1440);
}

/**
 * Hora em que o alarme deve disparar = prazo - antecedência.
 * Retorna null se sem prazo/data inválida. Tarefas antigas (sem remindBeforeMin) = 0.
 */
export function getAlarmTime(dateISO?: string, remindBeforeMin?: number): Date | null {
  if (!dateISO) return null;
  const d = new Date(dateISO);
  if (Number.isNaN(d.getTime())) return null;
  const before = clampRemindBeforeMin(remindBeforeMin ?? 0);
  return new Date(d.getTime() - before * 60000);
}

/** Disparo imediato (alarme tocando AGORA): nativo + web + vibração. */
export async function fireAlarmNotification(title: string, body: string, taskId?: number | string): Promise<void> {
  if (isNative()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      await LocalNotifications.schedule({
        notifications: [{
          title: `⏰ ${title}`,
          body,
          id: taskId !== undefined ? nativeNotifId(taskId) : Math.floor(Date.now() % 2000000000),
          sound: 'default',
          smallIcon: 'ic_stat_icon_config_sample',
          channelId: 'jaspe-alarmes',
        }],
      });
    } catch { /* fallback web abaixo */ }
  }
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      const n = new Notification(`⏰ ${title}`, { body, tag: `jaspe-alarm-${Date.now()}`, requireInteraction: true } as NotificationOptions);
      setTimeout(() => { try { n.close(); } catch {} }, 30000);
    }
  } catch {}
  try {
    if ('vibrate' in navigator) navigator.vibrate([300, 100, 300, 100, 500]);
  } catch {}
}

/**
 * Agenda alarme futuro no sistema (funciona com app minimizado/morto no Android).
 * Chamado sempre que a lista de tarefas muda; reconcilia por ID.
 * Usa dateISO + remindBeforeMin + repeatEveryMin quando presentes.
 */
export async function syncNativeAlarms(tasks: Task[]): Promise<void> {
  if (!isNative()) return;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    // Cria canal (Android 8+ exige canal p/ som/vibração)
    try {
      await LocalNotifications.createChannel({
        id: 'jaspe-alarmes',
        name: 'Alarmes Jaspe',
        description: 'Lembretes de tarefas do Jaspe',
        importance: 5,
        vibration: true,
        sound: 'default',
      });
    } catch { /* canal pode já existir */ }
    const now = Date.now();
    const wanted = new Map<number, { title: string; body: string; at: Date; remindBeforeMin?: number; repeatEveryMin?: number }>();
    for (const t of tasks || []) {
      if (!t || !t.alarm || t.done || !t.dateISO) continue;
      const at = getAlarmTime(t.dateISO, t.remindBeforeMin);
      if (!at) continue; // sem prazo/data inválida: pula (compatível com tarefas antigas)
      const repeat = clampRepeatEveryMin(t.repeatEveryMin);
      wanted.set(nativeNotifId(t.id), {
        title: `⏰ ${t.text || 'Lembrete Jaspe'}`,
        body: at.toLocaleString('pt-BR'),
        at,
        remindBeforeMin: t.remindBeforeMin ?? undefined,
        repeatEveryMin: repeat ?? undefined,
      });
    }
    const pending = await LocalNotifications.getPending().catch(() => ({ notifications: [] as { id: number }[] }));
    const pendingIds = new Set((pending.notifications || []).map((n) => Number(n.id)));
    // Cancela os que não são mais desejados (desmarcou alarme / concluiu / mudou data / mudou antecedência/repetição)
    const toCancel = [...pendingIds].filter((id) => {
      const old = wanted.get(id);
      return !old || old.at.getTime() !== wanted.get(id)?.at.getTime();
    });
    // BUGFIX: o cancelamento era calculado mas nunca aplicado — o alarme
    // nativo antigo ficava agendado pra sempre com a hora velha, e como o id
    // (estável por tarefa) já constava em `pendingIds`, o novo horário nunca
    // era agendado no lugar. Editar antecedência/data de uma tarefa com
    // alarme nativo já agendado não tinha efeito nenhum em 2º plano. Agora
    // cancelamos de fato os desatualizados antes de reagendar.
    if (toCancel.length) {
      await LocalNotifications.cancel({ notifications: toCancel.map((id) => ({ id })) }).catch(() => {});
    }
    // Agenda os novos + os que acabaram de ser cancelados por terem mudado de horário.
    const toCancelSet = new Set(toCancel);
    const toSchedule = [...wanted.entries()].filter(([id]) => !pendingIds.has(id) || toCancelSet.has(id));
    if (toSchedule.length) {
      await LocalNotifications.schedule({
        notifications: toSchedule.slice(0, 50).map(([id, w]) => ({
          title: w.title,
          body: w.body,
          id,
          schedule: { at: w.at, allowWhileIdle: true },
          sound: 'default',
          smallIcon: 'ic_stat_icon_config_sample',
          channelId: 'jaspe-alarmes',
          extra: { taskAlarm: true, remindBeforeMin: w.remindBeforeMin ?? 0, repeatEveryMin: w.repeatEveryMin ?? 0 },
        })),
      }).catch(() => {});
    }
  } catch { /* alarmes nativos são best-effort; polling web continua */ }
}

export async function cancelNativeAlarm(taskId: number | string): Promise<void> {
  if (!isNative()) return;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.cancel({ notifications: [{ id: nativeNotifId(taskId) }] }).catch(() => {});
  } catch {}
}

// Hook de voz real (Web Speech API) com fallback
export function startVoiceDictation(
  onResult: (text: string) => void,
  onError: (msg: string) => void
): () => void {
  const SR = (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition
    || (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;
  if (!SR) {
    onError('Reconhecimento de voz não suportado neste navegador.');
    return () => {};
  }
  try {
    const rec = new SR();
    rec.lang = 'pt-BR';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e: { results: { transcript: string }[][] }) => {
      const t = e.results?.[0]?.[0]?.transcript;
      if (t) onResult(t);
    };
    rec.onerror = () => onError('Falha no ditado. Tente novamente.');
    rec.start();
    return () => { try { rec.stop(); } catch {} };
  } catch {
    onError('Falha ao iniciar ditado.');
    return () => {};
  }
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: { transcript: string }[][] }) => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}
