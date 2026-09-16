import { create } from 'zustand';
import { Credential } from '../types';
import { createPinVerifier, verifyPin, encryptJSON, decryptJSON } from '../utils/crypto';
import { store, newId, newUUID, moveToTrash } from '../utils/ids';
import { initialCredentials } from '../data/initialData';

// ──────────────────────────────────────────────────────────────────
// useVaultStore — Cofre isolado com AES-256-GCM, rate limiting e auto-lock
// REQ-14/15/16/17/18/19
// ──────────────────────────────────────────────────────────────────

export interface VaultState {
  credentials: Credential[];
  vaultMeta: { salt: string; hash: string; iter: number; createdAt: string } | null;
  isCofreUnlocked: boolean;
  vaultPin: string | null;
  hasLegacyVault: boolean;
  failedAttempts: number;
  lockoutUntil: number;

  setupPin: (pin: string) => Promise<void>;
  unlockVault: (pin: string) => Promise<boolean>;
  verifyCurrentPin: (pin: string) => Promise<boolean>;
  changePin: (currentPin: string, newPin: string) => Promise<void>;
  lockVault: (msg?: string) => string | undefined;
  saveCredential: (data: Partial<Credential> & { id?: number }) => void;
  deleteCredential: (id: number) => void;
  setCredentials: (creds: Credential[]) => void;
  initAutoLock: () => () => void;
}

// Snapshot da escrita pendente: PIN + credenciais capturados NO MOMENTO DA
// EDIÇÃO (não no momento do flush). O flush usa a cópia, nunca o estado
// atual — por isso o lock (que zera vaultPin/credentials) não invalida a
// gravação. Declarado antes do store p/ lockVault poder referenciar.
let encryptTimer: ReturnType<typeof setTimeout> | null = null;
let vaultCredsDirty = false;
let pendingCreds: Credential[] | null = null;
let pendingPin: string | null = null;
let lastSeenVaultCreds: Credential[] = [];

export const useVaultStore = create<VaultState>()((set, get) => ({
  credentials: [],
  vaultMeta: store.read<{ salt: string; hash: string; iter: number; createdAt: string } | null>('vault_meta', null),
  isCofreUnlocked: false,
  vaultPin: null,
  setCredentials: (creds: Credential[]) => set({ credentials: creds }),
  hasLegacyVault: (() => {
    try { return !!localStorage.getItem('jaspe_credentials') && !localStorage.getItem('jaspe_credentials_enc'); }
    catch { return false; }
  })(),
  failedAttempts: 0,
  lockoutUntil: 0,

  // ── Setup PIN (primeiro acesso — REQ-16) ──────────────────────
  setupPin: async (pin: string) => {
    if (!/^\d{4,6}$/.test(pin)) {
      throw new Error('O PIN deve ter entre 4 e 6 dígitos');
    }
    try {
      const verifier = await createPinVerifier(pin);

      // Migração legada: se há credenciais em texto claro, cifra agora
      let src = initialCredentials;
      const legacyRaw = localStorage.getItem('jaspe_credentials');
      if (legacyRaw) {
        try { src = JSON.parse(legacyRaw); } catch { /* keep initialCredentials */ }
      }
      const data = src && src.length ? src : initialCredentials;

      const payload = await encryptJSON(pin, data);
      localStorage.setItem('jaspe_credentials_enc', JSON.stringify(payload));
      localStorage.removeItem('jaspe_credentials');
      store.write('vault_meta', verifier);

      set({
        vaultMeta: verifier,
        hasLegacyVault: false,
        isCofreUnlocked: true,
        vaultPin: pin,
        credentials: data,
        failedAttempts: 0,
        lockoutUntil: 0,
      });
      pendingPin = pin;
    } catch (error) {
      // Rollback: não declara sucesso
      set({ isCofreUnlocked: false, vaultPin: null });
      throw new Error('Falha ao proteger o cofre. Tente novamente.');
    }
  },

  // ── Unlock com rate limiting (5 tentativas → bloqueio 30s) ──
  unlockVault: async (pin: string) => {
    const { failedAttempts, lockoutUntil, vaultMeta, hasLegacyVault, credentials: curCreds } = get();

    // Rate limiting check
    if (Date.now() < lockoutUntil) return false;
    // SECURITY FIX: janela de bloqueio já cumprida (ou nunca houve) → zera o
    // contador ANTES de decidir se bloqueia de novo. Sem isso, toda chamada
    // feita depois do bloqueio de 30s expirar caía direto no
    // "failedAttempts >= 5" (sem nunca chamar verifyPin) e renovava o
    // bloqueio por mais 30s indefinidamente — trancando o cofre mesmo com o
    // PIN correto, até o app ser reiniciado.
    let attempts = failedAttempts;
    if (lockoutUntil > 0 && Date.now() >= lockoutUntil) {
      attempts = 0;
      set({ failedAttempts: 0, lockoutUntil: 0 });
    }
    if (attempts >= 5) {
      set({ lockoutUntil: Date.now() + 30000 });
      return false;
    }
    if (!vaultMeta) return false;

    const ok = await verifyPin(pin, vaultMeta.salt, vaultMeta.hash);
    if (!ok) {
      const newAttempts = attempts + 1;
      set({ failedAttempts: newAttempts });
      if (newAttempts >= 5) set({ lockoutUntil: Date.now() + 30000 });
      return false;
    }

    try {
      const encRaw = localStorage.getItem('jaspe_credentials_enc');
      if (encRaw) {
        const dec = await decryptJSON<Credential[]>(pin, JSON.parse(encRaw));
        set({ credentials: Array.isArray(dec) ? dec : [] });
      } else if (hasLegacyVault) {
        // Migra legado: cifra e salva
        const payload = await encryptJSON(pin, curCreds);
        localStorage.setItem('jaspe_credentials_enc', JSON.stringify(payload));
        localStorage.removeItem('jaspe_credentials');
        set({ hasLegacyVault: false });
      }
    } catch { return false; }

    set({ vaultPin: pin, isCofreUnlocked: true, failedAttempts: 0, lockoutUntil: 0 });
    pendingPin = pin;
    return true;
  },

  // ── Verifica PIN atual sem efeitos colaterais (fluxo trocar PIN) ──
  verifyCurrentPin: async (pin: string) => {
    const { vaultMeta, isCofreUnlocked } = get();
    if (!isCofreUnlocked || !vaultMeta) return false;
    return verifyPin(pin, vaultMeta.salt, vaultMeta.hash);
  },

  // ── Trocar PIN com cofre aberto: re-verifica, recifra tudo com o novo PIN ──
  changePin: async (currentPin: string, newPin: string) => {
    if (!/^\d{4,6}$/.test(newPin)) {
      throw new Error('O novo PIN deve ter entre 4 e 6 dígitos');
    }
    const { vaultMeta, credentials, isCofreUnlocked } = get();
    if (!isCofreUnlocked || !vaultMeta) {
      throw new Error('Cofre bloqueado. Desbloqueie para trocar o PIN.');
    }
    const ok = await verifyPin(currentPin, vaultMeta.salt, vaultMeta.hash);
    if (!ok) throw new Error('PIN atual incorreto.');
    if (currentPin === newPin) throw new Error('O novo PIN deve ser diferente do atual.');
    const verifier = await createPinVerifier(newPin);
    const payload = await encryptJSON(newPin, credentials);
    localStorage.setItem('jaspe_credentials_enc', JSON.stringify(payload));
    store.write('vault_meta', verifier);
    set({ vaultMeta: verifier, vaultPin: newPin, failedAttempts: 0, lockoutUntil: 0 });
    pendingPin = newPin;
    // O disco já está recifrado; cancela flush pendente com PIN antigo.
    vaultCredsDirty = false;
    pendingCreds = null;
    if (encryptTimer) { clearTimeout(encryptTimer); encryptTimer = null; }
  },

  // ── Lock — wipe de RAM (com flush garantido: nunca perde edição do debounce) ──
  lockVault: (msg?: string) => {
    // Captura chave + dados ANTES de limpar: o timer de 500ms usaria
    // isCofreUnlocked===false e abortaria, perdendo a edição silenciosamente
    // (ex.: trocou senha e minimizou o app <500ms depois).
    try {
      const s = get();
      if (vaultCredsDirty && pendingPin && pendingCreds) {
        const pinCopy = pendingPin;
        const credsCopy = Array.isArray(pendingCreds) ? [...pendingCreds] : [];
        // BUGFIX [C2]: flush com tentativa síncrona primeiro.
        // A versão anterior era 100% fire-and-forget assíncrona: se o Android
        // matasse o processo antes da Promise resolver, as edições eram perdidas.
        // Agora tentamos gravar os dados em texto (JSON) sincronamente como
        // fallback emergencial, e disparamos a criptografia assíncrona em cima.
        // Se a crypto terminar, sobrescreve com a versão cifrada. Se não
        // terminar (processo morto), pelo menos os dados não se perdem.
        try {
          localStorage.setItem('jaspe_credentials_pending', JSON.stringify(credsCopy));
        } catch { /* storage cheio — prossegue com async */ }
        void (async () => {
          try {
            const payload = await encryptJSON(pinCopy, credsCopy);
            localStorage.setItem('jaspe_credentials_enc', JSON.stringify(payload));
            localStorage.removeItem('jaspe_credentials');
            localStorage.removeItem('jaspe_credentials_pending');
          } catch (e) { console.warn('[vault] falha no flush pré-lock', e); }
        })();
      } else if (s.isCofreUnlocked && s.vaultPin && Array.isArray(s.credentials)) {
        const pinCopy = s.vaultPin;
        const credsCopy = [...s.credentials];
        try {
          localStorage.setItem('jaspe_credentials_pending', JSON.stringify(credsCopy));
        } catch { /* storage cheio */ }
        void (async () => {
          try {
            const payload = await encryptJSON(pinCopy, credsCopy);
            localStorage.setItem('jaspe_credentials_enc', JSON.stringify(payload));
            localStorage.removeItem('jaspe_credentials');
            localStorage.removeItem('jaspe_credentials_pending');
          } catch (e) { console.warn('[vault] falha no flush pré-lock', e); }
        })();
      }
    } catch { /* lock nunca pode falhar por causa do flush */ }
    vaultCredsDirty = false;
    pendingCreds = null;
    pendingPin = null;
    if (encryptTimer) { clearTimeout(encryptTimer); encryptTimer = null; }
    // BUGFIX [A5]: limpa referência global para que o GC libere credenciais
    // da memória. Antes, lastSeenVaultCreds retinha a referência mesmo após
    // o state do Zustand ser zerado.
    lastSeenVaultCreds = [];
    set({ isCofreUnlocked: false, vaultPin: null, credentials: [] });
    return msg;
  },

  // ── CRUD de Credenciais ──
  saveCredential: (data: Partial<Credential> & { id?: number }) => {
    const id = data.id ?? newId();
    set((state) => {
      if (state.credentials.some((c) => c.id === id)) {
        return {
          credentials: state.credentials.map((c) =>
            c.id === id ? ({ ...c, ...data, id, updatedAt: new Date().toISOString() } as Credential) : c
          ),
        };
      }
      const newCred: Credential = {
        id,
        uuid: newUUID(),
        title: data.title || '',
        username: data.username || '',
        pass: data.pass || '',
        category: data.category || 'Trabalho',
        url: data.url || '',
        notes: data.notes || '',
        updatedAt: new Date().toISOString(),
      };
      return { credentials: [newCred, ...state.credentials] };
    });
  },

  // ── Delete com mascaramento total (SECURITY FIX) ──
  deleteCredential: (id: number) => {
    const state = get();
    if (!state.isCofreUnlocked) return;
    const t = state.credentials.find((c) => c.id === id);
    if (t) {
      // Mascara TODOS os campos sensíveis antes de enviar para a lixeira
      moveToTrash('credential', { ...t, pass: '***', notes: '***', url: '***', username: '***' });
    }
    set({ credentials: state.credentials.filter((c) => c.id !== id) });
  },

  // ── Auto-lock por inatividade (2min) e app oculto (REQ-19) ──
  initAutoLock: () => {
    let lastActivity = Date.now();
    const touch = () => { lastActivity = Date.now(); };

    const evts = ['pointerdown', 'keydown', 'touchstart'] as const;
    evts.forEach((e) => window.addEventListener(e, touch, { passive: true }));

    const timer = setInterval(() => {
      if (get().isCofreUnlocked && Date.now() - lastActivity > 2 * 60 * 1000) {
        get().lockVault('Bloqueio automático (2 min sem atividade).');
      }
    }, 10000);

    const onHide = () => {
      if (document.hidden && get().isCofreUnlocked) {
        get().lockVault('Bloqueio automático (app oculto).');
      }
    };
    document.addEventListener('visibilitychange', onHide);

    return () => {
      evts.forEach((e) => window.removeEventListener(e, touch));
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onHide);
    };
  },
}));

// ── Persistência cifrada com debounce + snapshot (anti-corrida lock) ──
// Captura PIN + credenciais no momento da mutação. O flush usa a CÓPIA,
// nunca o estado vivo — lockVault() pode zerar a RAM à vontade que a
// gravação pendente continua válida. Sets posteriores (toasts etc.) só
// adiam o timer sem cancelar a sujeira, como no useMainStore.
lastSeenVaultCreds = useVaultStore.getState().credentials;
useVaultStore.subscribe((state) => {
  const credsChanged = state.credentials !== lastSeenVaultCreds;
  lastSeenVaultCreds = state.credentials;
  if (credsChanged && state.isCofreUnlocked && state.vaultPin) {
    // Edição com cofre aberto → congela cópia p/ o flush.
    vaultCredsDirty = true;
    pendingPin = state.vaultPin;
    pendingCreds = Array.isArray(state.credentials) ? [...state.credentials] : [];
  } else if (credsChanged && !state.isCofreUnlocked) {
    // Transição p/ bloqueado (wipe de RAM): NÃO sobrescreve o snapshot
    // pendente com []. O flush pré-lock dentro de lockVault() já cuidou
    // da gravação; o timer abaixo usa pendingPin/pendingCreds se ainda sujo.
  }
  if (!vaultCredsDirty || !pendingPin || !pendingCreds) return;
  if (encryptTimer) clearTimeout(encryptTimer);
  encryptTimer = setTimeout(async () => {
    const pinCopy = pendingPin;
    const credsCopy = pendingCreds ? [...pendingCreds] : null;
    vaultCredsDirty = false;
    pendingCreds = null;
    // Mantém pendingPin p/ próximas edições? Não — limpa só se bloqueado.
    // Se ainda desbloqueado, o PIN vivo continua valendo; se bloqueado,
    // lockVault já limpou. Aqui só precisamos da cópia.
    if (!pinCopy || !credsCopy) return;
    try {
      const payload = await encryptJSON(pinCopy, credsCopy);
      localStorage.setItem('jaspe_credentials_enc', JSON.stringify(payload));
      localStorage.removeItem('jaspe_credentials');
    } catch (e) { console.warn('[vault] falha ao cifrar', e); }
  }, 500);
});
