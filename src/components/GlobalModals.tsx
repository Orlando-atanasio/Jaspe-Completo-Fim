import React, { useState, useEffect } from 'react';
import { cleanTgUser, openTelegramDirect, openTelegramShare, copyTextSafe, toWhatsAppDigits } from '../utils/share';
import {
  Search,
  X,
  Send,
  MessageCircle,
  Shield,
  HardDrive,
  User,
  Crop,
  Printer,
  AlarmClock,
  CheckCircle,
  FileSpreadsheet,
  Upload,
  Download,
  FileJson,
  History,
  Trash2,
  ImagePlus,
  Briefcase,
  Mail,
  Camera,
  Clock,
  KeyRound,
  Loader2,
  AlertTriangle,
  ExternalLink,
  Eye,
  EyeOff
} from 'lucide-react';
import { Note, Task, Contact, Asset, Provento, OfficeDocument, UserProfile, TabType } from '../types';
import { playSynthSound } from '../utils/audio';
import { getBrapiToken, setBrapiToken, testBrapiToken } from '../utils/finance';
import AvatarCropper from './AvatarCropper';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import html2pdf from 'html2pdf.js';

interface GlobalModalsProps {
  // Search Modal
  isSearchOpen: boolean;
  onCloseSearch: () => void;
  notes: Note[];
  tasks: Task[];
  contacts: Contact[];
  assets: Asset[];
  proventos?: Provento[];
  documents?: OfficeDocument[];
  onNavigateTab: (tab: TabType) => void;
  onSelectNote: (id: number) => void;

  // Message Modal
  isMessageOpen: boolean;
  onCloseMessage: () => void;
  initialChannel: 'whatsapp' | 'telegram';

  // Backup Modal (granular + restore seguro REQ-24/26/27/28/29)
  isBackupOpen: boolean;
  onCloseBackup: () => void;
  onExportJSON: (sel?: any) => void | Promise<void>;
  onExportEncryptedJaspe: (pin: string, sel?: any) => void | Promise<void>;
  onImportBackupFile: (file: File, pin?: string) => void | Promise<void>;
  isCofreUnlocked: boolean;
  onUnlockVault: (pin: string) => Promise<boolean>;
  hasPinSetup: boolean;
  failedAttempts: number;

  // Profile Modal
  isProfileOpen: boolean;
  onCloseProfile: () => void;
  profile: UserProfile;
  onSaveProfile: (profile: UserProfile) => void;

  // Report Modal
  isReportOpen: boolean;
  onCloseReport: () => void;

  // Alarm Ringing Modal
  ringingTask: Task | null;
  alarmQueueCount?: number;
  onDismissAlarm: (action: 'conclude' | 'snooze' | 'stop', snoozeMin?: number) => void;

  onShowToast: (msg: string) => void;
  onTriggerConfetti: () => void;
}

export default function GlobalModals({
  isSearchOpen,
  onCloseSearch,
  notes,
  tasks,
  contacts,
  assets,
  proventos = [],
  documents = [],
  onNavigateTab,
  onSelectNote,
  isMessageOpen,
  onCloseMessage,
  initialChannel,
  isBackupOpen,
  onCloseBackup,
  onExportJSON,
  onExportEncryptedJaspe,
  onImportBackupFile,
  isCofreUnlocked,
  onUnlockVault,
  hasPinSetup,
  failedAttempts,
  isProfileOpen,
  onCloseProfile,
  profile,
  onSaveProfile,
  isReportOpen,
  onCloseReport,
  ringingTask,
  alarmQueueCount = 0,
  onDismissAlarm,
  onShowToast,
  onTriggerConfetti
}: GlobalModalsProps) {
  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Message state
  const [selectedContactName, setSelectedContactName] = useState(
    (Array.isArray(contacts) && contacts[0]?.name) || ''
  );
  const [messageText, setMessageText] = useState('');
  const [channel, setChannel] = useState<'whatsapp' | 'telegram'>(initialChannel);

  // Report print state (evita duplo clique enquanto o documento é gerado)
  const [isPrinting, setIsPrinting] = useState(false);

  // Desbloqueio do cofre dentro da Central de Backup (REQ: funcionar aqui,
  // sem precisar ir até a aba Cofre). Separado do PIN do ARQUIVO .jaspe.
  const [vaultPinInput, setVaultPinInput] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);
  // No APK (WebView) não existe diálogo de impressão — lá o fluxo é gerar o
  // PDF de verdade e entregar ao compartilhamento do sistema (salvar/abrir).
  const isNativeApp = Capacitor.isNativePlatform();

  // Canal escolhido lá fora (botões WhatsApp/Telegram da aba)
  useEffect(() => {
    if (isMessageOpen) setChannel(initialChannel);
  }, [isMessageOpen, initialChannel]);

  // Backup state (granular REQ-26 + restore REQ-28)
  const [backupPin, setBackupPin] = useState('');
  const [restorePin, setRestorePin] = useState('');
  const [sel, setSel] = useState({ notes: true, contacts: true, tasks: true, credentials: true, assets: true, proventos: true, documents: true, profile: true });
  const fileRef = React.useRef<HTMLInputElement | null>(null);
  const toggleSel = (k: keyof typeof sel) => { playSynthSound('click'); setSel((s) => ({ ...s, [k]: !s[k] })); };

  // Profile state
  const [profName, setProfName] = useState(profile?.name || "");
  const [profEmail, setProfEmail] = useState(profile?.email || "");
  const [profRole, setProfRole] = useState(profile?.role || "");
  // null = não tocado (vale o salvo); '' = removido explicitamente
  const [profAvatar, setProfAvatar] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const avatarFileRef = React.useRef<HTMLInputElement | null>(null);

  // Token da Brapi (cotações) — guardado à parte do perfil (localStorage
  // `jaspe_brapi_token`), pra sobreviver a updates do app e poder ser
  // trocado pelo próprio usuário a qualquer momento, sem precisar de nova
  // build. Ver utils/finance.ts.
  const [brapiTokenInput, setBrapiTokenInput] = useState('');
  const [showBrapiToken, setShowBrapiToken] = useState(false);
  const [brapiTestState, setBrapiTestState] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [brapiTestMsg, setBrapiTestMsg] = useState('');

  // Recarrega ao abrir (sem stale do save anterior)
  useEffect(() => {
    if (isProfileOpen) {
      setProfName(profile?.name || "");
      setProfEmail(profile?.email || "");
      setProfRole(profile?.role || "");
      setProfAvatar(null);
      setCropSrc(null);
      setBrapiTokenInput(getBrapiToken());
      setBrapiTestState('idle');
      setBrapiTestMsg('');
    }
  }, [isProfileOpen]);

  const handleSaveBrapiToken = () => {
    playSynthSound('click');
    setBrapiToken(brapiTokenInput);
    onShowToast(brapiTokenInput.trim() ? 'Token da Brapi salvo neste aparelho.' : 'Token removido — voltando ao modo limitado (4 ativos de teste).');
  };

  const handleTestBrapiToken = async () => {
    playSynthSound('click');
    setBrapiTestState('testing');
    setBrapiTestMsg('');
    const r = await testBrapiToken(brapiTokenInput);
    setBrapiTestState(r.ok ? 'ok' : 'error');
    setBrapiTestMsg(r.message);
  };

  const handleAvatarFile = (f: File | undefined | null) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) { onShowToast('Selecione uma imagem.'); return; }
    if (f.size > 5 * 1024 * 1024) { onShowToast('Imagem maior que 5MB.'); return; }
    const r = new FileReader();
    r.onload = () => {
      const url = String(r.result || '');
      if (!url) { onShowToast('Falha ao ler imagem.'); return; }
      setCropSrc(url);
    };
    r.onerror = () => onShowToast('Falha ao ler imagem.');
    r.readAsDataURL(f);
  };

  // Search matches (blindada p/ registros legado/importados)
  const safeNotes = Array.isArray(notes) ? notes : [];
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const safeContacts = Array.isArray(contacts) ? contacts : [];
  const safeAssets = Array.isArray(assets) ? assets : [];
  const safeProventos = Array.isArray(proventos) ? proventos : [];
  const safeDocuments = Array.isArray(documents) ? documents : [];
  const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const stripHtml = (s: string) => (s || '').replace(/<[^>]*>/g, '');
  const q = norm(searchQuery);
  const qDigits = (searchQuery || '').replace(/\D/g, '');
  const matchedNotes = searchQuery
    ? safeNotes.filter(
        (n) =>
          norm(n?.title).includes(q) ||
          norm(stripHtml(n?.body)).includes(q)
      )
    : [];
  const matchedTasks = searchQuery
    ? safeTasks.filter((t) => norm(t?.text).includes(q))
    : [];
  const matchedContacts = searchQuery
    ? safeContacts.filter(
        (c) =>
          norm(c?.name).includes(q) ||
          norm(c?.company).includes(q) ||
          (qDigits !== '' && (c?.phone || '').replace(/\D/g, '').includes(qDigits))
      )
    : [];
  const matchedAssets = searchQuery
    ? safeAssets.filter((a) => norm(a?.ticker).includes(q))
    : [];

  const applyTemplate = (type: 'cobranca' | 'reuniao') => {
    playSynthSound('click');
    if (type === 'cobranca') {
      setMessageText(
        `Olá ${selectedContactName || 'tudo bem'}, gostaria de lembrá-lo gentilmente sobre a nota pendente de vencimento do Jaspe. Qualquer dúvida estamos à disposição.`
      );
    } else {
      setMessageText(
        `Olá ${selectedContactName || 'tudo bem'}, confirmo nossa reunião estratégica para alinhar os investimentos e relatórios da nossa biblioteca para esta semana.`
      );
    }
  };

  const sendVia = async () => {
    if (!messageText.trim()) {
      onShowToast('Por favor digite uma mensagem.');
      return;
    }
    playSynthSound('click');
    const target = safeContacts.find((c) => c?.name === selectedContactName);
    if (!target) { onShowToast('Cadastre um contato na aba Contatos primeiro.'); return; }
    const text = encodeURIComponent(messageText.trim());
    if (channel === 'whatsapp') {
      const digits = (target?.phone || '').replace(/\D/g, '');
      if (!digits) {
        onShowToast('Contato sem telefone — complete a ficha primeiro.');
        return;
      }
      window.open(`https://wa.me/${toWhatsAppDigits(digits)}?text=${text}`, '_blank', 'noopener,noreferrer');
      onShowToast(`Abrindo WhatsApp de ${selectedContactName}!`);
    } else {
      const user = cleanTgUser(target?.telegram);
      if (user) {
        await copyTextSafe(messageText.trim());
        openTelegramDirect(user, messageText.trim());
        onShowToast(`Abrindo Telegram de ${selectedContactName}! (texto copiado — é só colar)`);
      } else {
        openTelegramShare(messageText.trim());
        onShowToast('Abrindo Telegram — escolha o chat! (dica: salve o @ na ficha)');
      }
    }
    onTriggerConfetti();
    onCloseMessage();
    setMessageText('');
  };

  const handleSaveProfile = () => {
    playSynthSound('success');
    onSaveProfile({
      ...profile,
      name: profName.trim() || 'Orlando',
      email: profEmail.trim() || 'orlando@jaspe.app',
      role: profRole.trim(),
      avatarUrl: profAvatar ?? profile?.avatarUrl ?? ''
    });
    onCloseProfile();
    onShowToast('Alterações de perfil salvas com sucesso!');
  };

  // ── Relatório: impressão via documento isolado (técnica padrão p/ SPAs) ──
  // Por que não window.print() direto no modal:
  // 1) imprimiria o app inteiro (emulador 390px, tema escuro, modal cortado);
  // 2) containers com max-height/overflow cortam o conteúdo na impressão;
  // 3) bordas/fundos Tailwind somem no PDF sem "gráficos de fundo" ativado.
  // A solução: gerar um HTML autocontido (CSS inline, sem Tailwind) num
  // iframe oculto e imprimir SÓ o iframe. Preview (tela) e PDF ficam
  // independentes — cada um com layout adequado ao meio.
  const escHtml = (v: unknown): string =>
    String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const brl = (v: unknown): string =>
    `R$ ${(Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const plain = (v: unknown, max = 220): string =>
    stripHtml(String(v ?? '')).replace(/\s+/g, ' ').trim().slice(0, max);

  const buildReportHtml = (): string => {
    const generatedAt = new Date().toLocaleString('pt-BR');
    const generatedDate = new Date().toLocaleDateString('pt-BR');
    const userName = profile?.name || 'Usuário';
    const pinnedNotes = safeNotes.filter((n) => n && n.pinned);
    const pendingTasks = safeTasks.filter((t) => t && !t.done);
    const totalProventos = safeProventos.reduce((acc, p) => acc + (Number(p?.amount) || 0), 0);

    const LIMITS = { assets: 100, notes: 20, tasks: 40, contacts: 40, proventos: 30, documents: 30 };
    const more = (shown: number, total: number) =>
      total > shown ? `<p class="more">… e mais ${total - shown} registro(s).</p>` : '';

    // Mesmas cores do preview: pílula por prioridade (vermelho/laranja/âmbar/verde).
    const pillClass = (p: unknown): string =>
      p === 'Urgente' ? 'pill-red' : p === 'Alta' ? 'pill-orange' : p === 'Média' ? 'pill-amber' : 'pill-green';

    const joinMeta = (parts: unknown[]): string =>
      parts.map((x) => escHtml(x || '')).filter((s) => s && s !== '—').join(' &nbsp; ');

    const assetRows = safeAssets.slice(0, LIMITS.assets).map((a) => `
      <tr>
        <td><strong>${escHtml(a?.ticker || '—')}</strong></td>
        <td class="num">${escHtml(a?.qty ?? '—')}</td>
        <td class="num">${brl(a?.avgPrice)}</td>
        <td class="num"><span class="emerald">${brl(a?.currentPrice)}</span></td>
        <td class="num"><strong>${brl((Number(a?.qty) || 0) * (Number(a?.currentPrice) || 0))}</strong></td>
        <td>${escHtml(a?.category || '—')}</td>
      </tr>`).join('');

    const noteItems = pinnedNotes.slice(0, LIMITS.notes).map((n) => `
      <div class="card">
        <div class="t">${escHtml(n?.title || 'Sem título')}</div>
        <div class="d">${escHtml(plain(n?.body, 240))}</div>
        <div class="meta">${joinMeta([n?.category, n?.date])}</div>
      </div>`).join('');

    const taskItems = pendingTasks.slice(0, LIMITS.tasks).map((t) => `
      <div class="card">
        <div class="d">${escHtml(t?.text || '—')}</div>
        <div class="meta">${joinMeta([t?.category, t?.date])} &nbsp; <span class="pill ${pillClass(t?.priority)}">${escHtml(t?.priority || '—')}</span></div>
      </div>`).join('');

    const contactItems = safeContacts.slice(0, LIMITS.contacts).map((c) => `
      <div class="card">
        <div class="t">${escHtml(c?.name || '—')}</div>
        ${c?.company ? `<div class="d">${escHtml(c.company)}</div>` : ''}
        <div class="meta">${joinMeta([c?.category, c?.phone, c?.email])}</div>
      </div>`).join('');

    const proventoItems = safeProventos.slice(0, LIMITS.proventos).map((p) => `
      <div class="prov">
        <span class="val">${brl(p?.amount)}</span>
        <strong>${escHtml(p?.ticker || '—')}</strong>
        <span class="meta"> • ${escHtml(p?.type || '—')} • ${escHtml(p?.date || '—')}</span>
      </div>`).join('');

    const docItems = safeDocuments.slice(0, LIMITS.documents).map((d) => `
      <div class="card">
        <div class="t">${escHtml(d?.title || '—')}</div>
        <div class="meta">${joinMeta([d?.type, d?.date || d?.updatedAt])}</div>
      </div>`).join('');

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>JASPE — Relatório Geral (${escHtml(generatedAt)})</title>
<style>
  @page { size: A4; margin: 18mm 10mm 14mm; }
  /* Espelha o preview do modal (fundo branco, serifa, verde/vermelho) e FORÇA
     a impressão das cores mesmo com "gráficos de fundo" desligado no diálogo. */
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #171717; font-size: 10pt; line-height: 1.5; margin: 0; background: #ffffff; }
  table.head { width: 100%; border-collapse: collapse; border-bottom: 2px solid #262626; margin-bottom: 14px; }
  table.head td { vertical-align: middle; padding: 0 0 10px; }
  table.head td.logo-cell { width: 14mm; padding-right: 4mm; }
  .logo { width: 12mm; height: 12mm; display: block; }
  table.head h1 { font-size: 17pt; margin: 0; color: #171717; }
  table.head .sub { font-size: 8.5pt; color: #737373; margin-top: 2px; }
  .badge { display: inline-block; font-family: Arial, Helvetica, sans-serif; font-size: 9pt; font-weight: bold; color: #b91c1c; background: #fee2e2; border-radius: 4px; padding: 2px 8px; white-space: nowrap; }
  .patrimonio { background: #f5f5f5; border-radius: 6px; padding: 10px 12px; font-size: 10pt; font-weight: 600; margin-bottom: 4px; }
  .patrimonio strong { float: right; color: #047857; }
  h2 { font-size: 12pt; color: #262626; border-bottom: 1px solid #d4d4d4; padding-bottom: 4px; margin: 18px 0 8px; page-break-after: avoid; }
  table.data { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
  table.data thead { display: table-header-group; }
  table.data th { font-size: 9pt; text-align: left; border-bottom: 2px solid #262626; padding: 6px 8px 6px 0; }
  table.data th.num, table.data td.num { text-align: right; }
  table.data td { font-size: 9.5pt; color: #525252; border-bottom: 1px solid #e5e5e5; padding: 6px 8px 6px 0; vertical-align: top; }
  table.data tr { page-break-inside: avoid; }
  .num { white-space: nowrap; }
  .emerald { color: #047857; }
  .card { background: #fafafa; border: 1px solid #e5e5e5; border-radius: 8px; padding: 8px 10px; margin-bottom: 6px; page-break-inside: avoid; font-size: 9.5pt; }
  .card .t { font-weight: bold; color: #262626; }
  .card .d { color: #525252; }
  .card .meta { font-size: 8pt; color: #a3a3a3; margin-top: 2px; }
  .pill { display: inline-block; font-family: Arial, Helvetica, sans-serif; font-size: 8pt; font-weight: bold; border-radius: 4px; padding: 1px 6px; }
  .pill-red { background: #fee2e2; color: #b91c1c; }
  .pill-orange { background: #ffedd5; color: #c2410c; }
  .pill-amber { background: #fef3c7; color: #b45309; }
  .pill-green { background: #dcfce7; color: #15803d; }
  .prov { background: #fafafa; border: 1px solid #e5e5e5; border-radius: 8px; padding: 8px 10px; margin-bottom: 6px; page-break-inside: avoid; font-size: 9.5pt; }
  .prov .val { float: right; color: #047857; font-weight: bold; white-space: nowrap; }
  .prov .meta { color: #525252; }
  .empty { color: #a3a3a3; text-align: center; font-style: italic; font-size: 9pt; padding: 6px 0; }
  .more { color: #a3a3a3; text-align: center; font-style: italic; font-size: 8.5pt; }
  .total-line { text-align: right; font-size: 10pt; margin: 4px 0 0; }
  .footer { border-top: 1px solid #f5f5f5; margin-top: 14px; padding-top: 8px; font-family: Arial, Helvetica, sans-serif; font-size: 8pt; color: #a3a3a3; text-align: center; font-style: italic; }
</style>
</head>
<body>
  <table class="head"><tr>
    <td class="logo-cell"><img class="logo" src="/logo.svg" alt="Jaspe" /></td>
    <td>
      <h1>JASPE — RELATÓRIO GERAL COMPLETO</h1>
      <div class="sub">Painel Consolidado de Informações &amp; Patrimônio — ${escHtml(generatedDate)} • ${escHtml(userName)}${profile?.email ? ` • ${escHtml(profile.email)}` : ''}</div>
    </td>
    <td style="text-align:right;"><span class="badge">JASPE</span></td>
  </tr></table>

  <h2>1. Carteira de Ativos &amp; Finanças</h2>
  <div class="patrimonio"><span>Patrimônio Bruto Total:</span><strong>${brl(totalPatrimonio)}</strong></div>
  ${safeAssets.length === 0
      ? '<p class="empty">Nenhum ativo cadastrado.</p>'
      : `<table class="data">
          <thead><tr><th>Ticker</th><th class="num">Qtd</th><th class="num">P. médio</th><th class="num">P. atual</th><th class="num">Valor total</th><th>Categoria</th></tr></thead>
          <tbody>${assetRows}</tbody>
        </table>${more(LIMITS.assets, safeAssets.length)}`}

  <h2>2. Anotações (${pinnedNotes.length} fixadas de ${safeNotes.length} total)</h2>
  ${pinnedNotes.length === 0
      ? `<p class="empty">${safeNotes.length === 0 ? 'Nenhuma anotação cadastrada.' : 'Nenhuma anotação fixada.'}</p>`
      : `${noteItems}${more(LIMITS.notes, pinnedNotes.length)}`}

  <h2>3. Tarefas (${pendingTasks.length} pendentes de ${safeTasks.length} total)</h2>
  ${pendingTasks.length === 0
      ? '<p class="empty">Nenhuma tarefa pendente.</p>'
      : `${taskItems}${more(LIMITS.tasks, pendingTasks.length)}`}

  <h2>4. Contatos (${safeContacts.length} total)</h2>
  ${safeContacts.length === 0
      ? '<p class="empty">Nenhum contato cadastrado.</p>'
      : `${contactItems}${more(LIMITS.contacts, safeContacts.length)}`}

  <h2>5. Proventos (${safeProventos.length} total)</h2>
  ${safeProventos.length === 0
      ? '<p class="empty">Nenhum provento registrado.</p>'
      : `${proventoItems}
        <p class="total-line"><strong>Total em proventos: ${brl(totalProventos)}</strong></p>
        ${more(LIMITS.proventos, safeProventos.length)}`}

  <h2>6. Documentos (${safeDocuments.length} total)</h2>
  ${safeDocuments.length === 0
      ? '<p class="empty">Nenhum documento cadastrado.</p>'
      : `${docItems}${more(LIMITS.documents, safeDocuments.length)}`}

  <div class="footer">⚠ Senhas e credenciais do Cofre são estritamente omitidas deste relatório por segurança. Relatório gerado localmente pelo app Jaspe.</div>
</body>
</html>`;
  };

  const printViaIframe = (html: string) => {
    const iframe = document.createElement('iframe');
    iframe.title = 'Impressão de relatório Jaspe';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(iframe);
    let removed = false;
    const cleanup = () => {
      if (removed) return;
      removed = true;
      setTimeout(() => iframe.remove(), 300);
    };
    const doc = iframe.contentDocument;
    if (!doc) {
      iframe.remove();
      onShowToast('Não foi possível abrir a impressão.');
      return;
    }
    iframe.contentWindow?.addEventListener('afterprint', cleanup, { once: true });
    doc.open();
    doc.write(html);
    doc.close();
    // Aguarda o parser montar o documento E as imagens (logo) carregarem —
    // sem isso o logo pode sair em branco no PDF. Timeout de 2s como teto.
    const waitForImages = (): Promise<void> =>
      new Promise((resolve) => {
        const imgs = Array.from(doc.images || []);
        if (imgs.length === 0) { resolve(); return; }
        let done = false;
        const finish = () => { if (!done) { done = true; resolve(); } };
        const timer = setTimeout(finish, 2000);
        let pending = imgs.length;
        const oneDown = () => { if (--pending <= 0) { clearTimeout(timer); finish(); } };
        imgs.forEach((img) => {
          if (img.complete && img.naturalWidth !== 0) oneDown();
          else {
            img.addEventListener('load', oneDown, { once: true });
            img.addEventListener('error', oneDown, { once: true });
          }
        });
      });
    void waitForImages().then(() => {
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch {
          onShowToast('Falha ao abrir a impressão.');
          cleanup();
        }
      }, 100);
    });
    setTimeout(cleanup, 15000); // fallback caso afterprint não dispare
  };

  // ── Exportação em PDF no app nativo (Android/iOS) ──
  // WebView não implementa window.print() — por isso no APK nada acontecia.
  // Aqui o PDF é renderizado de verdade (html2canvas → jsPDF, via html2pdf.js),
  // gravado no cache e entregue ao compartilhamento do sistema, onde o usuário
  // escolhe salvar no aparelho, Drive, WhatsApp etc.
  const reportFileName = (): string => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `JASPE-Relatorio-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.pdf`;
  };

  const exportNativePdf = async (): Promise<void> => {
    const fullHtml = buildReportHtml();
    const css = fullHtml.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
    const bodyHtml = new DOMParser().parseFromString(fullHtml, 'text/html').body?.innerHTML ?? '';
    const host = document.createElement('div');
    // Largura ≈ A4 a 96dpi; fora da tela para não interferir no app.
    host.setAttribute('style', 'position:fixed;left:-10000px;top:0;width:794px;background:#ffffff;padding:0;margin:0;');
    host.innerHTML = `<style>${css}</style>${bodyHtml}`;
    document.body.appendChild(host);
    try {
      // Logo como SVG inline: html2canvas não rasteriza <img src=".svg"> com
      // width/height em % de forma confiável; inline com tamanho fixo, sim.
      try {
        const res = await fetch('/logo.svg');
        if (res.ok) {
          const svg = (await res.text()).replace('<svg ', '<svg width="46" height="46" ');
          host.querySelectorAll('img.logo').forEach((img) => {
            const span = document.createElement('span');
            span.innerHTML = svg;
            img.replaceWith(span);
          });
        }
      } catch { /* mantém o <img>; não bloqueia a exportação */ }

      const fileName = reportFileName();
      const dataUri = (await html2pdf().set({
        margin: [10, 10, 12, 10],
        filename: fileName,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        // @ts-expect-error — 'pagebreak' suportado em runtime (v0.14), ausente no type.d.ts da lib
        pagebreak: { mode: ['css', 'legacy'] },
      }).from(host).outputPdf('datauristring')) as unknown as string;
      const base64 = String(dataUri).split(',')[1] || '';
      if (!base64) throw new Error('PDF vazio');
      const saved = await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Cache });
      await Share.share({
        title: 'Relatório JASPE',
        text: 'Relatório geral JASPE em PDF',
        url: saved.uri,
        dialogTitle: 'Abrir ou salvar PDF',
      });
      onTriggerConfetti();
      onShowToast('PDF pronto — escolha onde salvar.');
    } finally {
      host.remove();
    }
  };

  const handlePrint = () => {
    if (isPrinting) return;
    setIsPrinting(true);
    if (isNativeApp) {
      onShowToast('Gerando PDF...');
      exportNativePdf()
        .catch(() => onShowToast('Falha ao gerar o PDF.'))
        .finally(() => setTimeout(() => setIsPrinting(false), 800));
      // Modal permanece aberto: o share-sheet do sistema abre por cima.
      return;
    }
    onShowToast('Gerando relatório...');
    try {
      printViaIframe(buildReportHtml());
      onTriggerConfetti();
      onShowToast('Relatório pronto — escolha "Salvar como PDF" no diálogo.');
    } catch {
      onShowToast('Falha ao gerar o relatório.');
    } finally {
      setTimeout(() => setIsPrinting(false), 800);
    }
    // O modal permanece aberto de propósito: fechar junto com print()
    // aborta o snapshot de impressão em alguns navegadores.
  };

  const handleUnlockVaultForBackup = async () => {
    if (!/^\d{4,6}$/.test(vaultPinInput)) {
      onShowToast('Digite o PIN do cofre (4 a 6 dígitos).');
      return;
    }
    setIsUnlocking(true);
    try {
      const ok = await onUnlockVault(vaultPinInput);
      if (ok) {
        playSynthSound('success');
        setVaultPinInput('');
        onShowToast('Cofre desbloqueado — credenciais incluídas no backup.');
      } else {
        playSynthSound('failure');
        setVaultPinInput('');
        const left = 5 - (failedAttempts + 1);
        onShowToast(left > 0 ? `PIN do cofre inválido. Restam ${left} tentativa(s).` : 'Muitas tentativas. Aguarde 30s.');
      }
    } catch {
      onShowToast('Falha ao validar PIN. Tente novamente.');
    } finally {
      setIsUnlocking(false);
    }
  };

  const totalPatrimonio = safeAssets.reduce((acc, a) => acc + (Number(a?.qty) || 0) * (Number(a?.currentPrice) || 0), 0);

  return (
    <>
      {/* 1. MODAL BUSCA GLOBAL (CTRL+K) */}
      {isSearchOpen && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-16">
          <div className="w-full max-w-sm bg-[#1A1311] border border-jaspe-border rounded-3xl p-5 shadow-2xl space-y-4 text-left">
            <div className="flex items-center justify-between border-b border-jaspe-border pb-2">
              <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                <Search className="w-4 h-4 text-orange-400" /> Busca Global (índice local)
              </span>
              <button
                onClick={onCloseSearch}
                className="text-zinc-500 hover:text-zinc-300"
                aria-label="Fechar"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pesquise notas, tarefas, contatos, ativos..."
              className="w-full bg-[#251C1A] border border-jaspe-border p-3 rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-orange-500/50"
            />
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {!searchQuery && (
                <p className="text-[10px] text-zinc-500 text-center py-4">
                  Digite para pesquisar em todo o banco do Jaspe...
                </p>
              )}
              {matchedNotes.map((n) => (
                <div
                  key={n.id}
                  onClick={() => {
                    onSelectNote(n.id);
                    onNavigateTab('anotacoes');
                    onCloseSearch();
                  }}
                  className="p-3 bg-black/30 hover:bg-black/50 rounded-xl border border-white/5 cursor-pointer text-left transition-all"
                >
                  <strong className="text-xs text-zinc-200 block truncate">
                    {n.title || 'Sem Título'}
                  </strong>
                  <span className="text-[9px] text-zinc-400">
                    Nota • {n.category}
                  </span>
                </div>
              ))}
              {matchedTasks.map((t) => (
                <div
                  key={t.id}
                  onClick={() => {
                    onNavigateTab('tarefas');
                    onCloseSearch();
                  }}
                  className="p-3 bg-black/30 hover:bg-black/50 rounded-xl border border-white/5 cursor-pointer text-left transition-all"
                >
                  <strong className="text-xs text-zinc-200 block truncate">
                    {t.text}
                  </strong>
                  <span className="text-[9px] text-zinc-400">
                    Tarefa • {t.priority}
                  </span>
                </div>
              ))}
              {matchedContacts.map((c) => (
                <div
                  key={c.id}
                  onClick={() => {
                    onNavigateTab('contatos');
                    onCloseSearch();
                  }}
                  className="p-3 bg-black/30 hover:bg-black/50 rounded-xl border border-white/5 cursor-pointer text-left transition-all"
                >
                  <strong className="text-xs text-zinc-200 block truncate">
                    {c.name}
                  </strong>
                  <span className="text-[9px] text-zinc-400">
                    Contato • {c.company}
                  </span>
                </div>
              ))}
              {matchedAssets.map((a) => (
                <div
                  key={a.id}
                  onClick={() => {
                    onNavigateTab('carteira');
                    onCloseSearch();
                  }}
                  className="p-3 bg-black/30 hover:bg-black/50 rounded-xl border border-white/5 cursor-pointer text-left transition-all"
                >
                  <strong className="text-xs text-zinc-200 block truncate">
                    {a.ticker} - {a.name}
                  </strong>
                  <span className="text-[9px] text-zinc-400">
                    Ativo • {a.category}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. MODAL DISPARADOR DE MENSAGENS */}
      {isMessageOpen && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-3">
          <div className="w-full bg-[#1A1311] border border-jaspe-border rounded-[28px] p-6 max-h-[90dvh] overflow-y-auto space-y-6 text-left">
            <div className="flex items-center justify-between border-b border-jaspe-border pb-3">
              <h3 className="font-extrabold text-sm text-zinc-100 flex items-center gap-2">
                <Send className="w-4 h-4 text-orange-400" /> Disparar Mensagem Rápida
              </h3>
              <button
                onClick={onCloseMessage}
                className="text-zinc-500 hover:text-zinc-300"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] text-zinc-400 font-bold uppercase">
                  Canal de envio
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      playSynthSound('click');
                      setChannel('whatsapp');
                    }}
                    className={`py-2.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 border transition-all active:scale-95 ${
                      channel === 'whatsapp'
                        ? 'bg-emerald-500 text-white border-emerald-500 shadow'
                        : 'bg-[#251C1A] text-zinc-400 border-jaspe-border hover:text-white'
                    }`}
                  >
                    <MessageCircle className="w-4 h-4" /> WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      playSynthSound('click');
                      setChannel('telegram');
                    }}
                    className={`py-2.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 border transition-all active:scale-95 ${
                      channel === 'telegram'
                        ? 'bg-sky-500 text-white border-sky-500 shadow'
                        : 'bg-[#251C1A] text-zinc-400 border-jaspe-border hover:text-white'
                    }`}
                  >
                    <Send className="w-4 h-4" /> Telegram
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-zinc-400 font-bold uppercase">
                  Selecionar Contato
                </label>
                <select
                  value={selectedContactName}
                  onChange={(e) => setSelectedContactName(e.target.value)}
                  className="w-full bg-[#251C1A] border border-jaspe-border p-3 rounded-xl text-xs text-zinc-200 focus:outline-none"
                >
                  {safeContacts.length === 0 && (<option value="">Nenhum contato — cadastre na aba Contatos</option>)}
                  {safeContacts.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name} ({c.company})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-zinc-400 font-bold uppercase">
                  Modelos de Comunicação
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => applyTemplate('cobranca')}
                    className="py-2.5 px-3 bg-[#251C1A] border border-jaspe-border text-[10px] font-bold text-zinc-300 rounded-xl hover:border-orange-500 hover:text-white transition-all active:scale-95"
                  >
                    Cobrança Suave
                  </button>
                  <button
                    type="button"
                    onClick={() => applyTemplate('reuniao')}
                    className="py-2.5 px-3 bg-[#251C1A] border border-jaspe-border text-[10px] font-bold text-zinc-300 rounded-xl hover:border-orange-500 hover:text-white transition-all active:scale-95"
                  >
                    Confirmação de Reunião
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-zinc-400 font-bold uppercase">
                  Conteúdo da Mensagem
                </label>
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Escreva a mensagem ou escolha um modelo..."
                  className="w-full h-24 bg-[#251C1A] border border-jaspe-border p-3 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-orange-500/50 resize-none"
                ></textarea>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={sendVia}
                  className={`w-full py-3 text-white font-bold text-xs rounded-xl shadow-lg flex items-center justify-center gap-1.5 active:scale-95 transition-all ${
                    channel === 'whatsapp'
                      ? 'bg-emerald-500 hover:bg-emerald-600'
                      : 'bg-sky-500 hover:bg-sky-600'
                  }`}
                >
                  {channel === 'whatsapp' ? (
                    <><MessageCircle className="w-4 h-4" /> Enviar via WhatsApp</>
                  ) : (
                    <><Send className="w-4 h-4" /> Enviar via Telegram</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. MODAL CENTRAL DE BACKUP */}
      {isBackupOpen && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-3">
          <div className="w-full bg-[#1A1311] border border-jaspe-border rounded-[28px] p-6 max-h-[90dvh] overflow-y-auto space-y-6 text-left">
            <div className="flex items-center justify-between border-b border-jaspe-border pb-3">
              <div>
                <h3 className="font-extrabold text-sm text-zinc-100 flex items-center gap-2">
                  <span className="w-7 h-7 rounded-xl bg-orange-500/15 flex items-center justify-center">
                    <HardDrive className="w-4 h-4 text-orange-400" />
                  </span>
                  Backup & Configurações
                </h3>
                <p className="text-[10px] text-zinc-500 mt-0.5 ml-9">Proteja tudo — exporte e restaure quando precisar</p>
              </div>
              <button
                onClick={onCloseBackup}
                className="text-zinc-500 hover:text-zinc-300"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="border border-violet-400/20 p-4 rounded-2xl bg-gradient-to-b from-violet-400/[0.07] to-transparent space-y-3 shadow-lg shadow-violet-400/5">
                <h4 className="text-xs font-extrabold text-zinc-100 flex items-center gap-2">
                  <span className="w-7 h-7 rounded-xl bg-violet-400/10 flex items-center justify-center">
                    <Shield className="w-4 h-4 text-violet-200" />
                  </span>
                  Backup Criptografado (.jaspe)
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {['AES-256-GCM', 'PBKDF2 210k', 'SHA-256'].map((t) => (
                    <span key={t} className="text-[8px] font-extrabold uppercase tracking-wider px-2 py-1 rounded-full bg-violet-400/10 text-violet-200/90 border border-violet-400/20">
                      {t}
                    </span>
                  ))}
                </div>
                <p className="text-[10px] text-zinc-400">
                  Cofre real no arquivo. Exige PIN 4-6 dígitos — sem o PIN correto, não abre.
                </p>
                <div className="grid grid-cols-2 gap-1.5 text-[10px] text-zinc-300">
                  {(Object.keys(sel) as (keyof typeof sel)[]).map((k) => (
                    <label key={k} className="flex items-center gap-1.5 bg-black/30 px-2 py-1.5 rounded-lg border border-white/5 cursor-pointer">
                      <input type="checkbox" checked={sel[k]} onChange={() => toggleSel(k)} className="accent-violet-500" />
                      <span className="capitalize">{k}</span>
                    </label>
                  ))}
                </div>
                {!isCofreUnlocked && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 space-y-2">
                    <p className="text-[10px] font-bold text-amber-300">
                      Cofre bloqueado — desbloqueie aqui para incluir as credenciais no backup.
                    </p>
                    {!hasPinSetup ? (
                      <p className="text-[10px] text-zinc-400">
                        Você ainda não criou o PIN do cofre. Crie primeiro na aba Cofres e Senhas.
                      </p>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="password"
                          inputMode="numeric"
                          maxLength={6}
                          value={vaultPinInput}
                          onChange={(e) => setVaultPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="PIN do cofre"
                          aria-label="PIN do cofre"
                          className="flex-1 min-w-0 bg-[#251C1A] border border-jaspe-border p-2.5 rounded-xl text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/60 text-center tracking-[0.3em] font-extrabold"
                        />
                        <button
                          type="button"
                          onClick={handleUnlockVaultForBackup}
                          disabled={isUnlocking}
                          className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-60 text-white text-xs font-extrabold rounded-xl transition-all active:scale-95 whitespace-nowrap"
                        >
                          {isUnlocking ? '...' : 'Desbloquear'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {!isCofreUnlocked && sel.credentials && hasPinSetup && (
                  <p className="text-[9px] text-amber-400 font-bold">Sem desbloquear, as credenciais ficam de fora do backup.</p>
                )}
                <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wide">
                  PIN que vai proteger este arquivo (pode ser diferente do cofre)
                </p>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={backupPin}
                  onChange={(e) => setBackupPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="PIN do arquivo .jaspe (4-6 dígitos)"
                  className="w-full bg-[#251C1A] border border-jaspe-border p-3 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-violet-400/50 placeholder-zinc-500 text-center tracking-[0.3em] font-extrabold"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!/^\d{4,6}$/.test(backupPin)) {
                      onShowToast('PIN do backup: 4 a 6 dígitos numéricos.');
                      return;
                    }
                    Promise.resolve(onExportEncryptedJaspe(backupPin, sel))
                      .catch(() => onShowToast('Falha ao gerar backup .jaspe.'));
                  }}
                  className="w-full py-3.5 bg-gradient-to-r from-violet-400 to-violet-500 hover:from-violet-300 hover:to-violet-400 text-white text-xs font-extrabold rounded-xl transition-all active:scale-95 shadow-lg shadow-violet-400/20 flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" /> Gerar e Baixar .jaspe
                </button>
              </div>

              <div className="border border-orange-500/25 p-4 rounded-2xl bg-gradient-to-b from-orange-500/10 to-transparent space-y-3">
                <h4 className="text-xs font-extrabold text-zinc-100 flex items-center gap-2">
                  <span className="w-7 h-7 rounded-xl bg-orange-500/15 flex items-center justify-center">
                    <FileJson className="w-4 h-4 text-orange-400" />
                  </span>
                  Backup em Lote (.JSON)
                </h4>
                <p className="text-[10px] text-zinc-400">
                  Exportação de todas as anotações, tarefas, contatos e finanças em formato JSON legível.
                </p>
                <button
                  type="button"
                  onClick={() => { Promise.resolve(onExportJSON(sel)).catch(() => onShowToast('Falha ao exportar JSON.')); }}
                  className="w-full py-3 bg-orange-600 hover:bg-orange-500 text-white text-xs font-extrabold rounded-xl transition-all active:scale-95 shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2"
                >
                  <FileJson className="w-4 h-4" /> Exportar JSON granular (SHA-256)
                </button>
              </div>

              <div className="border border-blue-500/25 p-4 rounded-2xl bg-gradient-to-b from-blue-500/10 to-transparent space-y-3">
                <h4 className="text-xs font-extrabold text-zinc-100 flex items-center gap-2">
                  <span className="w-7 h-7 rounded-xl bg-blue-500/15 flex items-center justify-center">
                    <History className="w-4 h-4 text-blue-400" />
                  </span>
                  Restaurar backup (.json / .jaspe)
                </h4>
                <p className="text-[10px] text-zinc-400">
                  Valida PIN + integridade SHA-256 e espelha o backup: as seções incluídas voltam a ser exatamente as do arquivo (o que não está no backup é removido).
                </p>
                <input ref={fileRef} type="file" accept=".json,.jaspe,application/json,application/octet-stream" className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) Promise.resolve(onImportBackupFile(f, restorePin || undefined)).catch(() => onShowToast('Falha ao importar backup.'));
                    e.target.value = '';
                  }} />
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={restorePin}
                  onChange={(e) => setRestorePin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="PIN do .jaspe (se for .jaspe)"
                  className="w-full bg-[#251C1A] border border-jaspe-border p-3 rounded-xl text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500/60 text-center tracking-[0.3em] font-extrabold"
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold rounded-xl transition-all active:scale-95 shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                >
                  <Upload className="w-4 h-4" /> Selecionar arquivo e restaurar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. MODAL PERFIL DE USUÁRIO */}
      {isProfileOpen && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-3">
          <div className="w-full bg-[#1A1311] border border-jaspe-border rounded-[28px] p-6 max-h-[90dvh] overflow-y-auto space-y-6 text-left">
            <div className="flex items-center justify-between border-b border-jaspe-border pb-3">
              <div>
                <h3 className="font-extrabold text-sm text-zinc-100 flex items-center gap-2">
                  <span className="w-7 h-7 rounded-xl bg-orange-500/15 flex items-center justify-center">
                    <Camera className="w-4 h-4 text-orange-400" />
                  </span>
                  Perfil & Foto de Avatar
                </h3>
                <p className="text-[10px] text-zinc-500 mt-0.5 ml-9">Personalize sua identidade, foto de perfil e status</p>
              </div>
              <button
                onClick={onCloseProfile}
                className="text-zinc-500 hover:text-zinc-300"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-white/5 border border-white/5 rounded-2xl p-5 flex flex-col items-center space-y-3">
              <div className="relative">
                <img
                  src={profAvatar ?? profile?.avatarUrl ?? "/logo.svg"}
                  alt={profile?.name || "Perfil"}
                  className="w-24 h-24 rounded-full border-[3px] border-white/80 object-cover shadow-lg"
                />
                <button
                  type="button"
                  title="Centralizar / Ajustar"
                  onClick={() => {
                    const cur = profAvatar ?? profile?.avatarUrl ?? '';
                    if (!cur || cur === '/logo.svg') { onShowToast('Carregue uma foto primeiro.'); return; }
                    playSynthSound('click');
                    setCropSrc(cur);
                  }}
                  className="absolute -top-1 -right-1 w-8 h-8 bg-amber-500 hover:brightness-110 rounded-xl flex items-center justify-center text-white shadow-md active:scale-90 transition-all"
                >
                  <Crop className="w-4 h-4" />
                </button>
                <span className="absolute bottom-1 right-1 w-5 h-5 bg-emerald-500 rounded-full border-[3px] border-[#1A1311]"></span>
              </div>

              <div className="text-center">
                <h4 className="font-extrabold text-sm text-zinc-100">Foto de Perfil</h4>
                <p className="text-[10px] text-zinc-500 mt-0.5">Carregue uma imagem do seu aparelho ou ajuste o enquadramento.</p>
              </div>

              <input
                ref={avatarFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  handleAvatarFile(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
              <div className="flex gap-2 w-full justify-center flex-wrap">
                <button
                  type="button"
                  onClick={() => avatarFileRef.current?.click()}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white text-xs font-bold shadow-md active:scale-95 transition-all"
                >
                  <Upload className="w-3.5 h-3.5" /> Carregar Foto
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const cur = profAvatar ?? profile?.avatarUrl ?? '';
                    if (!cur || cur === '/logo.svg') { onShowToast('Carregue uma foto primeiro.'); return; }
                    playSynthSound('click');
                    setCropSrc(cur);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/5 border border-orange-500/40 text-orange-400 text-xs font-bold hover:bg-orange-500/10 active:scale-95 transition-all"
                >
                  <Crop className="w-3.5 h-3.5" /> Centralizar / Ajustar
                </button>
              </div>
              <button
                type="button"
                onClick={() => { playSynthSound('click'); setProfAvatar(''); onShowToast('Foto removida. Toque em Salvar p/ confirmar.'); }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs font-bold hover:bg-red-500/20 active:scale-95 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" /> Remover Foto
              </button>

              <div
                onClick={() => avatarFileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  handleAvatarFile(e.dataTransfer.files?.[0]);
                }}
                className={`w-full border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all ${
                  dragOver ? 'border-orange-500 bg-orange-500/10' : 'border-zinc-700 hover:border-orange-500/50'
                }`}
              >
                <ImagePlus className="w-6 h-6 text-orange-400 mx-auto" />
                <p className="text-[11px] text-zinc-300 font-bold mt-2">
                  Arraste sua foto aqui ou <span className="text-orange-400 underline">clique para selecionar</span>
                </p>
                <p className="text-[9px] text-zinc-500 mt-1">Suporta JPG, PNG, WebP até 5MB</p>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-500">Informações do usuário</h4>
              <div className="space-y-1">
                <label className="text-[11px] text-zinc-300 font-bold flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-orange-400" /> Nome de Exibição <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={profName}
                  onChange={(e) => setProfName(e.target.value)}
                  className="w-full bg-[#251C1A] border border-jaspe-border p-3 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-orange-500/50"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-zinc-300 font-bold flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-orange-400" /> E-mail Principal
                </label>
                <input
                  type="email"
                  value={profEmail}
                  onChange={(e) => setProfEmail(e.target.value)}
                  className="w-full bg-[#251C1A] border border-jaspe-border p-3 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-orange-500/50"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-zinc-300 font-bold flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-orange-400" /> Cargo / Profissão
                </label>
                <input
                  type="text"
                  value={profRole}
                  onChange={(e) => setProfRole(e.target.value)}
                  placeholder="Ex: Executivo / Investidor"
                  className="w-full bg-[#251C1A] border border-jaspe-border p-3 rounded-xl text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-orange-500/50"
                />
              </div>
              <button
                type="button"
                onClick={handleSaveProfile}
                className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-lg active:scale-95 transition-all"
              >
                Salvar Alterações
              </button>
            </div>

            {/* Cotações de Ativos (Brapi) — token guardado neste aparelho,
                independente do perfil e de qualquer atualização do app. */}
            <div className="space-y-3 bg-white/5 border border-white/5 rounded-2xl p-5">
              <div>
                <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-orange-400" /> Cotações de Ativos (Brapi)
                </h4>
                <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">
                  Sem token, a Brapi só atualiza 4 ativos de teste (PETR4, MGLU3, VALE3, ITUB4) — os
                  demais dependem do Yahoo como reserva, que é menos estável. Cole aqui um token
                  gratuito para liberar todos os seus ativos B3. Fica salvo só neste aparelho, então
                  se algum dia parar de funcionar ou for perdido numa atualização, é só colar um novo
                  a qualquer momento — sem precisar reinstalar o app.
                </p>
                <a
                  href="https://brapi.dev/dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] text-orange-400 underline mt-1.5"
                >
                  Pegar token grátis em brapi.dev/dashboard <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-zinc-300 font-bold">Token da Brapi</label>
                <div className="relative">
                  <input
                    type={showBrapiToken ? 'text' : 'password'}
                    value={brapiTokenInput}
                    onChange={(e) => { setBrapiTokenInput(e.target.value); setBrapiTestState('idle'); setBrapiTestMsg(''); }}
                    placeholder="Cole aqui o token da sua conta Brapi"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    className="w-full bg-[#251C1A] border border-jaspe-border p-3 pr-10 rounded-xl text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-orange-500/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowBrapiToken((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                    aria-label={showBrapiToken ? 'Ocultar token' : 'Mostrar token'}
                  >
                    {showBrapiToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {brapiTestState !== 'idle' && (
                <div
                  className={`flex items-start gap-1.5 text-[10px] rounded-lg p-2.5 ${
                    brapiTestState === 'ok'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : brapiTestState === 'error'
                      ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                      : 'bg-white/5 text-zinc-400 border border-white/5'
                  }`}
                >
                  {brapiTestState === 'testing' && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 mt-0.5" />}
                  {brapiTestState === 'ok' && <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
                  {brapiTestState === 'error' && <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
                  <span>{brapiTestState === 'testing' ? 'Testando token na Brapi (chamada real, com WEGE3)…' : brapiTestMsg}</span>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleTestBrapiToken}
                  disabled={brapiTestState === 'testing' || !brapiTokenInput.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 border border-orange-500/40 text-orange-400 text-[11px] font-bold hover:bg-orange-500/10 active:scale-95 transition-all disabled:opacity-40 disabled:active:scale-100"
                >
                  Testar Token
                </button>
                <button
                  type="button"
                  onClick={handleSaveBrapiToken}
                  className="flex-1 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-[11px] font-bold active:scale-95 transition-all"
                >
                  Salvar Token
                </button>
              </div>
            </div>
            {cropSrc && (
              <AvatarCropper
                src={cropSrc}
                onCancel={() => setCropSrc(null)}
                onToast={onShowToast}
                onDone={(url) => {
                  setProfAvatar(url);
                  setCropSrc(null);
                  onShowToast('Enquadramento pronto. Toque em Salvar.');
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* 5. MODAL IMPRESSÃO DE RELATÓRIO EXECUTIVO (A4) */}
      {isReportOpen && (
        <div id="modal-relatorio" className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-3">
          <div className="w-full bg-[#1A1311] border border-jaspe-border rounded-[28px] p-6 max-h-[90dvh] overflow-y-auto space-y-6 text-left">
            <div className="flex items-center justify-between border-b border-jaspe-border pb-3">
              <h3 className="font-extrabold text-sm text-zinc-100 flex items-center gap-2">
                <Printer className="w-4 h-4 text-orange-400" /> Impressão de Relatório
              </h3>
              <button
                onClick={onCloseReport}
                className="text-zinc-500 hover:text-zinc-300"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Pré-visualização (tela) — o PDF usa documento próprio, ver handlePrint */}
            <div className="bg-white text-neutral-900 p-5 rounded-xl text-left space-y-5 overflow-y-auto max-h-[500px] shadow-2xl font-serif">
              <div className="border-b-2 border-neutral-800 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <img src="/logo.svg" alt="Jaspe" className="w-9 h-9 rounded-lg shadow object-cover" />
                  <div>
                    <h2 className="text-base font-extrabold tracking-tight">
                      JASPE — RELATÓRIO GERAL COMPLETO
                    </h2>
                    <p className="text-[9px] text-neutral-500">
                      Painel Consolidado de Informações & Patrimônio — {new Date().toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded">
                  JASPE
                </span>
              </div>

              {/* 1. Carteira de Ativos & Finanças */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-neutral-800 border-b border-neutral-300 pb-1">
                  1. Carteira de Ativos & Finanças
                </h4>
                <div className="bg-neutral-100 p-2.5 rounded text-[10px] font-semibold flex justify-between">
                  <span>Patrimônio Bruto Total:</span>
                  <strong className="text-emerald-700">
                    R$ {totalPatrimonio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </strong>
                </div>
                {safeAssets.length > 0 && (
                  <div className="overflow-x-auto -mx-1 px-1">
                    <table className="w-full min-w-[540px] text-[10px] text-neutral-600 border-collapse mt-2">
                      <thead>
                        <tr className="border-b-2 border-neutral-800 text-left">
                          <th className="py-1.5 pr-2 font-bold">Ticker</th>
                          <th className="py-1.5 pr-2 font-bold text-right">Qtd</th>
                          <th className="py-1.5 pr-2 font-bold text-right">P. médio</th>
                          <th className="py-1.5 pr-2 font-bold text-right">P. atual</th>
                          <th className="py-1.5 pr-2 font-bold text-right">Valor total</th>
                          <th className="py-1.5 font-bold">Categoria</th>
                        </tr>
                      </thead>
                      <tbody>
                        {safeAssets.slice(0, 8).map((asset, idx) => (
                          <tr key={asset?.id ?? `asset-${idx}`} className="border-b border-neutral-200">
                            <td className="py-1.5 pr-2 font-bold whitespace-nowrap">{asset?.ticker || '—'}</td>
                            <td className="py-1.5 pr-2 text-right whitespace-nowrap">{asset?.qty ?? '—'}</td>
                            <td className="py-1.5 pr-2 text-right whitespace-nowrap">
                              R$ {Number(asset?.avgPrice || 0).toFixed(2)}
                            </td>
                            <td className="py-1.5 pr-2 text-right text-emerald-700 whitespace-nowrap">
                              R$ {Number(asset?.currentPrice || 0).toFixed(2)}
                            </td>
                            <td className="py-1.5 pr-2 text-right font-bold whitespace-nowrap">
                              R$ {(Number(asset?.qty || 0) * Number(asset?.currentPrice || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-1.5 whitespace-nowrap">{asset?.category || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {safeAssets.length > 8 && (
                  <p className="text-[9px] text-neutral-400 text-center italic">
                    ... e mais {safeAssets.length - 8} ativo(s) — lista completa no PDF
                  </p>
                )}
                {safeAssets.length === 0 && (
                  <p className="text-[9px] text-neutral-400 text-center py-2 italic">Nenhum ativo cadastrado.</p>
                )}
              </div>

              {/* 2. Anotações Fixadas */}
              {safeNotes.length > 0 && (
                <div className="space-y-2 border-t border-neutral-300 pt-3">
                  <h4 className="text-xs font-bold text-neutral-800 border-b border-neutral-300 pb-1">
                    2. Anotações ({safeNotes.filter(n => n.pinned).length} fixadas de {safeNotes.length} total)
                  </h4>
                  {safeNotes.filter(n => n.pinned).slice(0, 10).map((note, idx) => (
                    <div key={note?.id ?? `note-${idx}`} className="bg-neutral-50 p-2.5 rounded-lg text-[10px] border border-neutral-200">
                      <strong className="block text-neutral-800 mb-0.5">{note?.title || 'Sem Título'}</strong>
                      <span className="text-neutral-600 line-clamp-2">{note?.body?.replace(/<[^>]*>/g, '') || ''}</span>
                      <div className="flex gap-2 mt-1 text-[8px] text-neutral-400">
                        <span>{note?.category}</span>
                        <span>{note?.date}</span>
                      </div>
                    </div>
                  ))}
                  {safeNotes.filter(n => n.pinned).length > 10 && (
                    <p className="text-[8px] text-neutral-400 text-center italic">
                      ... e mais {safeNotes.filter(n => n.pinned).length - 10} anotações fixadas
                    </p>
                  )}
                </div>
              )}

              {/* 3. Tarefas Pendentes */}
              {safeTasks.length > 0 && (
                <div className="space-y-2 border-t border-neutral-300 pt-3">
                  <h4 className="text-xs font-bold text-neutral-800 border-b border-neutral-300 pb-1">
                    3. Tarefas ({safeTasks.filter(t => !t.done).length} pendentes de {safeTasks.length} total)
                  </h4>
                  {safeTasks.filter(t => !t.done).slice(0, 15).map((task, idx) => (
                    <div key={task?.id ?? `task-${idx}`} className="bg-neutral-50 p-2.5 rounded-lg text-[10px] border border-neutral-200">
                      <div className="font-medium text-neutral-800">{task?.text || 'Sem descrição'}</div>
                        <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1 text-[8px] text-neutral-400">
                          <span>{task?.category}</span>
                          <span>{task?.date}</span>
                          <span className={`px-1 py-0.5 rounded font-bold ${
                            task.priority === 'Urgente' ? 'bg-red-100 text-red-700' :
                            task.priority === 'Alta' ? 'bg-orange-100 text-orange-700' :
                            task.priority === 'Média' ? 'bg-amber-100 text-amber-700' :
                            'bg-green-100 text-green-700'
                          }`}>{task?.priority}</span>
                        </div>
                    </div>
                  ))}
                  {safeTasks.filter(t => !t.done).length > 15 && (
                    <p className="text-[8px] text-neutral-400 text-center italic">
                      ... e mais {safeTasks.filter(t => !t.done).length - 15} tarefas pendentes
                    </p>
                  )}
                </div>
              )}

              {/* 4. Contatos */}
              {safeContacts.length > 0 && (
                <div className="space-y-2 border-t border-neutral-300 pt-3">
                  <h4 className="text-xs font-bold text-neutral-800 border-b border-neutral-300 pb-1">
                    4. Contatos ({safeContacts.length} total)
                  </h4>
                  {safeContacts.slice(0, 15).map((contact, idx) => (
                    <div key={contact?.id ?? `contact-${idx}`} className="bg-neutral-50 p-2.5 rounded-lg text-[10px] border border-neutral-200">
                        <div className="font-medium text-neutral-800">{contact?.name || 'Sem nome'}</div>
                        {contact?.company ? <div className="text-neutral-500">{contact?.company}</div> : null}
                        <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1 text-[8px] text-neutral-400">
                          <span>{contact?.category}</span>
                          {contact?.phone && <span>{contact?.phone}</span>}
                          {contact?.email && <span>{contact?.email}</span>}
                        </div>
                    </div>
                  ))}
                  {safeContacts.length > 15 && (
                    <p className="text-[8px] text-neutral-400 text-center italic">
                      ... e mais {safeContacts.length - 15} contatos
                    </p>
                  )}
                </div>
              )}

              {/* 5. Proventos */}
              {safeProventos.length > 0 && (
                <div className="space-y-2 border-t border-neutral-300 pt-3">
                  <h4 className="text-xs font-bold text-neutral-800 border-b border-neutral-300 pb-1">
                    5. Proventos ({safeProventos.length} total)
                  </h4>
                  {safeProventos.slice(0, 5).map((p, idx) => (
                    <div key={p?.id ?? `prov-${idx}`} className="bg-neutral-50 p-2.5 rounded-lg text-[10px] border border-neutral-200 flex items-center justify-between gap-2">
                      <div>
                        <span className="font-bold text-neutral-800">{p?.ticker || '—'}</span>
                        <span className="text-neutral-500"> • {p?.type || '—'} • {p?.date || '—'}</span>
                      </div>
                      <strong className="text-emerald-700 whitespace-nowrap">
                        R$ {Number(p?.amount || 0).toFixed(2)}
                      </strong>
                    </div>
                  ))}
                  {safeProventos.length > 5 && (
                    <p className="text-[8px] text-neutral-400 text-center italic">
                      ... e mais {safeProventos.length - 5} provento(s) — lista completa no PDF
                    </p>
                  )}
                </div>
              )}

              {/* 6. Documentos */}
              {safeDocuments.length > 0 && (
                <div className="space-y-2 border-t border-neutral-300 pt-3">
                  <h4 className="text-xs font-bold text-neutral-800 border-b border-neutral-300 pb-1">
                    6. Documentos ({safeDocuments.length} total)
                  </h4>
                  {safeDocuments.slice(0, 5).map((d, idx) => (
                    <div key={d?.id ?? `doc-${idx}`} className="bg-neutral-50 p-2.5 rounded-lg text-[10px] border border-neutral-200">
                      <div className="font-medium text-neutral-800">{d?.title || 'Sem título'}</div>
                      <div className="text-[8px] text-neutral-400 mt-0.5">{d?.type || '—'} • {d?.date || d?.updatedAt || '—'}</div>
                    </div>
                  ))}
                  {safeDocuments.length > 5 && (
                    <p className="text-[8px] text-neutral-400 text-center italic">
                      ... e mais {safeDocuments.length - 5} documento(s) — lista completa no PDF
                    </p>
                  )}
                </div>
              )}

              <p className="text-[8px] text-neutral-400 text-center font-sans border-t border-neutral-100 pt-2 italic">
                ⚠️ Senhas e credenciais do Cofre são estritamente omitidas deste relatório por questões de segurança de dados.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handlePrint}
                disabled={isPrinting}
                className="py-3 bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white font-bold text-xs rounded-xl shadow-lg flex items-center justify-center gap-1.5 active:scale-95 transition-all"
              >
                <Printer className="w-4 h-4" /> {isPrinting ? 'Gerando...' : isNativeApp ? 'Salvar PDF' : 'Imprimir PDF'}
              </button>
              <button
                type="button"
                onClick={onCloseReport}
                className="py-3 bg-[#251C1A] border border-jaspe-border text-zinc-300 font-bold text-xs rounded-xl active:scale-95 transition-all hover:bg-white/5"
              >
                Cancelar
              </button>
            </div>
            {isNativeApp && (
              <p className="text-[10px] text-zinc-500 text-center -mt-3">
                O PDF será gerado e aberto para você salvar ou compartilhar.
              </p>
            )}
          </div>
        </div>
      )}

      {/* 6. MODAL ALERTA DE ALARME DE TAREFAS */}
      {ringingTask && (
        <div className="absolute inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#251C1A] border-2 border-red-500 rounded-3xl p-6 w-[320px] shadow-2xl text-center space-y-4 animate-bounce-short text-left">
            <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mx-auto animate-pulse">
              <AlarmClock className="w-7 h-7" />
            </div>
            <div className="space-y-1 text-center">
              <h3 className="font-extrabold text-red-500 text-sm tracking-wide uppercase">
                Alarme Disparado!
              </h3>
              <p className="text-[10px] text-zinc-400 font-semibold">
                {ringingTask.date}
                {alarmQueueCount > 1 ? ` • +${alarmQueueCount - 1} na fila` : ''}
              </p>
            </div>
            <div className="p-3 bg-black/40 rounded-xl border border-white/5">
              <p className="text-xs text-zinc-100 font-bold leading-snug">
                {ringingTask.text}
              </p>
              <span
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded mt-2 inline-block ${
                  ringingTask.priority === 'Urgente'
                    ? 'bg-red-500/20 text-red-400 animate-pulse'
                    : 'bg-orange-500/20 text-orange-400'
                }`}
              >
                {ringingTask.priority}
              </span>
            </div>
            <div className="space-y-1.5">
              <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wide">Adiar (soneca)</p>
              <div className="grid grid-cols-4 gap-1.5">
                {[5, 10, 15, 30].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => onDismissAlarm('snooze', mins)}
                    className="py-2 bg-zinc-800 text-zinc-300 text-[11px] font-bold rounded-lg active:scale-95 transition-all hover:bg-zinc-700 flex flex-col items-center gap-0.5"
                  >
                    <Clock className="w-3 h-3 text-orange-400" />
                    {mins}m
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onDismissAlarm('stop')}
                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-1"
              >
                <X className="w-3.5 h-3.5" /> Parar lembretes
              </button>
              <button
                type="button"
                onClick={() => onDismissAlarm('conclude')}
                className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-1"
              >
                <CheckCircle className="w-3.5 h-3.5" /> Concluir
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
