// Share/clipboard com plugins nativos Capacitor + fallback Web.
// Motivo: navigator.clipboard / navigator.share são pouco confiáveis dentro
// da WebView Android (permissões, share sheet). Plugin nativo primeiro.

import { Capacitor, registerPlugin } from '@capacitor/core';

function isNative(): boolean {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
}

// Abertura de Telegram com tentativa nativa primeiro (tg://) e fallback https.
// Motivo: links t.me caem na página web, que nem sempre enxerga o app
// instalado (Unigram/Desktop) e pede para instalar de novo.

export function cleanTgUser(u: unknown): string {
  return String(u || '')
    .trim()
    .replace(/^@+/, '')
    .replace(/[^A-Za-z0-9_]/g, '');
}

// BUGFIX: o link https://wa.me/<numero> exige o número em formato
// internacional completo (DDI + DDD + número, sem "+"). O app pedia o
// telefone só como "DDD + número" (ex.: 11987654321, 11 dígitos) e mandava
// esse valor direto pro wa.me — o WhatsApp não reconhecia o contato.
// Normaliza para o padrão BR (DDI 55) quando o número já não tiver um DDI:
// 10-11 dígitos (DDD+fixo ou DDD+celular) → prefixa 55.
// Números que já vierem com 12-13 dígitos (já incluem um DDI, BR ou não)
// são mantidos como estão.
export function toWhatsAppDigits(rawPhone: unknown): string {
  const digits = String(rawPhone || '').replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

function attemptNative(tgUrl: string, httpsFallback: string): void {
  let settled = false;
  const timer = window.setTimeout(() => {
    if (!settled && !document.hidden) {
      settled = true;
      window.open(httpsFallback, '_blank');
    }
  }, 1500);
  const cancel = () => {
    settled = true;
    window.clearTimeout(timer);
  };
  // Se o app assumiu (navegador perde foco), cancela o fallback
  window.addEventListener('blur', cancel, { once: true });
  document.addEventListener('visibilitychange', cancel, { once: true });
  const frame = document.createElement('iframe');
  frame.style.display = 'none';
  frame.src = tgUrl;
  document.body.appendChild(frame);
  window.setTimeout(() => frame.remove(), 3000);
}

// Chat direto com @usuário no app; texto vai junto quando cair no site.
export function openTelegramDirect(user: string, text: string): void {
  const msg = encodeURIComponent(text);
  attemptNative(`tg://resolve?domain=${user}`, `https://t.me/${user}?text=${msg}`);
}

// Compartilhamento (sem @): o próprio app mostra o seletor de chat.
export function openTelegramShare(text: string): void {
  const msg = encodeURIComponent(text);
  attemptNative(`tg://msg_url?url=&text=${msg}`, `https://t.me/share/url?url=&text=${msg}`);
}

/** Compartilha texto via sheet nativo (Android) ou Web Share / clipboard. */
export async function shareTextSafe(title: string, text: string): Promise<'shared' | 'copied' | 'failed'> {
  if (isNative()) {
    try {
      const { Share } = await import('@capacitor/share');
      await Share.share({ title, text, dialogTitle: title });
      return 'shared';
    } catch (e) {
      // Usuário cancelou o sheet → não é erro.
      if (String((e as Error)?.message || e).toLowerCase().includes('cancel')) return 'failed';
    }
  }
  try {
    const nav = navigator as Navigator & { share?: (d: { title?: string; text?: string }) => Promise<void> };
    if (typeof nav.share === 'function') {
      await nav.share({ title, text });
      return 'shared';
    }
  } catch { /* cai p/ clipboard */ }
  return (await copyTextSafe(text)) ? 'copied' : 'failed';
}

export interface ShareReceiverPlugin {
  getSharedText(): Promise<{ text: string; subject: string }>;
}

// ── Recebimento de compartilhamento (share target Android) ──
// O plugin nativo ShareReceiver captura ACTION_SEND; aqui só lemos e
// consumimos (leitura única — o plugin limpa após entregar, sem duplicar).
export async function consumeSharedText(): Promise<{ text: string; subject: string | null } | null> {
  if (!isNative()) return null;
  try {
    const ShareReceiver = registerPlugin<ShareReceiverPlugin>('ShareReceiver');
    const res = await ShareReceiver.getSharedText();
    const text = (res?.text || '').trim();
    if (!text) return null;
    const subject = (res?.subject || '').trim() || null;
    return { text, subject };
  } catch {
    return null;
  }
}

export async function copyTextSafe(text: string): Promise<boolean> {
  // 1) Plugin nativo (WebView Android)
  if (isNative()) {
    try {
      const { Clipboard } = await import('@capacitor/clipboard');
      await Clipboard.write({ string: text });
      return true;
    } catch { /* fallback web abaixo */ }
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      return true;
    } catch {
      return false;
    }
  }
}
