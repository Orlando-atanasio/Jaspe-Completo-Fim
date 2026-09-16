import React, { useState, useEffect, useRef } from 'react';
import {
  Lock,
  Delete,
  Grid,
  Menu,
  LayoutGrid,
  AlignJustify,
  Plus,
  Key,
  Eye,
  EyeOff,
  Copy,
  ShieldCheck,
  Globe,
  FileText
} from 'lucide-react';
import { Credential } from '../types';
import { playSynthSound } from '../utils/audio';

interface CofreViewProps {
  credentials: Credential[];
  isUnlocked: boolean;
  hasPinSetup: boolean;
  onSetupPin: (pin: string) => Promise<void>;
  onUnlock: (pin: string) => Promise<boolean>;
  onVerifyPin: (pin: string) => Promise<boolean>;
  onChangePin: (currentPin: string, newPin: string) => Promise<void>;
  failedAttempts: number;
  lockoutUntil: number;
  onLock: () => void;
  onOpenEditModal: (id: number | null) => void;
  onShowToast: (msg: string) => void;
}

type ViewMode = 'grid' | 'list' | 'compact' | 'detailed';

export default function CofreView({
  credentials,
  isUnlocked,
  hasPinSetup,
  onSetupPin,
  onUnlock,
  onVerifyPin,
  onChangePin,
  failedAttempts,
  lockoutUntil,
  onLock,
  onOpenEditModal,
  onShowToast
}: CofreViewProps) {
  const [pinBuffer, setPinBuffer] = useState('');
  const [setupPin1, setSetupPin1] = useState('');
  const [setupStep, setSetupStep] = useState<'first' | 'confirm'>('first');
  const [busy, setBusy] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      const v = localStorage.getItem('jaspe_cofre_view');
      if (v === 'grid' || v === 'list' || v === 'compact' || v === 'detailed' || v === 'kanban') return v as ViewMode;
    } catch {}
    return 'grid';
  });
  const [revealedIds, setRevealedIds] = useState<Record<number, boolean>>({});
  const [search, setSearch] = useState('');
  // Relógio p/ contagem regressiva do bloqueio (5 erros → 30s)
  const [nowTs, setNowTs] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const lockLeft = Math.max(0, Math.ceil((lockoutUntil - nowTs) / 1000));
  // Fluxo trocar PIN (cofre aberto): atual → novo → confirmar
  const [pinMode, setPinMode] = useState<'list' | 'change'>('list');
  const [changeStep, setChangeStep] = useState<'current' | 'new1' | 'new2'>('current');
  const [changeBuffer, setChangeBuffer] = useState('');
  const [changeCurrent, setChangeCurrent] = useState('');
  const [changeNew1, setChangeNew1] = useState('');
  const pinTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (pinTimer.current) clearTimeout(pinTimer.current);
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('jaspe_cofre_view', viewMode);
    } catch {}
  }, [viewMode]);

  // Auto-limpa segredos revelados ao bloquear (higiene de sessão)
  useEffect(() => {
    if (!isUnlocked) {
      setRevealedIds({});
      setPinMode('list');
      setChangeStep('current');
      setChangeBuffer('');
      setChangeCurrent('');
      setChangeNew1('');
    }
  }, [isUnlocked]);

  const pressPin = (digit: string) => {
    if (busy) return;
    if (lockLeft > 0) { onShowToast(`Aguarde ${lockLeft}s — bloqueio de segurança.`); return; }
    playSynthSound('click');
    if (pinBuffer.length >= 6) return;
    const nextPin = pinBuffer + digit;
    setPinBuffer(nextPin);
    if (pinTimer.current) clearTimeout(pinTimer.current);
    // PIN de 4-6 dígitos: 6 valida na hora; 4-5 validam após pausa na digitação
    if (nextPin.length === 6) {
      validatePIN(nextPin);
    } else if (nextPin.length >= 4) {
      pinTimer.current = setTimeout(() => validatePIN(nextPin), 600);
    }
  };

  const clearPin = () => {
    playSynthSound('click');
    if (pinTimer.current) clearTimeout(pinTimer.current);
    setPinBuffer('');
    setHasError(false);
  };

  const backspacePin = () => {
    playSynthSound('click');
    if (pinTimer.current) clearTimeout(pinTimer.current);
    setPinBuffer(pinBuffer.slice(0, -1));
  };

  const shakeNow = () => {
    setIsShaking(true);
    setHasError(true);
    setTimeout(() => setIsShaking(false), 300);
  };

  const openChangePin = () => {
    playSynthSound('click');
    setPinMode('change');
    setChangeStep('current');
    setChangeBuffer('');
    setChangeCurrent('');
    setChangeNew1('');
    setHasError(false);
  };

  const cancelChangePin = () => {
    playSynthSound('click');
    if (pinTimer.current) clearTimeout(pinTimer.current);
    setPinMode('list');
    setChangeStep('current');
    setChangeBuffer('');
    setChangeCurrent('');
    setChangeNew1('');
    setHasError(false);
    setBusy(false);
  };

  const pressChangePin = (digit: string) => {
    if (busy) return;
    playSynthSound('click');
    if (changeBuffer.length >= 6) return;
    const next = changeBuffer + digit;
    setChangeBuffer(next);
    if (pinTimer.current) clearTimeout(pinTimer.current);
    // PIN de 4-6 dígitos: 6 valida na hora; 4-5 validam após pausa na digitação
    if (next.length === 6) {
      validateChangePin(next);
    } else if (next.length >= 4) {
      pinTimer.current = setTimeout(() => validateChangePin(next), 600);
    }
  };

  const clearChangePin = () => {
    playSynthSound('click');
    if (pinTimer.current) clearTimeout(pinTimer.current);
    setChangeBuffer('');
    setHasError(false);
  };

  const backspaceChangePin = () => {
    playSynthSound('click');
    if (pinTimer.current) clearTimeout(pinTimer.current);
    setChangeBuffer(changeBuffer.slice(0, -1));
  };

  const validateChangePin = async (inputPin: string) => {
    if (busy) return;
    if (inputPin.length < 4) return;
    setBusy(true);
    try {
      if (changeStep === 'current') {
        const ok = await onVerifyPin(inputPin);
        if (!ok) {
          playSynthSound('failure');
          shakeNow();
          setChangeBuffer('');
          onShowToast('PIN atual incorreto.');
          return;
        }
        setChangeCurrent(inputPin);
        setChangeBuffer('');
        setHasError(false);
        setChangeStep('new1');
        onShowToast('Digite o novo PIN (4-6 dígitos).');
      } else if (changeStep === 'new1') {
        setChangeNew1(inputPin);
        setChangeBuffer('');
        setChangeStep('new2');
        onShowToast('Confirme o novo PIN.');
      } else {
        if (inputPin !== changeNew1) {
          playSynthSound('failure');
          shakeNow();
          setChangeBuffer('');
          setChangeNew1('');
          setChangeStep('new1');
          onShowToast('Novos PINs divergentes. Digite o novo PIN de novo.');
          return;
        }
        await onChangePin(changeCurrent, inputPin);
        playSynthSound('success');
        setChangeBuffer('');
        setChangeCurrent('');
        setChangeNew1('');
        setChangeStep('current');
        setHasError(false);
        setPinMode('list');
        onShowToast('Novo PIN salvo e cofre recifrado.');
      }
    } catch (e) {
      playSynthSound('failure');
      shakeNow();
      setChangeBuffer('');
      onShowToast((e as Error)?.message || 'Falha ao trocar PIN. Tente novamente.');
    } finally {
      setBusy(false);
    }
  };

  const validatePIN = async (inputPin: string) => {
    if (busy) return;
    if (inputPin.length < 4) return;
    setBusy(true);
    try {
      if (!hasPinSetup) {
        // Fluxo bootstrap obrigatório (REQ-16)
        if (setupStep === 'first') {
          setSetupPin1(inputPin);
          setSetupStep('confirm');
          setPinBuffer('');
          onShowToast('Repita o PIN para confirmar.');
        } else {
          if (inputPin !== setupPin1) {
            playSynthSound('failure');
            setIsShaking(true);
            setHasError(true);
            setTimeout(() => setIsShaking(false), 300);
            setPinBuffer('');
            setSetupStep('first');
            setSetupPin1('');
            onShowToast('PINs divergentes. Recomece.');
          } else {
            await onSetupPin(inputPin);
            playSynthSound('success');
            setPinBuffer('');
            setHasError(false);
            setSetupStep('first');
            setSetupPin1('');
            // zera resíduos em memória
            inputPin = '';
          }
        }
      } else {
        const ok = await onUnlock(inputPin);
        if (ok) {
          playSynthSound('success');
          setPinBuffer('');
          setHasError(false);
        } else {
          playSynthSound('failure');
          setIsShaking(true);
          setHasError(true);
          setTimeout(() => setIsShaking(false), 300);
          setPinBuffer('');
          const left = 5 - (failedAttempts + 1);
          onShowToast(left > 0 ? `PIN inválido. Restam ${left} tentativa(s).` : 'Muitas tentativas. Aguarde 30s.');
        }
        inputPin = '';
      }
    } catch {
      playSynthSound('failure');
      setIsShaking(true);
      setHasError(true);
      setTimeout(() => setIsShaking(false), 300);
      setPinBuffer('');
      onShowToast('Falha ao validar PIN. Tente novamente.');
    } finally {
      setBusy(false);
    }
  };

  const toggleReveal = (id: number) => {
    playSynthSound('click');
    setRevealedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const copyPassword = async (pass: string) => {
    playSynthSound('click');
    try {
      try {
        await navigator.clipboard.writeText(pass);
      } catch {
        const ta = document.createElement('textarea');
        ta.value = pass;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch {}
        ta.remove();
      }
      onShowToast('Senha copiada. Será limpa em 20s.');
      // Limpeza do clipboard (REQ-19/20): sobrescreve após 20s se ainda for igual
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(async () => {
        try {
          const cur = await navigator.clipboard.readText().catch(() => '');
          if (cur === pass) await navigator.clipboard.writeText('');
        } catch {}
      }, 20000);
    } catch {
      onShowToast('Falha ao copiar.');
    }
  };

  if (!isUnlocked) {
    return (
      <section className="p-4 h-full flex flex-col items-center justify-center py-6 space-y-6">
        <div className="w-16 h-16 rounded-3xl bg-orange-500/10 flex items-center justify-center text-orange-400 shadow-lg border border-orange-500/20 animate-pulse">
          <Lock className="w-8 h-8" />
        </div>
        <div className="text-center">
          <h3 className="font-bold text-zinc-100 text-sm">Cofre de Segurança</h3>
          <p className="text-xs text-zinc-500 mt-1">
            {!hasPinSetup
              ? setupStep === 'first'
                ? 'Crie seu PIN de 4 a 6 dígitos (somente 1ª vez)'
                : 'Confirme o PIN criado'
              : 'Insira seu PIN (4-6 dígitos)'}
          </p>
          <p className="text-[9px] text-emerald-500/80 mt-1 font-semibold">AES-256-GCM • PBKDF2 210k • auto-bloqueio 2min</p>
        </div>

        {/* Bolinhas de Entrada de PIN (4-6 dígitos) */}
        <div
          className={`flex justify-center gap-3.5 py-2 ${
            isShaking ? 'shake-active' : ''
          }`}
        >
          {[0, 1, 2, 3, 4, 5].map((idx) => (
            <div
              key={idx}
              className={`w-3.5 h-3.5 rounded-full transition-all ${
                idx < pinBuffer.length
                  ? 'bg-orange-500'
                  : idx < 4
                  ? 'border border-jaspe-border bg-transparent'
                  : 'border border-dashed border-zinc-700 bg-transparent opacity-60'
              }`}
            />
          ))}
        </div>

        {busy && !hasError && (
          <div className="text-[11px] text-zinc-400 font-bold animate-pulse">Verificando...</div>
        )}
        {lockLeft > 0 ? (
          <div className="text-xs text-amber-400 font-bold">
            Bloqueado por segurança — aguarde {lockLeft}s.
          </div>
        ) : hasError ? (
          <div className="text-xs text-red-500 font-bold">
            PIN inválido. Tente novamente.
          </div>
        ) : failedAttempts > 0 ? (
          <div className="text-[10px] text-zinc-500 font-semibold">
            {5 - failedAttempts} tentativa(s) restante(s) antes do bloqueio.
          </div>
        ) : null}

        {/* Teclado Numérico */}
        <div className="grid grid-cols-3 gap-3 w-64 pt-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              onClick={() => pressPin(num)}
              className="py-3 rounded-2xl bg-jaspe-card border border-jaspe-border text-base font-extrabold text-zinc-100 active:bg-white/10 active:scale-95 transition-all shadow-sm"
            >
              {num}
            </button>
          ))}
          <button
            onClick={clearPin}
            className="py-3 text-zinc-400 hover:text-zinc-200 text-xs font-bold transition-all active:scale-95"
          >
            Limpar
          </button>
          <button
            onClick={() => pressPin('0')}
            className="py-3 rounded-2xl bg-jaspe-card border border-jaspe-border text-base font-extrabold text-zinc-100 active:bg-white/10 active:scale-95 transition-all shadow-sm"
          >
            0
          </button>
          <button
            onClick={backspacePin}
            className="py-3 text-zinc-400 hover:text-zinc-200 flex items-center justify-center transition-all active:scale-95"
            aria-label="Apagar dígito"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>
      </section>
    );
  }

  const safeCredentials = (Array.isArray(credentials) ? credentials : []).filter((c) => c && typeof c === 'object');

  // Tela trocar PIN (cofre aberto)
  if (pinMode === 'change') {
    return (
      <section className="p-4 h-full flex flex-col items-center justify-center py-6 space-y-6">
        <div className="w-16 h-16 rounded-3xl bg-orange-500/10 flex items-center justify-center text-orange-400 shadow-lg border border-orange-500/20">
          <Key className="w-8 h-8" />
        </div>
        <div className="text-center">
          <h3 className="font-bold text-zinc-100 text-sm">Criar novo PIN</h3>
          <p className="text-xs text-zinc-500 mt-1">
            {changeStep === 'current'
              ? 'Digite o PIN atual'
              : changeStep === 'new1'
              ? 'Digite o novo PIN (4 a 6 dígitos)'
              : 'Confirme o novo PIN'}
          </p>
        </div>

        {/* Bolinhas de Entrada de PIN (4-6 dígitos) */}
        <div className={`flex justify-center gap-3.5 py-2 ${isShaking ? 'shake-active' : ''}`}>
          {[0, 1, 2, 3, 4, 5].map((idx) => (
            <div
              key={idx}
              className={`w-3.5 h-3.5 rounded-full transition-all ${
                idx < changeBuffer.length
                  ? 'bg-orange-500'
                  : idx < 4
                  ? 'border border-jaspe-border bg-transparent'
                  : 'border border-dashed border-zinc-700 bg-transparent opacity-60'
              }`}
            />
          ))}
        </div>

        {busy && !hasError && (
          <div className="text-[11px] text-zinc-400 font-bold animate-pulse">Verificando...</div>
        )}
        {hasError && (
          <div className="text-xs text-red-500 font-bold">PIN inválido. Tente novamente.</div>
        )}

        {/* Teclado Numérico */}
        <div className="grid grid-cols-3 gap-3 w-64 pt-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              onClick={() => pressChangePin(num)}
              className="py-3 rounded-2xl bg-jaspe-card border border-jaspe-border text-base font-extrabold text-zinc-100 active:bg-white/10 active:scale-95 transition-all shadow-sm"
            >
              {num}
            </button>
          ))}
          <button
            onClick={clearChangePin}
            className="py-3 text-zinc-400 hover:text-zinc-200 text-xs font-bold transition-all active:scale-95"
          >
            Limpar
          </button>
          <button
            onClick={() => pressChangePin('0')}
            className="py-3 rounded-2xl bg-jaspe-card border border-jaspe-border text-base font-extrabold text-zinc-100 active:bg-white/10 active:scale-95 transition-all shadow-sm"
          >
            0
          </button>
          <button
            onClick={backspaceChangePin}
            className="py-3 text-zinc-400 hover:text-zinc-200 flex items-center justify-center transition-all active:scale-95"
            aria-label="Apagar dígito"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        <button
          onClick={cancelChangePin}
          className="py-2 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-bold transition-all active:scale-95"
        >
          Cancelar
        </button>
      </section>
    );
  }

  const q = search.trim().toLowerCase();
  const filteredCreds = safeCredentials.filter(
    (c) => !q || (c?.title || '').toLowerCase().includes(q) || (c?.username || '').toLowerCase().includes(q)
  );
  // Visualização Desbloqueada
  return (
    <section className="p-4 space-y-4 text-left">
      <div className="flex items-center justify-between gap-2">
        {/* Controles dos 4 Modos de Visualização */}
        <div className="flex bg-jaspe-card border border-jaspe-border p-1 rounded-xl gap-0.5">
          <button
            onClick={() => {
              playSynthSound('click');
              setViewMode('grid');
            }}
            className={`p-1.5 rounded-lg transition-all ${
              viewMode === 'grid'
                ? 'bg-orange-600 text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title="Grade (2 colunas)"
            aria-label="Grade"
          >
            <Grid className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              playSynthSound('click');
              setViewMode('list');
            }}
            className={`p-1.5 rounded-lg transition-all ${
              viewMode === 'list'
                ? 'bg-orange-600 text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title="Lista em Linhas"
            aria-label="Lista"
          >
            <Menu className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              playSynthSound('click');
              setViewMode('compact');
            }}
            className={`p-1.5 rounded-lg transition-all ${
              viewMode === 'compact'
                ? 'bg-orange-600 text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title="Bloco Compactado"
            aria-label="Bloco Compactado"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              playSynthSound('click');
              setViewMode('detailed');
            }}
            className={`p-1.5 rounded-lg transition-all ${
              viewMode === 'detailed'
                ? 'bg-orange-600 text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title="Modo Detalhado"
            aria-label="Modo Detalhado"
          >
            <AlignJustify className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => {
              playSynthSound('click');
              onOpenEditModal(null);
            }}
            className="py-1.5 px-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
            title="Nova credencial"
          >
            <Plus className="w-3.5 h-3.5" /> Novo
          </button>
          <button
            onClick={openChangePin}
            className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-white/10 rounded-xl transition-all active:scale-95"
            title="Trocar PIN — criar novo PIN"
            aria-label="Trocar PIN"
          >
            <Key className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              playSynthSound('click');
              onLock();
            }}
            className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl transition-all active:scale-95"
            title="Bloquear cofre"
            aria-label="Bloquear cofre"
          >
            <Lock className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar no cofre (título ou usuário)..."
          className="w-full bg-black/30 border border-white/10 p-2.5 pl-3 rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-orange-500/50"
        />
      </div>
      {/* Galeria de Credenciais com 4 Modos de Visualização */}
      {filteredCreds.length === 0 ? (
        <div className="p-8 text-center bg-jaspe-card rounded-2xl border border-jaspe-border shadow-sm">
          <p className="text-xs text-zinc-500">{safeCredentials.length === 0 ? 'Nenhuma credencial cadastrada no cofre.' : 'Nada encontrado para a busca.'}</p>
        </div>
      ) : viewMode === 'grid' ? (
        /* Modo 1: Grade (2 Colunas) */
        <div className="grid grid-cols-2 gap-2.5">
          {filteredCreds.map((cred) => (
            <div
              key={cred.id}
              onClick={() => onOpenEditModal(cred.id)}
              className="bg-jaspe-card border border-jaspe-border p-3.5 rounded-2xl flex flex-col justify-between space-y-2.5 shadow-sm hover:border-orange-500/40 transition-all cursor-pointer text-left active:scale-98"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-500 shrink-0">
                    <Key className="w-4 h-4" />
                  </div>
                  <span className="text-[8px] bg-white/5 px-1.5 py-0.5 rounded text-zinc-400 font-bold uppercase truncate max-w-[65px]">
                    {cred.category || 'Geral'}
                  </span>
                </div>
                <div className="mt-2 overflow-hidden">
                  <h4 className="font-extrabold text-xs text-zinc-100 truncate">
                    {cred.title || 'Sem título'}
                  </h4>
                  <span className="text-[9px] text-zinc-400 truncate block mt-0.5">
                    {cred.username || '—'}
                  </span>
                  {revealedIds[cred.id] && (
                    <span className="text-[9px] font-mono text-emerald-400 block mt-1 select-all break-all">
                      {cred.pass}
                    </span>
                  )}
                </div>
              </div>

              <div
                className="flex items-center justify-end gap-1.5 border-t border-white/5 pt-2"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => toggleReveal(cred.id)}
                  className="p-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white transition-all active:scale-90"
                  title={revealedIds[cred.id] ? 'Ocultar' : 'Visualizar'}
                  aria-label="Alternar exibição de senha"
                >
                  {revealedIds[cred.id] ? (
                    <EyeOff className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                </button>
                <button
                  onClick={() => copyPassword(cred.pass)}
                  className="p-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white transition-all active:scale-90"
                  title="Copiar Senha"
                  aria-label="Copiar Senha"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : viewMode === 'list' ? (
        /* Modo 2: Lista Compacta */
        <div className="space-y-2 flex flex-col">
          {filteredCreds.map((cred) => (
            <div
              key={cred.id}
              onClick={() => onOpenEditModal(cred.id)}
              className="bg-jaspe-card border border-jaspe-border p-3 rounded-xl flex items-center justify-between shadow-sm hover:border-orange-500/40 transition-all cursor-pointer active:scale-98"
            >
              <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-500 shrink-0">
                  <Key className="w-4 h-4" />
                </div>
                <div className="overflow-hidden min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h4 className="font-extrabold text-xs text-zinc-100 truncate">
                      {cred.title || 'Sem título'}
                    </h4>
                    <span className="text-[8px] bg-white/5 px-1.5 py-0.2 rounded text-zinc-400 font-bold uppercase shrink-0">
                      {cred.category || 'Geral'}
                    </span>
                  </div>
                  <span className="text-[9px] text-zinc-400 truncate block">
                    {cred.username || '—'}
                  </span>
                  {revealedIds[cred.id] && (
                    <span className="text-[9px] font-mono text-emerald-400 block mt-0.5 select-all">
                      {cred.pass}
                    </span>
                  )}
                </div>
              </div>

              <div
                className="flex items-center gap-1.5 shrink-0 ml-2"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => toggleReveal(cred.id)}
                  className="p-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white transition-all active:scale-90"
                  title={revealedIds[cred.id] ? 'Ocultar' : 'Visualizar'}
                  aria-label="Alternar exibição de senha"
                >
                  {revealedIds[cred.id] ? (
                    <EyeOff className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                </button>
                <button
                  onClick={() => copyPassword(cred.pass)}
                  className="p-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white transition-all active:scale-90"
                  title="Copiar Senha"
                  aria-label="Copiar Senha"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : viewMode === 'compact' ? (
        /* Modo 3: Bloco Compactado (Mini-Cards Densos) */
        <div className="grid grid-cols-2 gap-2">
          {filteredCreds.map((cred) => (
            <div
              key={cred.id}
              onClick={() => onOpenEditModal(cred.id)}
              className="bg-jaspe-card border border-jaspe-border p-2.5 rounded-xl flex items-center justify-between shadow-sm hover:border-orange-500/40 transition-all cursor-pointer active:scale-98"
            >
              <div className="overflow-hidden min-w-0 pr-1">
                <div className="flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                  <h4 className="font-extrabold text-[11px] text-zinc-100 truncate">
                    {cred.title || 'Sem título'}
                  </h4>
                </div>
                <span className="text-[9px] text-zinc-400 block truncate mt-0.5">
                  {cred.username || '—'}
                </span>
              </div>

              <div
                className="flex items-center gap-1 shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => toggleReveal(cred.id)}
                  className="p-1 rounded bg-zinc-800/80 text-zinc-400 hover:text-white transition-all active:scale-90"
                  title={revealedIds[cred.id] ? 'Ocultar' : 'Visualizar'}
                  aria-label="Alternar exibição de senha"
                >
                  {revealedIds[cred.id] ? (
                    <EyeOff className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Eye className="w-3 h-3" />
                  )}
                </button>
                <button
                  onClick={() => copyPassword(cred.pass)}
                  className="p-1 rounded bg-zinc-800/80 text-zinc-400 hover:text-white transition-all active:scale-90"
                  title="Copiar Senha"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Modo 4: Detalhado / Completo */
        <div className="space-y-3">
          {filteredCreds.map((cred) => (
            <div
              key={cred.id}
              onClick={() => onOpenEditModal(cred.id)}
              className="bg-jaspe-card border border-jaspe-border p-4 rounded-2xl space-y-3 shadow-sm hover:border-orange-500/40 transition-all cursor-pointer text-left"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500 shrink-0">
                    <Key className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-zinc-100">{cred.title || 'Sem título'}</h4>
                    <span className="text-[10px] text-zinc-400 block">{cred.username || '—'}</span>
                  </div>
                </div>
                <span className="text-[9px] bg-orange-500/15 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-full font-bold uppercase">
                  {cred.category || 'Geral'}
                </span>
              </div>

              {/* Informações detalhadas */}
              <div className="bg-black/30 p-2.5 rounded-xl border border-white/5 space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500 text-[10px]">Senha:</span>
                  <div
                    className="flex items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="font-mono font-bold text-emerald-400">
                      {revealedIds[cred.id] ? cred.pass : '••••••••••••'}
                    </span>
                    <button
                      onClick={() => toggleReveal(cred.id)}
                      className="p-1 text-zinc-400 hover:text-white"
                      title={revealedIds[cred.id] ? 'Ocultar' : 'Revelar'}
                    >
                      {revealedIds[cred.id] ? (
                        <EyeOff className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => copyPassword(cred.pass)}
                      className="p-1 text-zinc-400 hover:text-white"
                      title="Copiar"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {cred.url && (
                  <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[10px]">
                    <span className="text-zinc-500">Website:</span>
                    <span className="text-zinc-300 font-mono truncate max-w-[180px]">
                      {cred.url}
                    </span>
                  </div>
                )}
                {cred.notes && (
                  <div className="pt-1 border-t border-white/5 text-[10px]">
                    <span className="text-zinc-500 block mb-0.5">Notas de Segurança:</span>
                    <p className="text-zinc-300 text-[10px] leading-relaxed">{cred.notes}</p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-1">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> AES-256-GCM • PBKDF2
                </span>
                <span className="text-orange-400 font-bold hover:underline">
                  Clique para Editar →
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
