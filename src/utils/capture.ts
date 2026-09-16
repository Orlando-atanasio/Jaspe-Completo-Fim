// JASPE — Captura rápida e inteligente 100% local (sem rede, sem IA externa).
// Interpreta texto livre em pt-BR: detecta data/hora, e-mail, telefone e @usuário,
// e classifica em nota | tarefa | contato (modo auto ou forçado).

export type CaptureKind = 'nota' | 'tarefa' | 'contato';
export type CaptureMode = 'auto' | CaptureKind;

export interface InterpretedCapture {
  kind: CaptureKind;
  reason: string;
  taskText: string;
  dateLabel: string;
  dateISO?: string;
  dateDisplay?: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  contactTelegram: string;
  noteTitle: string;
  noteBody: string;
}

const WEEKDAYS: Record<string, number> = {
  'domingo': 0, 'segunda': 1, 'segunda-feira': 1, 'terca': 2, 'terça': 2, 'terca-feira': 2, 'terça-feira': 2,
  'quarta': 3, 'quarta-feira': 3, 'quinta': 4, 'quinta-feira': 4, 'sexta': 5, 'sexta-feira': 5, 'sabado': 6, 'sábado': 6
};

function norm(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function displayDate(d: Date): string {
  return `${d.toLocaleDateString('pt-BR')} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface FoundDate { date: Date; label: string; token: RegExp }

function findDateTime(raw: string): FoundDate | null {
  const n = norm(raw);
  const now = new Date();
  // hora: "às 14h", "14:00", "14h30", "@ 9h"
  let hh = 9, mm = 0, hasTime = false;
  const timeRe = /(?:as|@)?\s*(\d{1,2})(?::|h)(\d{2})?|\b(\d{1,2})h\b/;
  const tm = n.match(timeRe);
  if (tm) {
    const h = Number(tm[1] ?? tm[3]);
    const m = Number(tm[2] ?? 0);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) { hh = h; mm = m; hasTime = true; }
  }
  const at = (d: Date, label: string, token: RegExp): FoundDate => {
    d.setHours(hh, mm, 0, 0);
    return { date: d, label: hasTime ? `${label} às ${pad(hh)}:${pad(mm)}` : label, token };
  };
  if (n.includes('depois de amanha')) {
    const d = new Date(now); d.setDate(d.getDate() + 2);
    return at(d, 'Depois de amanhã', /depois de amanh[ãa]/i);
  }
  if (n.includes('amanha')) {
    const d = new Date(now); d.setDate(d.getDate() + 1);
    return at(d, 'Amanhã', /amanh[ãa]/i);
  }
  if (n.includes('hoje')) {
    return at(new Date(now), 'Hoje', /hoje/i);
  }
  for (const [name, dow] of Object.entries(WEEKDAYS)) {
    if (n.includes(name)) {
      const d = new Date(now);
      let delta = (dow - d.getDay() + 7) % 7;
      if (delta === 0) delta = 7;
      d.setDate(d.getDate() + delta);
      return at(d, `Próxima ${name}`, new RegExp(name, 'i'));
    }
  }
  const dm = n.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (dm) {
    const day = Number(dm[1]); const month = Number(dm[2]);
    let year = dm[3] ? Number(dm[3]) : now.getFullYear();
    if (year < 100) year += 2000;
    if (day < 1 || day > 31 || month < 1 || month > 12) return hasTime ? at(new Date(now), 'Hoje', /$^/) : null;
    const d = new Date(year, month - 1, day);
    if (!dm[3] && d.getTime() < new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) {
      d.setFullYear(year + 1);
    }
    return at(d, `${pad(day)}/${pad(month)}`, /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/);
  }
  // "dia 15" → dia 15 do mês atual (ou próximo, se já passou)
  const dd = n.match(/\bdia\s+(\d{1,2})\b/);
  if (dd) {
    const day = Number(dd[1]);
    if (day >= 1 && day <= 31) {
      const d = new Date(now.getFullYear(), now.getMonth(), day);
      if (d.getTime() < new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) {
        d.setMonth(d.getMonth() + 1);
      }
      return at(d, `Dia ${pad(day)}`, /\bdia\s+\d{1,2}\b/);
    }
  }
  if (hasTime) return at(new Date(now), 'Hoje', /$^/);
  return null;
}

function stripTokens(raw: string, patterns: RegExp[]): string {
  let s = raw;
  for (const p of patterns) {
    s = s.replace(new RegExp(p.source, 'gi'), ' ');
  }
  s = s.replace(/[,\-–—:;]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  // preposição pendurada no fim ("Ligar para Maria às" → "Ligar para Maria")
  s = s.replace(/\s+(às|as|@|de|do|da|dos|das|em|no|na|nos|nas|para|pra|por|com)\s*$/i, '').trim();
  return s;
}

const PREFIXES = /^(por favor\s+)?(lembrar(\s+de|\s+que)?|lembrete(\s+de)?|agendar|agenda|tarefa(\s+nova)?|nova tarefa|fazer|anotar|anotacao|nota(\s+nova)?|nova nota|contato(\s+novo)?|novo contato|adicionar contato|ligar para|ligar pra|chamar)\s+/i;

export function interpretCapture(rawInput: string, mode: CaptureMode = 'auto'): InterpretedCapture {
  const raw = (rawInput || '').trim();
  const empty: InterpretedCapture = {
    kind: 'nota', reason: 'Texto livre → Nota', taskText: '', dateLabel: '',
    dateISO: undefined, dateDisplay: undefined,
    contactName: '', contactPhone: '', contactEmail: '', contactTelegram: '',
    noteTitle: '', noteBody: raw
  };
  if (!raw) return empty;

  const emailM = raw.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
  const phoneDigits = (raw.replace(/\D/g, '').match(/\d{10,13}/g) || [])[0] || '';
  const phone = phoneDigits.length >= 10 && phoneDigits.length <= 13 ? phoneDigits : '';
  // @usuário fora de e-mail (o @ do e-mail não conta como telegram)
  const noEmail = emailM ? raw.replace(emailM[0], ' ') : raw;
  const tgM = noEmail.match(/@([A-Za-z0-9_]{3,})/);
  const found = findDateTime(raw);
  const n = norm(raw);
  const hasDateWord = found !== null || /(segunda|terca|terça|quarta|quinta|sexta|sabado|sábado|domingo|hoje|amanha|amanhã|dia\s+\d)/.test(n);

  let kind: CaptureKind;
  let reason: string;
  if (mode !== 'auto') {
    kind = mode;
    reason = mode === 'nota' ? 'Modo forçado → Nota' : mode === 'tarefa' ? 'Modo forçado → Tarefa' : 'Modo forçado → Contato';
  } else if (emailM || phone || tgM) {
    kind = 'contato';
    reason = 'Detectei e-mail/telefone/@ → Contato';
  } else if (hasDateWord) {
    kind = 'tarefa';
    reason = 'Detectei data/hora → Tarefa';
  } else {
    kind = 'nota';
    reason = 'Texto livre → Nota';
  }

  // nome do contato = texto menos tokens reconhecidos
  let cname = stripTokens(raw, [
    ...(emailM ? [new RegExp(emailM[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))] : []),
    ...(tgM ? [new RegExp('@' + tgM[1])] : []),
    ...(phone ? [new RegExp(phone.replace(/(\d)/g, '$1[\\s-]*'))] : []),
    /\b\d{10,13}\b/, /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/, /\b\d{1,2}(?::|h)\d{0,2}\b/,
    /hoje|amanh[ãa]|depois de amanh[ãa]|segunda(-feira)?|ter[çc]a(-feira)?|quarta(-feira)?|quinta(-feira)?|sexta(-feira)?|s[áa]bado|domingo/gi
  ]).replace(PREFIXES, '').trim();

  // texto da tarefa = texto menos data/hora
  const ttext = stripTokens(raw, [
    /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/, /\b\d{1,2}(?::|h)\d{0,2}\b/,
    /hoje|amanh[ãa]|depois de amanh[ãa]|segunda(-feira)?|ter[çc]a(-feira)?|quarta(-feira)?|quinta(-feira)?|sexta(-feira)?|s[áa]bado|domingo/gi,
    /^(por favor\s+)?(lembrar(\s+de|\s+que)?|lembrete(\s+de)?|agendar|agenda|tarefa(\s+nova)?|nova tarefa|fazer)\s+/i
  ]);

  const firstLine = raw.split('\n')[0].trim();
  const tgUser = tgM ? tgM[1] : '';
  cname = cname.slice(0, 60);
  if (!cname && tgUser) cname = '@' + tgUser;
  if (!cname && emailM) cname = emailM[0].split('@')[0].replace(/[._-]+/g, ' ').trim();
  return {
    kind,
    reason,
    taskText: ttext || raw,
    dateLabel: found ? found.label : '',
    dateISO: found ? toISO(found.date) : undefined,
    dateDisplay: found ? displayDate(found.date) : undefined,
    contactName: cname,
    contactPhone: phone,
    contactEmail: emailM ? emailM[0] : '',
    contactTelegram: tgUser,
    noteTitle: firstLine.slice(0, 80) || 'Captura rápida',
    noteBody: raw
  };
}
