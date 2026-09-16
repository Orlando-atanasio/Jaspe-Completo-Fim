// JASPE — Bootstrap nativo Capacitor (splash, status-bar, back-button).
// Sem efeito no navegador; no Android aplica tema e fecha drawers no voltar.

import { Capacitor } from '@capacitor/core';

export function isNativePlatform(): boolean {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
}

export async function initNativeShell(opts: {
  onBack?: () => boolean; // retorna true se consumiu o voltar
}): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide().catch(() => {});
  } catch {}
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
    await StatusBar.setBackgroundColor({ color: '#0E0A09' }).catch(() => {});
  } catch {}
  try {
    const { Keyboard } = await import('@capacitor/keyboard');
    // resize já configurado via capacitor.config.ts (body); aqui só garante
    // que listeners nativos não quebrem o fluxo web.
    void Keyboard;
  } catch {}
  try {
    const { App } = await import('@capacitor/app');
    await App.removeAllListeners().catch(() => {});
    await App.addListener('backButton', () => {
      try {
        if (opts.onBack && opts.onBack()) return;
      } catch { /* cai p/ minimizar */ }
      void App.minimizeApp().catch(() => {});
    });
    // Segurança: minimizou → o visibilitychange do cofre já bloqueia.
    await App.addListener('pause', () => {
      try { document.dispatchEvent(new Event('visibilitychange')); } catch {}
    }).catch(() => {});
  } catch {}
}
