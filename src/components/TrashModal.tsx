import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Trash2,
  RotateCcw,
  AlertTriangle,
  Search,
  LayoutGrid,
  Menu,
  Notebook,
  User,
  CheckSquare,
  Wallet,
  FileText,
  Lock
} from 'lucide-react';
import { TrashedItem } from '../utils/ids';
import { playSynthSound } from '../utils/audio';

interface TrashModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: TrashedItem[];
  onRestore: (id: string) => void;
  onDeleteForever: (id: string) => void;
  onEmpty: () => void;
}

type KindKey = 'note' | 'contact' | 'task' | 'asset' | 'document' | 'credential';

const KIND_META: Record<KindKey, { label: string; icon: typeof Notebook; tile: string }> = {
  note: { label: 'Anotação', icon: Notebook, tile: 'bg-blue-500/15 text-blue-300' },
  contact: { label: 'Contato', icon: User, tile: 'bg-emerald-500/15 text-emerald-300' },
  task: { label: 'Tarefa', icon: CheckSquare, tile: 'bg-pink-500/15 text-pink-300' },
  asset: { label: 'Ativo', icon: Wallet, tile: 'bg-cyan-500/15 text-cyan-300' },
  document: { label: 'Documento', icon: FileText, tile: 'bg-orange-500/15 text-orange-300' },
  credential: { label: 'Credencial', icon: Lock, tile: 'bg-amber-500/15 text-amber-300' },
};

const KIND_ORDER: KindKey[] = ['note', 'contact', 'task', 'asset', 'document', 'credential'];

function kindOf(item: TrashedItem): KindKey | null {
  return (KIND_ORDER as string[]).includes(item.kind) ? (item.kind as KindKey) : null;
}

function titleOf(item: TrashedItem): string {
  const d = (item.data && typeof item.data === 'object' ? item.data : {}) as Record<string, unknown>;
  const s = (v: unknown) => (typeof v === 'string' ? v : '');
  switch (item.kind) {
    case 'note': return s(d.title) || 'Sem título';
    case 'contact': return s(d.name) || 'Sem nome';
    case 'task': return s(d.text) || 'Sem descrição';
    case 'asset': return s(d.ticker) || s(d.name) || 'Sem ticker';
    case 'document': return s(d.title) || 'Sem título';
    case 'credential': return s(d.title) || 'Sem título';
    default: return 'Item';
  }
}

function daysLeft(item: TrashedItem): number {
  const ms = Date.now() - new Date(item.deletedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 30;
  return Math.max(0, 30 - Math.floor(ms / 86400000));
}

export default function TrashModal({ isOpen, onClose, items, onRestore, onDeleteForever, onEmpty }: TrashModalProps) {
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<'all' | KindKey>('all');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
    try {
      const v = localStorage.getItem('jaspe_trash_view');
      if (v === 'grid' || v === 'list') return v;
    } catch {}
    return 'list';
  });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('jaspe_trash_view', viewMode);
    } catch {}
  }, [viewMode]);

  useEffect(() => {
    if (!isOpen) {
      setConfirmEmpty(false);
      setConfirmId(null);
      setQuery('');
      setKindFilter('all');
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isOpen]);

  const safeItems = useMemo(() => {
    const arr = Array.isArray(items) ? items : [];
    return [...arr].sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());
  }, [items]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    safeItems.forEach((it) => {
      c[it.kind] = (c[it.kind] || 0) + 1;
    });
    return c;
  }, [safeItems]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return safeItems.filter((it) => {
      if (kindFilter !== 'all' && it.kind !== kindFilter) return false;
      if (!q) return true;
      const meta = kindOf(it);
      const hay = `${titleOf(it)} ${(meta && KIND_META[meta].label) || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [safeItems, query, kindFilter]);

  if (!isOpen) return null;

  const armConfirm = (setter: (v: any) => void, value: any) => {
    playSynthSound('click');
    setter(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setConfirmEmpty(false);
      setConfirmId(null);
    }, 4000);
  };

  const daysPill = (left: number) => (
    <span
      className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap ${
        left <= 5
          ? 'bg-red-500/20 text-red-300'
          : 'bg-black/30 text-zinc-400 border border-white/10'
      }`}
    >
      {left === 0 ? 'some hoje' : `${left}d`}
    </span>
  );

  const restoreBtn = (item: TrashedItem, compact = false) => (
    <button
      type="button"
      onClick={() => { playSynthSound('success'); onRestore(item.id); }}
      className={`${compact ? 'p-2' : 'flex-1 py-2'} bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 text-[11px] font-extrabold rounded-xl transition-all active:scale-95 flex items-center justify-center gap-1`}
      title="Restaurar"
      aria-label={`Restaurar ${titleOf(item)}`}
    >
      <RotateCcw className="w-3.5 h-3.5" />
      {!compact && 'Restaurar'}
    </button>
  );

  const deleteBtn = (item: TrashedItem, compact = false) => {
    const confirming = confirmId === item.id;
    return (
      <button
        type="button"
        onClick={() => {
          if (confirming) {
            setConfirmId(null);
            onDeleteForever(item.id);
          } else {
            armConfirm(setConfirmId, item.id);
          }
        }}
        className={`${compact ? 'p-2' : 'flex-1 py-2'} text-[11px] font-extrabold rounded-xl border transition-all active:scale-95 flex items-center justify-center gap-1 ${
          confirming
            ? 'bg-red-600 border-red-600 text-white'
            : 'bg-red-500/10 border-red-500/25 text-red-400 hover:bg-red-500/20'
        }`}
        title={confirming ? 'Toque para confirmar' : 'Excluir definitivamente'}
        aria-label={confirming ? 'Confirmar exclusão' : `Excluir ${titleOf(item)}`}
      >
        <Trash2 className="w-3.5 h-3.5" />
        {!compact && (confirming ? 'Confirmar' : 'Excluir')}
      </button>
    );
  };

  return (
    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-3">
      <div className="w-full bg-[#1A1311] border border-jaspe-border rounded-[28px] p-6 max-h-[90%] overflow-y-auto space-y-4 text-left">
        <div className="flex items-center justify-between border-b border-jaspe-border pb-3">
          <h3 className="font-extrabold text-sm text-zinc-100 flex items-center gap-2">
            <span className="w-7 h-7 rounded-xl bg-red-500/15 flex items-center justify-center">
              <Trash2 className="w-4 h-4 text-red-400" />
            </span>
            Lixeira
            <span className="text-[9px] bg-black/30 px-2 py-0.5 rounded-full text-zinc-300 border border-white/10 font-bold">
              {safeItems.length}
            </span>
          </h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-[10px] text-zinc-500">
          Itens apagados ficam aqui por <strong className="text-zinc-300">30 dias</strong> antes da exclusão definitiva automática.
        </p>

        {safeItems.length === 0 ? (
          <div className="p-8 text-center bg-white/5 border border-white/5 rounded-2xl">
            <Trash2 className="w-8 h-8 text-zinc-600 mx-auto" />
            <p className="text-xs text-zinc-400 font-bold mt-3">Lixeira vazia</p>
            <p className="text-[10px] text-zinc-500 mt-1">Nada por aqui — tudo certo.</p>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => {
                if (confirmEmpty) {
                  setConfirmEmpty(false);
                  onEmpty();
                } else {
                  armConfirm(setConfirmEmpty, true);
                }
              }}
              className={`w-full py-2.5 text-xs font-extrabold rounded-xl border transition-all active:scale-95 flex items-center justify-center gap-1.5 ${
                confirmEmpty
                  ? 'bg-red-600 border-red-600 text-white'
                  : 'bg-red-500/10 border-red-500/25 text-red-400 hover:bg-red-500/20'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              {confirmEmpty ? 'Toque de novo p/ esvaziar tudo' : 'Esvaziar lixeira'}
            </button>

            {/* Busca */}
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar na lixeira..."
                className="w-full bg-[#251C1A] border border-jaspe-border pl-9 pr-3 py-2.5 rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-orange-500/50"
              />
            </div>

            {/* Filtro por tipo */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
              <button
                type="button"
                onClick={() => { playSynthSound('click'); setKindFilter('all'); }}
                className={`px-3 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap border transition-all active:scale-95 ${
                  kindFilter === 'all'
                    ? 'bg-orange-600 border-orange-600 text-white'
                    : 'bg-white/5 border-white/10 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Todos ({safeItems.length})
              </button>
              {KIND_ORDER.filter((k) => (counts[k] || 0) > 0).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => { playSynthSound('click'); setKindFilter(k); }}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap border transition-all active:scale-95 ${
                    kindFilter === k
                      ? 'bg-orange-600 border-orange-600 text-white'
                      : 'bg-white/5 border-white/10 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {KIND_META[k].label} ({counts[k]})
                </button>
              ))}
            </div>

            {/* Contador + modo de visualização */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-zinc-500 font-bold">
                {visible.length === safeItems.length
                  ? `${safeItems.length} item(ns)`
                  : `${visible.length} de ${safeItems.length}`}
              </span>
              <div className="flex bg-black/30 border border-white/10 p-0.5 rounded-lg gap-0.5">
                <button
                  type="button"
                  onClick={() => { playSynthSound('click'); setViewMode('list'); }}
                  className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-orange-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                  title="Lista"
                  aria-label="Modo lista"
                >
                  <Menu className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => { playSynthSound('click'); setViewMode('grid'); }}
                  className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-orange-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                  title="Grade"
                  aria-label="Modo grade"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {visible.length === 0 ? (
              <div className="p-6 text-center bg-white/5 border border-white/5 rounded-2xl">
                <Search className="w-6 h-6 text-zinc-600 mx-auto" />
                <p className="text-xs text-zinc-400 font-bold mt-2">Nada encontrado</p>
                <p className="text-[10px] text-zinc-500 mt-1">Ajuste a busca ou o filtro de tipo.</p>
              </div>
            ) : viewMode === 'list' ? (
              <div className="space-y-2">
                {visible.map((item) => {
                  const meta = kindOf(item);
                  const Icon = meta ? KIND_META[meta].icon : FileText;
                  const tile = meta ? KIND_META[meta].tile : 'bg-white/10 text-zinc-300';
                  const isCredential = item.kind === 'credential';
                  return (
                    <div key={item.id} className="bg-white/5 border border-white/5 rounded-2xl p-3 flex gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tile}`}>
                        <Icon className="w-4.5 h-4.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-bold text-xs text-zinc-100 truncate">{titleOf(item)}</div>
                          {daysPill(daysLeft(item))}
                        </div>
                        <div className="text-[9px] text-zinc-500 mt-0.5 truncate">
                          {(meta && KIND_META[meta].label) || item.kind} • apagado em {new Date(item.deletedAt).toLocaleDateString('pt-BR')}
                        </div>
                        {isCredential && (
                          <p className="text-[9px] text-amber-400/90 mt-1">
                            Mascarada por segurança — recuperável apenas pelo backup .jaspe.
                          </p>
                        )}
                        <div className="flex gap-2 mt-2">
                          {!isCredential && restoreBtn(item)}
                          {deleteBtn(item)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {visible.map((item) => {
                  const meta = kindOf(item);
                  const Icon = meta ? KIND_META[meta].icon : FileText;
                  const tile = meta ? KIND_META[meta].tile : 'bg-white/10 text-zinc-300';
                  const isCredential = item.kind === 'credential';
                  return (
                    <div key={item.id} className="bg-white/5 border border-white/5 rounded-2xl p-3 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${tile}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        {daysPill(daysLeft(item))}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-[11px] text-zinc-100 truncate">{titleOf(item)}</div>
                        <div className="text-[8px] text-zinc-500 truncate">
                          {(meta && KIND_META[meta].label) || item.kind}
                        </div>
                      </div>
                      <div className="flex gap-1.5 mt-auto">
                        {!isCredential && restoreBtn(item, true)}
                        {deleteBtn(item, true)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </>
        )}
      </div>
    </div>
  );
}
