// JASPE — Sanitizador HTML whitelist (anti-XSS armazenado)
// Sem dependências: remove <script>/<iframe>/event handlers/javascript: antes
// de qualquer innerHTML ou persistência. Usado pelo editor e pela importação.

const ALLOWED_TAGS = new Set([
  'P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE',
  'SPAN', 'UL', 'OL', 'LI', 'H1', 'H2', 'H3', 'H4', 'DIV', 'IMG',
]);

const ALLOWED_STYLE_PROPS = new Set([
  'font-size', 'font-weight', 'font-style', 'color',
  'background-color', 'text-decoration',
]);

const MAX_HTML_LEN = 500_000; // ~500KB: corpo maior que isso é truncado

function sanitizeStyle(raw: string): string {
  const out: string[] = [];
  for (const part of raw.split(';')) {
    const idx = part.indexOf(':');
    if (idx === -1) continue;
    const prop = part.slice(0, idx).trim().toLowerCase();
    let val = part.slice(idx + 1).trim();
    if (!ALLOWED_STYLE_PROPS.has(prop) || !val) continue;
    const low = val.toLowerCase();
    // Bloqueia vetores via CSS: expression(), javascript:, vbscript:, data: (exceto em img src),
    // -moz-binding, behaviour, url() arbitrário.
    if (
      low.includes('expression') ||
      low.includes('javascript:') ||
      low.includes('vbscript:') ||
      low.includes('behaviour') ||
      low.includes('-moz-binding') ||
      /url\s*\(/.test(low)
    ) continue;
    // font-size: limita a faixa plausível p/ não quebrar layout
    if (prop === 'font-size') {
      const n = parseFloat(val);
      if (!Number.isFinite(n) || n < 7 || n > 72) continue;
      val = `${Math.round(n)}px`;
    }
    // Cores: aceita hex/rgb/rgba/nomes simples — rejeita o resto
    if (prop === 'color' || prop === 'background-color') {
      if (!/^(#[0-9a-f]{3,8}|rgba?\([^)]*\)|[a-z]+)$/i.test(val)) continue;
    }
    out.push(`${prop}:${val}`);
  }
  return out.join(';');
}

function isSafeImgSrc(src: string): boolean {
  const s = src.trim();
  if (!s) return false;
  const low = s.toLowerCase();
  if (low.startsWith('data:image/')) {
    // data:image/jpeg;base64,... — bloqueia svg (pode conter script) e html
    if (low.includes('image/svg')) return false;
    return s.length < 2_500_000; // ~2.5MB: evita estouro de quota
  }
  if (low.startsWith('http://') || low.startsWith('https://')) return true;
  return false;
}

function cleanNode(root: Element): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT);
  const toRemove: Node[] = [];
  const els: Element[] = [];
  let n: Node | null;
  while ((n = walker.nextNode())) {
    if (n.nodeType === Node.COMMENT_NODE) { toRemove.push(n); continue; }
    els.push(n as Element);
  }
  for (const el of els) {
    const tag = el.tagName.toUpperCase();
    if (!ALLOWED_TAGS.has(tag)) {
      // Desembrulha formatação desconhecida (preserva texto), exceto
      // elementos perigosos que devem sumir com o conteúdo.
      const dropEntirely = ['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'FORM', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'LINK', 'META', 'SVG', 'MATH', 'VIDEO', 'AUDIO', 'SOURCE', 'TRACK', 'CANVAS', 'FRAME', 'FRAMESET', 'APPLET', 'BASE'].includes(tag);
      if (dropEntirely) {
        toRemove.push(el);
      } else {
        const parent = el.parentNode;
        if (parent) {
          while (el.firstChild) parent.insertBefore(el.firstChild, el);
          toRemove.push(el);
        }
      }
      continue;
    }
    // Remove todos os atributos exceto style (sanitizado) e src seguro de <img>.
    const styleRaw = el.getAttribute('style');
    const srcRaw = tag === 'IMG' ? el.getAttribute('src') : null;
    // Remove tudo (inclui on*, href, id, class, srcset, etc.)
    for (const attr of Array.from(el.attributes)) el.removeAttribute(attr.name);
    if (styleRaw) {
      const clean = sanitizeStyle(styleRaw);
      if (clean) el.setAttribute('style', clean);
    }
    if (tag === 'IMG') {
      if (srcRaw && isSafeImgSrc(srcRaw)) {
        el.setAttribute('src', srcRaw.trim());
        el.setAttribute('style', sanitizeStyle(el.getAttribute('style') || '') || 'max-width:100%;border-radius:12px;');
        el.setAttribute('alt', '');
      } else {
        toRemove.push(el);
      }
    }
  }
  for (const r of toRemove) {
    try { r.parentNode?.removeChild(r); } catch { /* noop */ }
  }
}

/** Sanitiza HTML de corpo de nota. Nunca lança — em falha retorna string vazia. */
export function sanitizeNoteBody(dirty: unknown): string {
  if (typeof dirty !== 'string' || !dirty) return '';
  let html = dirty;
  if (html.length > MAX_HTML_LEN) html = html.slice(0, MAX_HTML_LEN);
  try {
    const tpl = document.createElement('template');
    // template.content não executa scripts ao fazer parse
    tpl.innerHTML = html;
    cleanNode(tpl.content as unknown as Element);
    // Defesa em profundidade: mesmo após whitelist, remove event handlers
    // residuais e javascript: que tenham escapado por serialização estranha.
    let out = tpl.innerHTML;
    out = out.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
    out = out.replace(/javascript\s*:/gi, '');
    return out;
  } catch {
    return '';
  }
}

/** Sanitiza título/texto puro (sem HTML). */
export function sanitizePlainText(v: unknown, maxLen = 500): string {
  if (typeof v !== 'string') return '';
  return v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').slice(0, maxLen);
}

/** Valida + sanitiza uma nota vinda de backup/importação. Retorna null se inválida. */
export function sanitizeImportedNote(raw: unknown): import('../types').Note | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'number' && typeof r.id !== 'string') return null;
  return {
    id: r.id as number,
    uuid: typeof r.uuid === 'string' ? r.uuid.slice(0, 80) : undefined,
    title: sanitizePlainText(r.title, 300),
    body: sanitizeNoteBody(typeof r.body === 'string' ? r.body : ''),
    date: typeof r.date === 'string' ? r.date.slice(0, 30) : new Date().toLocaleDateString('pt-BR'),
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt.slice(0, 40) : undefined,
    category: sanitizePlainText(r.category, 60) || 'Trabalho',
    pinned: r.pinned === true,
    color: typeof r.color === 'string' ? r.color.slice(0, 30) : undefined,
    paperStyle: typeof r.paperStyle === 'string' ? r.paperStyle.slice(0, 40) : undefined,
    checklist: Array.isArray(r.checklist)
      ? (r.checklist as unknown[]).slice(0, 200).map((c) => {
          const o = (c || {}) as Record<string, unknown>;
          return {
            id: sanitizePlainText(o.id, 80) || Math.random().toString(36).slice(2),
            text: sanitizePlainText(o.text, 300),
            done: o.done === true,
          };
        })
      : undefined,
  } as import('../types').Note;
}
