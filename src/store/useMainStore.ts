import { create } from 'zustand';
import { TabType, Note, Contact, Task, Asset, Provento, OfficeDocument, UserProfile } from '../types';
import { newId, newUUID, store, moveToTrash, purgeTrash, loadTrash, TrashedItem } from '../utils/ids';
import { fetchYahooPrice } from '../utils/finance';
import { buildEnvelope, verifyEnvelope, saveBackupFile, todayStamp, ALL_SELECTED, BackupEnvelope } from '../utils/backup';
import { sanitizeNoteBody, sanitizePlainText, sanitizeImportedNote } from '../utils/sanitize';
import { playSynthSound } from '../utils/audio';
import confetti from 'canvas-confetti';
import { initialNotes, initialContacts, initialTodos, initialAssets, initialProventos, initialOfficeDocs, initialProfile } from '../data/initialData';
import { encryptJSON, decryptJSON } from '../utils/crypto';
import { useVaultStore } from './useVaultStore';

export interface MainState {
  // Data State
  notes: Note[];
  contacts: Contact[];
  tasks: Task[];
  assets: Asset[];
  proventos: Provento[];
  documents: OfficeDocument[];
  profile: UserProfile;
  isLightTheme: boolean;

  // UI State
  currentTab: TabType;
  isDrawerOpen: boolean;
  activeEditorNoteId: number | null;
  activeOfficeDocId: number | null;
  docEditorStartsEditing: boolean;
  isContactModalOpen: boolean;
  activeContactModalId: number | null;
  isCredentialModalOpen: boolean;
  activeCredentialModalId: number | null;
  isAssetModalOpen: boolean;
  activeAssetModalId: number | null;
  isPDFImportModalOpen: boolean;
  isTaskDrawerOpen: boolean;
  activeTaskId: number | null;
  isSearchModalOpen: boolean;
  isMessageModalOpen: boolean;
  messageChannel: 'whatsapp' | 'telegram';
  isBackupModalOpen: boolean;
  isProfileModalOpen: boolean;
  isReportModalOpen: boolean;
  isDocCreateOpen: boolean;
  isTrashOpen: boolean;
  trashItems: TrashedItem[];
  alarmQueue: Task[];
  toastMessage: string | null;
  isYahooSyncing: boolean;
  lastSyncInfo: { at: string; ok: number; fail: number; detail: string } | null;
  isFullScreenPhone: boolean;

  // Actions
  showToast: (msg: string) => void;
  triggerConfetti: () => void;
  selectTab: (tab: TabType) => void;
  toggleTheme: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  setIsFullScreenPhone: (val: boolean) => void;

  // Notes
  createNewNote: (folder?: string) => void;
  togglePinNote: (noteId: number) => void;
  saveActiveNote: (updated: Partial<Note>) => void;
  deleteNote: (id: number) => void;
  scheduleNote: (note: Note) => void;
  migrateNoteCategory: (from: string, to: string) => void;
  saveScratchpadAsNote: (text: string) => void;
  consumeSharedText: () => Promise<boolean>;
  setActiveEditorNoteId: (id: number | null) => void;

  // Contacts
  saveContact: (data: Partial<Contact> & { id?: number }) => void;
  deleteContact: (id: number) => void;
  toggleFavoriteContact: (id: number) => void;

  // Tasks
  toggleTask: (id: number) => void;
  moveTaskStatus: (id: number, status: 'Pendente' | 'Em Andamento' | 'Concluída') => void;
  saveTask: (data: Partial<Task> & { id?: number }) => void;
  deleteTask: (id: number) => void;
  setAlarmQueue: (updater: (prev: Task[]) => Task[]) => void;
  setTasks: (updater: (prev: Task[]) => Task[]) => void;

  // Assets
  saveAsset: (data: Partial<Asset> & { id?: number }) => void;
  deleteAsset: (id: number) => void;
  triggerYahooSync: () => Promise<void>;

  // Documents
  openDoc: (doc: OfficeDocument) => void;
  saveOfficeDoc: (id: number, updated: Partial<OfficeDocument>) => void;
  deleteDoc: (id: number) => void;
  unlinkDoc: (id: number) => void;
  createDocWith: (title: string, type: OfficeDocument['type']) => void;
  createDoc: () => void;
  setActiveOfficeDocId: (id: number | null) => void;

  // Profile
  saveProfile: (p: UserProfile) => void;

  // FAB
  handleFABAction: (action: string) => void;

  // Modals
  openContactModal: (id: number | null) => void;
  closeContactModal: () => void;
  openCredentialModal: (id: number | null) => void;
  closeCredentialModal: () => void;
  openAssetModal: (id: number | null) => void;
  closeAssetModal: () => void;
  openPDFImportModal: () => void;
  closePDFImportModal: () => void;
  openTaskDrawer: (id: number | null) => void;
  closeTaskDrawer: () => void;
  openSearchModal: () => void;
  closeSearchModal: () => void;
  toggleSearchModal: () => void;
  openMessageModal: (channel?: 'whatsapp' | 'telegram') => void;
  closeMessageModal: () => void;
  openBackupModal: () => void;
  closeBackupModal: () => void;
  openProfileModal: () => void;
  closeProfileModal: () => void;
  openReportModal: () => void;
  closeReportModal: () => void;
  openDocCreate: () => void;
  closeDocCreate: () => void;
  openTrashModal: () => void;
  closeTrashModal: () => void;
  restoreTrashItem: (id: string) => void;
  deleteTrashItem: (id: string) => void;
  emptyTrash: () => void;

  // Backup
  exportJSON: (sel: any) => Promise<void>;
  exportEncryptedJaspe: (pin: string, sel: any) => Promise<void>;
  importBackupFile: (file: File, pinForJaspe?: string) => Promise<void>;
}

// Module-level variables
let toastTimer: ReturnType<typeof setTimeout> | null = null;
let lastCarteiraSyncAt = 0;

// Init tasks
purgeTrash(); // REQ-40: Purga lixeira >30 dias no boot

// TEMP-DEMO (remover antes do APK final): semeia a lixeira UMA única vez com
// itens fictícios variados (tipos + idades) para avaliação visual da tela.
// Some de vez com o botão "Esvaziar lixeira"; o marcador impede ressemeadura.
const seedDemoTrashOnce = (): void => {
  try {
    if (store.read<boolean>('trash_demo_seeded', false)) return;
    if (loadTrash().length > 0) return;
    const day = 86400000;
    const now = Date.now();
    const ago = (d: number) => new Date(now - d * day).toISOString();
    const demo: TrashedItem[] = [
      { id: 'demo-trash-01', kind: 'note', data: { id: 9001, title: 'Ata — Reunião de condomínio', body: 'Pauta: reforma da portaria.', date: '10/09/2026', category: 'Trabalho' }, deletedAt: ago(2) },
      { id: 'demo-trash-02', kind: 'note', data: { id: 9002, title: 'Ideias de viagem — Jalapão', body: 'Fervedouro, dunas e pôr do sol.', date: '02/09/2026', category: 'Pessoal' }, deletedAt: ago(9) },
      { id: 'demo-trash-03', kind: 'contact', data: { id: 9003, name: 'Marcos Gerente Banco', company: 'Banco Exemplo', phone: '(11) 98888-1234' }, deletedAt: ago(5) },
      { id: 'demo-trash-04', kind: 'contact', data: { id: 9004, name: 'Clínica Odonto Sorriso', company: 'Saúde', phone: '(11) 3333-2211' }, deletedAt: ago(15) },
      { id: 'demo-trash-05', kind: 'task', data: { id: 9005, text: 'Pagar conta de luz', priority: 'Alta', category: 'Finanças', date: '11/09/2026', done: false, status: 'Pendente' }, deletedAt: ago(1) },
      { id: 'demo-trash-06', kind: 'task', data: { id: 9006, text: 'Revisar contrato do carro', priority: 'Urgente', category: 'Pessoal', date: '20/08/2026', done: false, status: 'Pendente' }, deletedAt: ago(27) },
      { id: 'demo-trash-07', kind: 'asset', data: { id: 9007, ticker: 'PETR4', name: 'Petrobras S.A.', qty: 100 }, deletedAt: ago(12) },
      { id: 'demo-trash-08', kind: 'asset', data: { id: 9008, ticker: 'MXRF11', name: 'Maxi Renda FII', qty: 50 }, deletedAt: ago(28) },
      { id: 'demo-trash-09', kind: 'document', data: { id: 9009, title: 'Minuta — Prestação de serviços', type: 'DOCUMENTO', date: '08/09/2026' }, deletedAt: ago(3) },
      { id: 'demo-trash-10', kind: 'document', data: { id: 9010, title: 'Checklist mudança', type: 'DOCUMENTO', date: '25/08/2026' }, deletedAt: ago(20) },
      { id: 'demo-trash-11', kind: 'document', data: { id: 9011, title: 'Roteiro apresentação trimestral', type: 'DOCUMENTO', date: '05/09/2026' }, deletedAt: ago(6) },
      { id: 'demo-trash-12', kind: 'credential', data: { id: 9012, title: 'Banco Exemplo' }, deletedAt: ago(10) },
    ];
    store.write('trash', demo);
    store.write('trash_demo_seeded', true);
  } catch {}
};
seedDemoTrashOnce();

const getInitDocuments = (): OfficeDocument[] => {
  const v = store.read<OfficeDocument[]>('documents', initialOfficeDocs);
  const docs = Array.isArray(v) ? v : initialOfficeDocs;

  // Expurgo definitivo (decisão do usuário): planilhas e apresentações saem do
  // projeto — só DOCUMENTO permanece. Substitui a antiga migração das demos
  // (que inclusive ressuscitava tipos pelo conteúdo; removida junto).
  const next = docs.filter((d) => d && d.type === 'DOCUMENTO');
  if (next.length !== docs.length) {
    try { store.write('documents', next); } catch {}
    return next;
  }
  return docs;
};

const getInitNotes = (): Note[] => {
  const v = store.read<Note[]>('notes', initialNotes);
  return Array.isArray(v) ? v : initialNotes;
};

const getInitContacts = (): Contact[] => {
  const v = store.read<Contact[]>('contacts', initialContacts);
  return Array.isArray(v) ? v : initialContacts;
};

const getInitTasks = (): Task[] => {
  const v = store.read<Task[]>('todos', initialTodos);
  return Array.isArray(v) ? v : initialTodos;
};

const getInitAssets = (): Asset[] => {
  const v = store.read<Asset[]>('assets', initialAssets);
  const base = Array.isArray(v) ? v : [...initialAssets];
  // Usuário zerou a carteira de propósito: não ressuscita seeds de teste.
  try {
    if (store.read('wallet_emptied_by_user', null)) return base;
  } catch {}
  // Migração de teste (temporária): garante que os ativos [TESTE] apareçam
  // mesmo em aparelhos com carteira já salva — só adiciona ticker ausente.
  const have = new Set(base.map((a) => (a?.ticker || '').trim().toUpperCase()));
  const missing = initialAssets.filter((a) => !have.has((a.ticker || '').trim().toUpperCase()));
  if (missing.length === 0) return base;
  const merged = [...base, ...missing];
  try { store.write('assets', merged); } catch {}
  return merged;
};

const getInitProventos = (): Provento[] => {
  const v = store.read<Provento[]>('proventos', initialProventos);
  return Array.isArray(v) ? v : initialProventos;
};

const getInitProfile = (): UserProfile => {
  const v = store.read<UserProfile>('profile', initialProfile);
  return v && typeof v === 'object' ? v : initialProfile;
};

const getInitTheme = (): boolean => {
  try { return localStorage.getItem('jaspe_theme') === 'light'; } catch { return false; }
};

export const useMainStore = create<MainState>()((set, get) => ({
  // Data State Initializers
  notes: getInitNotes(),
  contacts: getInitContacts(),
  tasks: getInitTasks(),
  assets: getInitAssets(),
  proventos: getInitProventos(),
  documents: getInitDocuments(),
  profile: getInitProfile(),
  isLightTheme: getInitTheme(),

  // UI State Initializers
  currentTab: 'dashboard',
  isDrawerOpen: false,
  activeEditorNoteId: null,
  activeOfficeDocId: null,
  docEditorStartsEditing: false,
  isContactModalOpen: false,
  activeContactModalId: null,
  isCredentialModalOpen: false,
  activeCredentialModalId: null,
  isAssetModalOpen: false,
  activeAssetModalId: null,
  isPDFImportModalOpen: false,
  isTaskDrawerOpen: false,
  activeTaskId: null,
  isSearchModalOpen: false,
  isMessageModalOpen: false,
  messageChannel: 'whatsapp',
  isBackupModalOpen: false,
  isProfileModalOpen: false,
  isReportModalOpen: false,
  isDocCreateOpen: false,
  isTrashOpen: false,
  trashItems: loadTrash(),
  alarmQueue: [],
  toastMessage: null,
  isYahooSyncing: false,
  lastSyncInfo: null,
  isFullScreenPhone: false,

  // Actions
  showToast: (msg) => {
    set({ toastMessage: msg });
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { set({ toastMessage: null }); }, 3200);
  },

  triggerConfetti: () => {
    playSynthSound('success');
    confetti({
      particleCount: 120,
      spread: 70,
      origin: { y: 0.8 },
      colors: ['#EA580C', '#10B981', '#3B82F6', '#D97706', '#DB2777']
    });
  },

  selectTab: (tab) => {
    playSynthSound('click');
    set({ currentTab: tab, isDrawerOpen: false });
  },

  toggleTheme: () => {
    playSynthSound('click');
    const prev = get().isLightTheme;
    set({ isLightTheme: !prev });
    try { localStorage.setItem('jaspe_theme', !prev ? 'light' : 'dark'); } catch {}
    get().showToast(!prev ? 'Modo Dia Ativado!' : 'Modo Noite Ativado!');
  },

  openDrawer: () => set({ isDrawerOpen: true }),
  closeDrawer: () => set({ isDrawerOpen: false }),
  setIsFullScreenPhone: (val) => set({ isFullScreenPhone: val }),

  // Notes
  createNewNote: (folder) => {
    const now = new Date();
    const newNote: Note = {
      id: newId(),
      uuid: newUUID(),
      title: '',
      body: '<p><br></p>',
      date: now.toLocaleDateString('pt-BR'),
      updatedAt: now.toISOString(),
      category: folder || 'Trabalho',
      pinned: false,
      color: '#251C1A',
      paperStyle: 'dots-paper'
    };
    set((state) => ({ notes: [newNote, ...state.notes], activeEditorNoteId: newNote.id }));
  },

  togglePinNote: (noteId) => {
    playSynthSound('click');
    set((state) => ({
      notes: state.notes.map((n) => (n.id === noteId ? { ...n, pinned: !n.pinned } : n))
    }));
  },

  saveActiveNote: (updated) => {
    const { activeEditorNoteId } = get();
    if (!activeEditorNoteId) return;
    // Defesa em profundidade: corpo sempre sanitizado antes de persistir,
    // mesmo que o editor já tenha sanitizado na borda (paste/import).
    const safePatch: Partial<Note> = { ...updated };
    if (typeof safePatch.body === 'string') safePatch.body = sanitizeNoteBody(safePatch.body);
    if (typeof safePatch.title === 'string') safePatch.title = sanitizePlainText(safePatch.title, 300);
    set((state) => ({
      notes: state.notes.map((n) => (n.id === activeEditorNoteId ? { ...n, ...safePatch, updatedAt: new Date().toISOString() } : n))
    }));
  },

  deleteNote: (id) => {
    const target = get().notes.find((x) => x.id === id);
    if (target) moveToTrash('note', target);
    set((state) => ({
      notes: state.notes.filter((x) => x.id !== id),
      activeEditorNoteId: state.activeEditorNoteId === id ? null : state.activeEditorNoteId,
      trashItems: loadTrash()
    }));
    get().showToast('Anotação movida p/ lixeira (30 dias).');
  },

  scheduleNote: (note) => {
    // Cria a tarefa de forma síncrona e abre o drawer JÁ apontando p/ ela.
    // O formato anterior (setTimeout 100ms + activeTaskId null) criava tarefa
    // "órfã": o drawer abria um formulário em branco sem vínculo, e salvar
    // gerava DUAS tarefas; fechar em <100ms perdia a criação silenciosamente.
    const newTask: Task = {
      id: newId(),
      uuid: newUUID(),
      text: sanitizePlainText(`Agendado de: ${note.title || 'Anotação'}`, 300),
      priority: 'Média',
      done: false,
      date: new Date().toLocaleDateString('pt-BR'),
      category: 'Trabalho',
      status: 'Pendente',
      type: 'Reunião',
      google: true
    };
    set((state) => ({
      tasks: [newTask, ...state.tasks],
      currentTab: 'tarefas',
      activeEditorNoteId: null,
      activeTaskId: newTask.id,
      isTaskDrawerOpen: true,
    }));
  },

  migrateNoteCategory: (from, to) => {
    set((state) => ({
      notes: state.notes.map((n) =>
        n && n.category === from ? { ...n, category: to, updatedAt: new Date().toISOString() } : n
      )
    }));
  },

  saveScratchpadAsNote: (text) => {
    // Texto puro do scratchpad vira HTML escapado (nunca interpretado como markup).
    const esc = sanitizePlainText(text, 20000)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
    const newNote: Note = {
      id: newId(),
      uuid: newUUID(),
      title: 'Rascunho Capturado',
      body: sanitizeNoteBody(`<p>${esc || '<br>'}</p>`),
      date: new Date().toLocaleDateString('pt-BR'),
      updatedAt: new Date().toISOString(),
      category: 'Ideias',
      pinned: false,
      color: '#BAE6FD',
      paperStyle: 'dots-paper'
    };
    set((state) => ({ notes: [newNote, ...state.notes] }));
    get().triggerConfetti();
    get().showToast('Salvo em Notas Permanentes!');
  },

  consumeSharedText: async () => {
    // Share target Android: texto vindo de outro app vira anotação e o
    // editor abre na hora p/ revisar. Retorna false quando não há nada.
    let shared: { text: string; subject: string | null } | null = null;
    try {
      const mod = await import('../utils/share');
      shared = await mod.consumeSharedText();
    } catch { return false; }
    if (!shared || !shared.text.trim()) return false;
    const title = sanitizePlainText(shared.subject || 'Recebido do Android', 120) || 'Recebido do Android';
    const esc = sanitizePlainText(shared.text, 20000)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
    const newNote: Note = {
      id: newId(),
      uuid: newUUID(),
      title,
      body: sanitizeNoteBody(`<p>${esc || '<br>'}</p>`),
      date: new Date().toLocaleDateString('pt-BR'),
      updatedAt: new Date().toISOString(),
      category: 'Ideias',
      pinned: false,
      color: '#BAE6FD',
      paperStyle: 'dots-paper'
    };
    set((state) => ({ notes: [newNote, ...state.notes], activeEditorNoteId: newNote.id, currentTab: 'anotacoes' }));
    get().triggerConfetti();
    get().showToast('Texto recebido e salvo em Anotações!');
    return true;
  },

  setActiveEditorNoteId: (id) => set({ activeEditorNoteId: id }),

  // Contacts
  saveContact: (contactData) => {
    const id = contactData.id ?? newId();
    set((state) => {
      if (state.contacts.some((c) => c.id === id)) {
        return {
          contacts: state.contacts.map((c) =>
            c.id === id
              ? ({ ...c, ...contactData, id, uuid: c.uuid || (contactData as Contact).uuid || newUUID() } as Contact)
              : c
          ),
        };
      }
      const newC: Contact = {
        id,
        uuid: (contactData as Contact).uuid || newUUID(),
        name: contactData.name || '',
        email: contactData.email || '',
        phone: contactData.phone || '',
        telegram: (contactData.telegram || '').trim(),
        company: contactData.company || 'Geral',
        category: contactData.category || 'Trabalho',
        isFavorite: false
      };
      return { contacts: [newC, ...state.contacts] };
    });
  },

  deleteContact: (id) => {
    const target = get().contacts.find((x) => x.id === id);
    if (target) moveToTrash('contact', target);
    set((state) => ({ contacts: state.contacts.filter((x) => x.id !== id), trashItems: loadTrash() }));
    get().showToast('Contato movido p/ lixeira (30 dias).');
  },

  toggleFavoriteContact: (id) => {
    playSynthSound('click');
    set((state) => ({
      contacts: state.contacts.map((c) => (c.id === id ? { ...c, isFavorite: !c.isFavorite } : c))
    }));
  },

  // Tasks
  toggleTask: (id) => {
    playSynthSound('click');
    let completed = false;
    set((state) => ({
      tasks: state.tasks.map((t) => {
        if (t.id === id) {
          const nextDone = !t.done;
          if (nextDone) completed = true;
          return { ...t, done: nextDone, status: nextDone ? 'Concluída' : 'Pendente' };
        }
        return t;
      })
    }));
    if (completed) get().triggerConfetti();
  },

  moveTaskStatus: (id, targetStatus) => {
    const isDone = targetStatus === 'Concluída';
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? { ...t, status: targetStatus, done: isDone } : t))
    }));
    if (isDone) {
      get().triggerConfetti();
      get().showToast('Tarefa movida para Concluída!');
    } else {
      playSynthSound('click');
      get().showToast(`Tarefa movida para ${targetStatus}`);
    }
  },

  saveTask: (taskData) => {
    const id = taskData.id ?? newId();
    set((state) => {
      if (state.tasks.some((t) => t.id === id)) {
        return {
          tasks: state.tasks.map((t) =>
            t.id === id ? ({ ...t, ...taskData, id, uuid: t.uuid || (taskData as Task).uuid || newUUID() } as Task) : t
          ),
        };
      }
      const newTask: Task = {
        id,
        uuid: (taskData as Task).uuid || newUUID(),
        text: taskData.text || '',
        priority: taskData.priority || 'Média',
        done: taskData.done || false,
        date: taskData.date || 'Sem prazo',
        dateISO: taskData.dateISO,
        category: taskData.category || 'Geral',
        status: taskData.status || 'Pendente',
        type: taskData.type || 'Tarefa',
        alarm: taskData.alarm,
        google: taskData.google,
        remindBeforeMin: taskData.remindBeforeMin,
        repeatEveryMin: taskData.repeatEveryMin
      };
      return { tasks: [newTask, ...state.tasks] };
    });
  },

  deleteTask: (id) => {
    const target = get().tasks.find((x) => x.id === id);
    if (target) moveToTrash('task', target);
    set((state) => ({ tasks: state.tasks.filter((x) => x.id !== id), trashItems: loadTrash() }));
    get().showToast('Tarefa movida p/ lixeira (30 dias).');
  },

  setAlarmQueue: (updater) => set((state) => ({ alarmQueue: updater(state.alarmQueue) })),
  setTasks: (updater) => set((state) => ({ tasks: updater(state.tasks) })),

  // Assets
  saveAsset: (assetData) => {
    const id = assetData.id ?? newId();
    let created = false;
    set((state) => {
      if (state.assets.some((a) => a.id === id)) {
        return { assets: state.assets.map((a) => (a.id === id ? ({ ...a, ...assetData, id } as Asset) : a)) };
      }
      created = true;
      const newA: Asset = {
        id,
        uuid: newUUID(),
        ticker: assetData.ticker || '',
        name: assetData.name || '',
        cnpj: assetData.cnpj || '',
        qty: assetData.qty || 0,
        avgPrice: assetData.avgPrice || 0,
        currentPrice: assetData.currentPrice || assetData.avgPrice || 0,
        category: assetData.category || 'Ações'
      };
      return { assets: [newA, ...state.assets] };
    });
    if (created) {
      try { store.remove('wallet_emptied_by_user'); } catch {}
      get().triggerConfetti();
    }
  },

  deleteAsset: (id) => {
    const target = get().assets.find((x) => x.id === id);
    if (target) moveToTrash('asset', target);
    let emptied = false;
    set((state) => {
      const assets = state.assets.filter((x) => x.id !== id);
      // Carteira zerada = sem ativos E sem histórico: limpa proventos e info
      // de sincronização junto (não vão p/ lixeira — são registros derivados).
      emptied = assets.length === 0 && (state.proventos.length > 0 || state.lastSyncInfo !== null);
      return {
        assets,
        trashItems: loadTrash(),
        ...(emptied ? { proventos: [] as Provento[], lastSyncInfo: null } : {}),
      };
    });
    if (emptied) {
      // Trava a migração de seeds de teste: sem isso os ativos [TESTE]
      // ressuscitariam no próximo boot e a carteira nunca ficaria vazia.
      try { store.write('wallet_emptied_by_user', '1'); } catch {}
      get().showToast('Carteira zerada — histórico limpo.');
    } else {
      get().showToast('Ativo movido p/ lixeira (30 dias).');
    }
  },

  triggerYahooSync: async () => {
    playSynthSound('click');
    const { assets, showToast, triggerConfetti } = get();
    if (!Array.isArray(assets) || assets.length === 0) { showToast('Nenhum ativo para sincronizar.'); return; }

    if (Date.now() - lastCarteiraSyncAt < 60000) {
      showToast('A carteira já está atualizada.');
      return;
    }

    set({ isYahooSyncing: true });
    try {
      // BUGFIX: cada fetchYahooPrice pode levar até ~15s (cascata Brapi →
      // CoinGecko → proxies Yahoo). Antes o resultado era casado com o ativo
      // pela POSIÇÃO no array (`results[i]` aplicado a `state.assets[i]`).
      // Se o usuário editasse/excluísse/adicionasse um ativo enquanto a
      // sincronização estava em voo, os índices dessincronizavam e a cotação
      // de um ticker era gravada silenciosamente no ativo errado. Agora o
      // pareamento é por `id` (estável), então mutações concorrentes na
      // carteira não corrompem mais o preço de outro ativo.
      const requestedIds = assets.map((a) => a?.id);
      
      // BUGFIX [A3]: limite de concorrência (5 requisições por vez).
      // Disparar 100+ requests simultaneamente causava Rate Limiting
      // nas APIs e esgotava sockets do Android.
      const tasks = assets.map((a) => async () => {
        try {
          const val = await fetchYahooPrice(a?.ticker || '');
          return { status: 'fulfilled' as const, value: val };
        } catch (err) {
          return { status: 'rejected' as const, reason: err };
        }
      });
      const results: Array<PromiseSettledResult<any>> = [];
      let nextIndex = 0;
      const worker = async () => {
        while (nextIndex < tasks.length) {
          const idx = nextIndex++;
          results[idx] = await tasks[idx]();
        }
      };
      await Promise.all(Array.from({ length: 5 }, worker));
      const resultById = new Map<number, (typeof results)[number]>();
      requestedIds.forEach((id, i) => {
        if (id !== undefined && id !== null) resultById.set(id, results[i]);
      });
      let ok = 0;
      let fail = 0;
      set((state) => ({
        assets: state.assets.map((asset) => {
          if (!asset || typeof asset !== 'object') return asset;
          const r = resultById.get(asset.id);
          if (!r) return asset; // ativo criado depois do início da sincronização: nada a aplicar ainda
          if (r.status === 'fulfilled') {
            if (r.value.source !== 'cache' && r.value.source !== 'simulado-offline') ok++;
            return { ...asset, currentPrice: r.value.price, lastQuoteAt: r.value.asOf, quoteSource: r.value.source };
          }
          fail++;
          return asset;
        })
      }));
      set({ lastSyncInfo: { at: new Date().toISOString(), ok, fail, detail: '' } });
      if (ok > 0) {
        lastCarteiraSyncAt = Date.now();
        triggerConfetti();
        showToast('Carteira atualizada com sucesso.');
      } else {
        const reasons = results
          .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
          .map((r) => String((r.reason as Error)?.message || r.reason));
        const detail = reasons[0] ? reasons[0].slice(0, 150) : 'offline';
        set({ lastSyncInfo: { at: new Date().toISOString(), ok, fail, detail } });
        showToast(`Não foi possível atualizar a carteira. Motivo: ${detail}`);
      }
    } catch {
      showToast('Não foi possível atualizar a carteira.');
    } finally {
      set({ isYahooSyncing: false });
    }
  },

  // Documents
  openDoc: (doc) => {
    playSynthSound('click');
    set({ activeOfficeDocId: doc.id, docEditorStartsEditing: false });
  },

  saveOfficeDoc: (id, updated) => {
    set((state) => ({
      documents: state.documents.map((d) => {
        if (d.id !== id) return d;
        const next = { ...d, ...updated, updatedAt: new Date().toISOString() };
        next.sizeBytes = ((next.content || '').length + (next.title || '').length) * 2;
        return next;
      })
    }));
  },

  deleteDoc: (id) => {
    const target = get().documents.find((d) => d.id === id);
    if (target) moveToTrash('document', target);
    set((state) => ({
      documents: state.documents.filter((d) => d.id !== id),
      activeOfficeDocId: state.activeOfficeDocId === id ? null : state.activeOfficeDocId,
      trashItems: loadTrash()
    }));
    get().showToast('Documento movido p/ lixeira (30 dias). Mídia preservada.');
  },

  unlinkDoc: (id) => {
    set((state) => ({
      documents: state.documents.map((d) => (d.id === id ? { ...d, linkedIds: [] } : d))
    }));
    get().showToast('Vínculo removido. Mídia original preservada.');
  },

  createDocWith: (title, type) => {
    playSynthSound('click');
    const templateFor = (type: OfficeDocument['type']) =>
      type === 'APRESENTAÇÃO'
        ? 'Título da apresentação\n---\nPonto 1\n---\nPonto 2'
        : type === 'PLANILHA'
        ? 'Item\tValor\nExemplo\t0'
        : 'Novo documento. Comece a escrever...';

    const iconForNew = (type: OfficeDocument['type']) =>
      type === 'APRESENTAÇÃO' ? 'presentation' : type === 'PLANILHA' ? 'table-2' : 'file-text';

    const safeTitle = title.trim() || `Novo ${type === 'APRESENTAÇÃO' ? 'Apresentação' : type === 'PLANILHA' ? 'Planilha' : 'Documento'} ${get().documents.length + 1}`;

    const newDoc: OfficeDocument = {
      id: newId(),
      uuid: newUUID(),
      title: safeTitle,
      type,
      date: new Date().toLocaleDateString('pt-BR'),
      updatedAt: new Date().toISOString(),
      iconName: iconForNew(type),
      version: 1,
      content: templateFor(type)
    };

    set((state) => ({
      documents: [newDoc, ...state.documents],
      activeOfficeDocId: newDoc.id,
      docEditorStartsEditing: true,
      isDocCreateOpen: false
    }));
    get().showToast(`"${safeTitle}" criado. Editando...`);
  },

  createDoc: () => {
    get().createDocWith('', 'DOCUMENTO');
  },

  setActiveOfficeDocId: (id) => set({ activeOfficeDocId: id }),

  // Profile
  saveProfile: (p) => set({ profile: p }),

  // FAB
  handleFABAction: (action) => {
    const state = get();
    switch (action) {
      case 'Criar Documento':
        // Vai à página Documentos já com o painel de criação aberto.
        get().openDocCreate();
        break;
      case 'Nova Tarefa':
        set({ activeTaskId: null, isTaskDrawerOpen: true });
        break;
      case 'Adicionar Ativo':
        set({ activeAssetModalId: null, isAssetModalOpen: true });
        break;
      case 'Novo Contato':
        set({ activeContactModalId: null, isContactModalOpen: true });
        break;
      case 'Nova Senha': {
        const vaultState = useVaultStore.getState();
        if (!vaultState.isCofreUnlocked) {
          set({ currentTab: 'cofre' });
          state.showToast('Desbloqueie o cofre primeiro!');
        } else {
          set({ activeCredentialModalId: null, isCredentialModalOpen: true });
        }
        break;
      }
      default:
        state.showToast(`Ação executada: ${action}`);
        break;
    }
  },

  // Modals
  openContactModal: (id) => set({ activeContactModalId: id, isContactModalOpen: true }),
  closeContactModal: () => set({ isContactModalOpen: false }),

  openCredentialModal: (id) => set({ activeCredentialModalId: id, isCredentialModalOpen: true }),
  closeCredentialModal: () => set({ isCredentialModalOpen: false }),

  openAssetModal: (id) => set({ activeAssetModalId: id, isAssetModalOpen: true }),
  closeAssetModal: () => set({ isAssetModalOpen: false }),

  openPDFImportModal: () => set({ isPDFImportModalOpen: true }),
  closePDFImportModal: () => set({ isPDFImportModalOpen: false }),

  openTaskDrawer: (id) => set({ activeTaskId: id, isTaskDrawerOpen: true }),
  closeTaskDrawer: () => set({ isTaskDrawerOpen: false }),

  openSearchModal: () => set({ isSearchModalOpen: true }),
  closeSearchModal: () => set({ isSearchModalOpen: false }),
  toggleSearchModal: () => set((state) => ({ isSearchModalOpen: !state.isSearchModalOpen })),

  openMessageModal: (channel = 'whatsapp') => set({ messageChannel: channel, isMessageModalOpen: true }),
  closeMessageModal: () => set({ isMessageModalOpen: false }),

  openBackupModal: () => set({ isBackupModalOpen: true }),
  closeBackupModal: () => set({ isBackupModalOpen: false }),

  openProfileModal: () => set({ isProfileModalOpen: true }),
  closeProfileModal: () => set({ isProfileModalOpen: false }),

  openReportModal: () => set({ isReportModalOpen: true }),
  closeReportModal: () => set({ isReportModalOpen: false }),

  // Lixeira (30 dias): restaurar / excluir definitivo / esvaziar.
  openTrashModal: () => set({ isTrashOpen: true, trashItems: loadTrash() }),
  closeTrashModal: () => set({ isTrashOpen: false }),
  restoreTrashItem: (id) => {
    const state = get();
    const item = state.trashItems.find((t) => t.id === id);
    if (!item) { state.showToast('Item não encontrado na lixeira.'); return; }
    const data = (item.data && typeof item.data === 'object' ? item.data : null) as { id?: unknown } | null;
    if (!data || data.id === undefined) {
      state.showToast('Item inválido — removido da lixeira.');
      get().deleteTrashItem(id);
      return;
    }
    if (item.kind === 'credential') {
      // Senhas vão mascaradas p/ lixeira por segurança — restaurar criaria
      // credencial quebrada. Recuperação real é via backup .jaspe.
      state.showToast('Credencial não volta pela lixeira (mascarada). Restaure pelo backup .jaspe.');
      return;
    }
    if (item.kind === 'document' && (data as { type?: unknown }).type !== 'DOCUMENTO') {
      state.showToast('Tipo eliminado do projeto — não pode voltar.');
      return;
    }
    const applyRestore = (patch: Partial<typeof state>) => {
      set((s) => {
        const nextTrash = s.trashItems.filter((t) => t.id !== id);
        try { store.write('trash', nextTrash); } catch {}
        return { ...patch, trashItems: nextTrash };
      });
    };
    switch (item.kind) {
      case 'note': applyRestore({ notes: [data as Note, ...state.notes] }); break;
      case 'contact': applyRestore({ contacts: [data as Contact, ...state.contacts] }); break;
      case 'task': applyRestore({ tasks: [data as Task, ...state.tasks] }); break;
      case 'asset': applyRestore({ assets: [data as Asset, ...state.assets] }); break;
      case 'document': applyRestore({ documents: [data as OfficeDocument, ...state.documents] }); break;
      default: state.showToast('Tipo desconhecido na lixeira.'); return;
    }
    playSynthSound('success');
    get().showToast('Item restaurado.');
  },
  deleteTrashItem: (id) => {
    set((s) => {
      const next = s.trashItems.filter((t) => t.id !== id);
      try { store.write('trash', next); } catch {}
      return { trashItems: next };
    });
    playSynthSound('click');
    get().showToast('Excluído permanentemente.');
  },
  emptyTrash: () => {
    if (get().trashItems.length === 0) return;
    try { store.write('trash', []); } catch {}
    set({ trashItems: [] });
    playSynthSound('click');
    get().showToast('Lixeira esvaziada.');
  },
  openDocCreate: () => {
    playSynthSound('click');
    set({ currentTab: 'office', isDocCreateOpen: true });
  },
  closeDocCreate: () => set({ isDocCreateOpen: false }),

  // Backup
  exportJSON: async (sel) => {
    const state = get();
    const vaultState = useVaultStore.getState();
    const selection = sel || ALL_SELECTED;

    if (selection.credentials && !vaultState.isCofreUnlocked) {
      state.showToast('Desbloqueie o cofre p/ incluir credenciais.');
      return;
    }

    const fullState = {
      notes: state.notes,
      contacts: state.contacts,
      tasks: state.tasks,
      credentials: vaultState.isCofreUnlocked ? vaultState.credentials : [],
      assets: state.assets,
      proventos: state.proventos,
      documents: state.documents,
      profile: state.profile
    };

    const env = await buildEnvelope(fullState, selection);
    try {
      const how = await saveBackupFile(`jaspe_backup_${todayStamp()}.json`, JSON.stringify(env, null, 2), 'application/json');
      state.triggerConfetti();
      state.showToast(how === 'shared' ? 'Backup pronto — escolha onde salvar.' : 'Backup JSON granular exportado (com SHA-256).');
    } catch {
      state.showToast('Falha ao exportar JSON.');
    }
  },

  exportEncryptedJaspe: async (pin, sel) => {
    const state = get();
    if (!/^\d{4,6}$/.test(pin)) { state.showToast('PIN do backup: 4 a 6 dígitos.'); return; }
    const vaultState = useVaultStore.getState();
    const selection = sel || ALL_SELECTED;

    if (selection.credentials && !vaultState.isCofreUnlocked) {
      state.showToast('Desbloqueie o cofre p/ incluir credenciais.');
      return;
    }

    const fullState = {
      notes: state.notes,
      contacts: state.contacts,
      tasks: state.tasks,
      credentials: vaultState.isCofreUnlocked ? vaultState.credentials : [],
      assets: state.assets,
      proventos: state.proventos,
      documents: state.documents,
      profile: state.profile
    };

    const env = await buildEnvelope(fullState, selection);
    const payload = await encryptJSON(pin, env);
    try {
      const how = await saveBackupFile(`jaspe_backup_${todayStamp()}.jaspe`, JSON.stringify(payload, null, 2), 'application/octet-stream');
      state.triggerConfetti();
      state.showToast(how === 'shared' ? 'Backup .jaspe pronto — escolha onde salvar.' : 'Backup .jaspe AES-256-GCM gerado.');
    } catch {
      state.showToast('Falha ao gerar backup .jaspe.');
    }
  },

  importBackupFile: async (file, pinForJaspe) => {
    const state = get();
    const vaultState = useVaultStore.getState();

    try {
      // Limite anti-DoS: backup maior que 25MB é recusado antes do parse.
      if (file.size > 25 * 1024 * 1024) { state.showToast('Backup muito grande (>25MB).'); return; }
      const text = await file.text();
      if (text.length > 25 * 1024 * 1024) { state.showToast('Backup muito grande.'); return; }
      let parsed: any = null;
      try { parsed = JSON.parse(text); } catch { parsed = null; }
      const looksJaspe = !!parsed && parsed.v === 3 && parsed.salt && parsed.iv && parsed.data;
      let env: BackupEnvelope;

      if (looksJaspe || file.name.endsWith('.jaspe')) {
        if (!looksJaspe) throw new Error('Arquivo .jaspe inválido ou corrompido.');
        if (!pinForJaspe || pinForJaspe.length < 4) { state.showToast('Informe o PIN do .jaspe p/ restaurar.'); return; }
        env = await decryptJSON<BackupEnvelope>(pinForJaspe, parsed);
      } else if (parsed) {
        env = parsed as BackupEnvelope;
      } else {
        throw new Error('Arquivo ilegível: não é um backup .json nem .jaspe.');
      }

      const errors = await verifyEnvelope(env);
      if (errors.length) { state.showToast(errors[0]); return; }
      // A integridade SHA-256 do envelope é checksum de auto-consistência
      // (não é MAC): detecta corrupção acidental, NÃO autentica origem.
      // Por isso todo conteúdo importado é validado + sanitizado abaixo.

      const credInc = env.data?.credentials;
      if (Array.isArray(credInc) && credInc.length && !vaultState.isCofreUnlocked) {
        state.showToast('Desbloqueie o cofre para restaurar credenciais. Demais dados restaurados.');
      }

      const skippedSections: string[] = [];
      const mirroredSections: string[] = [];
      let totalRestored = 0;
      let totalRemoved = 0;
      // Sanitizadores por seção: notes passam por whitelist anti-XSS;
      // demais seções passam por validação estrutural mínima.
      const sanitizeList = (key: string, arr: unknown[]): unknown[] => {
        const cap = (a: unknown[]) => a.slice(0, 5000);
        if (key === 'notes') {
          const out: Note[] = [];
          for (const raw of cap(arr)) {
            const n = sanitizeImportedNote(raw);
            if (n) out.push(n);
          }
          return out;
        }
        if (key === 'documents') {
          // Tipos eliminados não ressuscitam via restore de backup antigo.
          return cap(arr).filter((x) => x && typeof x === 'object' && (x as { id?: unknown }).id !== undefined && (x as { type?: unknown }).type === 'DOCUMENTO');
        }
        return cap(arr).filter((x) => x && typeof x === 'object' && (x as { id?: unknown }).id !== undefined);
      };
      // ESPELHO (snapshot): a seção volta a ser exatamente o que está no
      // backup. O que foi criado depois (ex.: ativos importados do PDF após
      // um backup zerado) é removido. Seções ausentes do backup não são
      // tocadas (backup parcial/granular preservado).
      const restoreList = async (key: string, cur: any[], apply: (merged: any[]) => void) => {
        const inc: unknown = (env as any).data?.[key];
        if (inc == null) return;
        if (!Array.isArray(inc)) { skippedSections.push(key); return; }
        try {
          const clean = sanitizeList(key, inc);
          let removed = 0;
          try {
            const cleanIds = new Set((clean as any[]).map((x: any) => String(x?.id)));
            removed = cur.filter((c: any) => !cleanIds.has(String(c?.id))).length;
          } catch { removed = Math.max(0, cur.length - clean.length); }
          apply(clean as any[]);
          mirroredSections.push(key);
          totalRestored += clean.length;
          totalRemoved += removed;
        } catch { skippedSections.push(key); }
      };

      await restoreList('notes', state.notes, (m) => set({ notes: m }));
      await restoreList('contacts', state.contacts, (m) => set({ contacts: m }));
      await restoreList('tasks', state.tasks, (m) => set({ tasks: m }));
      await restoreList('assets', state.assets, (m) => set({ assets: m }));
      await restoreList('proventos', state.proventos, (m) => set({ proventos: m }));
      await restoreList('documents', state.documents, (m) => set({ documents: m }));

      if (env.data?.profile && typeof env.data.profile === 'object') {
        const p = env.data.profile as Record<string, unknown>;
        set({
          profile: {
            name: sanitizePlainText(p.name, 120) || 'Orlando',
            email: sanitizePlainText(p.email, 160) || '',
            avatarUrl: typeof p.avatarUrl === 'string' ? p.avatarUrl.slice(0, 2_500_000) : '',
            role: sanitizePlainText(p.role, 120),
          } as UserProfile,
        });
      } else if (env.data && 'profile' in (env.data as object)) {
        skippedSections.push('profile');
      }

      if (vaultState.isCofreUnlocked) {
        await restoreList('credentials', vaultState.credentials, (m) => vaultState.setCredentials(m));
      }

      // Trava anti-seed: carteira espelhada p/ vazia não pode ressuscitar
      // os ativos [TESTE] no próximo boot (getInitAssets).
      if (mirroredSections.includes('assets')) {
        const curAssets = get().assets;
        if (curAssets.length === 0) {
          try { store.write('wallet_emptied_by_user', '1'); } catch {}
          set({ lastSyncInfo: null });
        } else {
          try { store.remove('wallet_emptied_by_user'); } catch {}
        }
      }

      // Grava na hora (sem depender do debounce de 500ms).
      try { flushMainStoreNow(); } catch {}

      state.triggerConfetti();
      if (skippedSections.length) {
        state.showToast(`Restauração parcial: puladas (${skippedSections.join(', ')}). Restaurados: ${totalRestored}, removidos: ${totalRemoved}.`);
      } else if (mirroredSections.length === 0) {
        state.showToast(`Nada a restaurar: backup sem seções válidas.`);
      } else {
        state.showToast(`Restauração concluída: ${totalRestored} restaurado(s), ${totalRemoved} removido(s).`);
      }
    } catch (e: any) {
      state.showToast((e && e.message) || 'Falha ao importar backup.');
    }
  }
}));

// Debounced Persistence — dirty flags por fatia.
// O formato anterior comparava (state, prev) SÓ do último aviso: qualquer set
// posterior dentro de 500ms (toast, confete, fechar modal) cancelava o flush
// e a alteração de dados era perdida em silêncio (avatar/config voltavam).
// Aqui a sujeira acumula e o flush grava o estado mais fresco.
const dirtySlices = { notes: false, contacts: false, tasks: false, assets: false, proventos: false, documents: false, profile: false };
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let lastSeenMainState = useMainStore.getState();
useMainStore.subscribe((state) => {
  const prev = lastSeenMainState;
  if (state.notes !== prev.notes) dirtySlices.notes = true;
  if (state.contacts !== prev.contacts) dirtySlices.contacts = true;
  if (state.tasks !== prev.tasks) dirtySlices.tasks = true;
  if (state.assets !== prev.assets) dirtySlices.assets = true;
  if (state.proventos !== prev.proventos) dirtySlices.proventos = true;
  if (state.documents !== prev.documents) dirtySlices.documents = true;
  if (state.profile !== prev.profile) dirtySlices.profile = true;
  lastSeenMainState = state;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    flushMainStoreNow();
  }, 500);
});

// BUGFIX [C1]: flush síncrono — grava imediatamente todas as fatias sujas.
// Chamado nos eventos de saída (visibilitychange, pagehide, appStateChange)
// para garantir que dados nunca se percam quando o Android mata o processo.
export function flushMainStoreNow(): void {
  if (persistTimer) { clearTimeout(persistTimer); persistTimer = null; }
  const s = useMainStore.getState();
  if (dirtySlices.notes) { store.write('notes', s.notes); dirtySlices.notes = false; }
  if (dirtySlices.contacts) { store.write('contacts', s.contacts); dirtySlices.contacts = false; }
  if (dirtySlices.tasks) { store.write('todos', s.tasks); dirtySlices.tasks = false; }
  if (dirtySlices.assets) { store.write('assets', s.assets); dirtySlices.assets = false; }
  if (dirtySlices.proventos) { store.write('proventos', s.proventos); dirtySlices.proventos = false; }
  if (dirtySlices.documents) { store.write('documents', s.documents); dirtySlices.documents = false; }
  if (dirtySlices.profile) { store.write('profile', s.profile); dirtySlices.profile = false; }
}

// Grava dados imediatamente quando o app vai para background ou é fechado.
// Isso cobre: minimizar o app, trocar de aba, fechar o navegador, swipe up
// no gerenciador de tarefas, e o Android matando o processo por falta de RAM.
document.addEventListener('visibilitychange', () => { if (document.hidden) flushMainStoreNow(); });
document.addEventListener('pagehide', flushMainStoreNow);

