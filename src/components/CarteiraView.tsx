import React, { useState, useRef } from 'react';
import { assetsToCSV, assetsToXLS, simulateSnowball, getBrapiToken } from '../utils/finance';
import {
  RefreshCw,
  Plus,
  FileText,
  FileSpreadsheet,
  File,
  Grid,
  Menu,
  Grid3X3,
  Layers,
  TrendingUp,
  TrendingDown,
  Edit3,
  ChevronDown,
  Trash2
} from 'lucide-react';
import { Asset, Provento } from '../types';
import { playSynthSound } from '../utils/audio';

interface CarteiraViewProps {
  assets: Asset[];
  proventos: Provento[];
  onOpenEditAssetModal: (id: number | null) => void;
  onOpenPDFImportModal: () => void;
  onTriggerYahooSync: () => void;
  onShowToast: (msg: string) => void;
  isYahooSyncing: boolean;
  lastSyncInfo?: { at: string; ok: number; fail: number; detail: string } | null;
  onDeleteAsset?: (id: number) => void;
  onOpenProfile?: () => void;
}

export default function CarteiraView({
  assets,
  proventos,
  onOpenEditAssetModal,
  onOpenPDFImportModal,
  onTriggerYahooSync,
  onShowToast,
  isYahooSyncing,
  lastSyncInfo,
  onDeleteAsset,
  onOpenProfile
}: CarteiraViewProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'compact' | 'detailed'>(() => {
    try {
      const saved = localStorage.getItem('jaspe_carteira_view');
      if (saved === 'grid' || saved === 'list' || saved === 'compact' || saved === 'detailed') {
        return saved;
      }
    } catch {
      // fallback
    }
    return 'detailed';
  });

  const handleSetViewMode = (mode: 'grid' | 'list' | 'compact' | 'detailed') => {
    playSynthSound('click');
    setViewMode(mode);
    try {
      localStorage.setItem('jaspe_carteira_view', mode);
    } catch (e) {
      console.warn('Erro ao salvar viewMode', e);
    }
  };

  const safeAssets = (Array.isArray(assets) ? assets : []).filter((a) => a && typeof a === 'object');
  const safeProventos = (Array.isArray(proventos) ? proventos : []).filter((p) => p && typeof p === 'object');
  const totalPatrimonio = safeAssets.reduce((acc, a) => acc + (Number(a?.qty) || 0) * (Number(a?.currentPrice) || 0), 0);
  const totalCusto = safeAssets.reduce((acc, a) => acc + (Number(a?.qty) || 0) * (Number(a?.avgPrice) || 0), 0);
  const totalProventos = safeProventos.reduce((acc, p) => acc + (Number(p?.amount) || 0), 0);
  const totalRetorno = totalPatrimonio - totalCusto;
  const returnPct = totalCusto > 0 ? ((totalRetorno / totalCusto) * 100).toFixed(1) : '0.0';

  const [snowMonthly, setSnowMonthly] = useState(500);
  // Alocação real por classe (nada hardcoded — soma qty*currentPrice)
  const CAT_COLORS: Record<string, string> = {
    'Ações': '#3B82F6',
    'FIIs': '#10B981',
    'Renda Fixa': '#8B5CF6',
    'Cripto': '#D97706'
  };
  const EXTRA_COLORS = ['#EC4899', '#14B8A6', '#F59E0B', '#6366F1', '#84CC16'];
  const allocation = (() => {
    const totals = new Map<string, number>();
    safeAssets.forEach((a) => {
      const cat = (a?.category || 'Outros').trim() || 'Outros';
      totals.set(cat, (totals.get(cat) || 0) + (Number(a?.qty) || 0) * (Number(a?.currentPrice) || 0));
    });
    let extra = 0;
    return [...totals.entries()]
      .map(([cat, value]) => ({
        cat,
        value,
        pct: totalPatrimonio > 0 ? (value / totalPatrimonio) * 100 : 0,
        color: CAT_COLORS[cat] || EXTRA_COLORS[extra++ % EXTRA_COLORS.length]
      }))
      .sort((a, b) => b.value - a.value);
  })();
  // pathLength=100: dashoffset 25 = início no topo; cada fatia começa no acumulado
  let allocAcc = 0;
  const allocSegs = allocation.map((s) => ({ ...s, start: (allocAcc += s.pct, allocAcc - s.pct) }));
  const [snowYears, setSnowYears] = useState(10);
  const [snowYield, setSnowYield] = useState(8);
  const [showSnow, setShowSnow] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const dragRef = React.useRef({ down: false, startX: 0, startScroll: 0, moved: false });
  const onDragStart = (e: React.PointerEvent) => {
    const el = scrollRef.current;
    if (!el) return;
    dragRef.current = { down: true, startX: e.clientX, startScroll: el.scrollLeft, moved: false };
  };
  const onDragMove = (e: React.PointerEvent) => {
    const el = scrollRef.current;
    const d = dragRef.current;
    if (!d.down || !el) return;
    const dx = e.clientX - d.startX;
    if (Math.abs(dx) > 6) d.moved = true;
    if (d.moved) el.scrollLeft = d.startScroll - dx;
  };
  const endDrag = () => { dragRef.current.down = false; };
  const swallowClickAfterDrag = (e: React.SyntheticEvent) => {
    if (dragRef.current.moved) { e.stopPropagation(); e.preventDefault(); dragRef.current.moved = false; }
  };
  const fmt2 = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const toggleOne = (id: number) => {
    playSynthSound('click');
    setConfirmBulk(false);
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const allIds = safeAssets.map((a) => a.id);
  const allIdSet = new Set(allIds);
  // Seleção saneada: ignora ids fantasmas (excluídos ou de outra lista)
  const selValid = selectedIds.filter((id) => allIdSet.has(id));
  const selSet = new Set(selValid);
  const allChecked = safeAssets.length > 0 && selValid.length === safeAssets.length;
  const toggleAll = () => {
    playSynthSound('click');
    setConfirmBulk(false);
    setSelectedIds(allChecked ? [] : [...allIds]);
  };
  const doBulkDelete = () => {
    if (!onDeleteAsset) { onShowToast('Exclusão indisponível.'); return; }
    if (selValid.length === 0) { setSelectedIds([]); setConfirmBulk(false); return; }
    selValid.forEach((id) => onDeleteAsset(id));
    setSelectedIds([]);
    setConfirmBulk(false);
    triggerConfettiSafe();
    onShowToast(selValid.length + ' ativo(s) movidos p/ lixeira.');
  };
  const snowRef = useRef<HTMLDivElement | null>(null);
  const snowTouchY = useRef<number | null>(null);
  const snowSuppressTap = useRef(false);
  const toggleSnow = () => {
    if (snowSuppressTap.current) {
      snowSuppressTap.current = false;
      return;
    }
    playSynthSound('click');
    const next = !showSnow;
    setShowSnow(next);
    if (next) setTimeout(() => snowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  };
  const snowYearsClamped = Math.min(40, Math.max(1, Number.isFinite(snowYears) ? snowYears : 10));
  const snowData = showSnow ? simulateSnowball({ initial: Number(totalPatrimonio) || 0, monthly: Number(snowMonthly) || 0, annualYieldPct: Number(snowYield) || 0, years: snowYearsClamped }) : [];
  const snowFinal = snowData.length ? snowData[snowData.length - 1] : null;

  const triggerConfettiSafe = () => { try { playSynthSound('success'); } catch {} };
  const dl = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };
  // Export unidirecional JASPE -> Planilha (REQ-36). Nada volta p/ dentro.
  const handleExport = (format: 'xlsx' | 'csv' | 'pdf') => {
    playSynthSound('click');
    if (safeAssets.length === 0) { onShowToast('Nenhum ativo para exportar.'); return; }
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === 'csv') {
      dl(`jaspe_carteira_${stamp}.csv`, assetsToCSV(safeAssets), 'text/csv;charset=utf-8');
      onShowToast('Planilha CSV exportada (JASPE -> Excel).');
    } else if (format === 'xlsx') {
      dl(`jaspe_carteira_${stamp}.xls`, assetsToXLS(safeAssets), 'application/vnd.ms-excel');
      onShowToast('Planilha Excel exportada (JASPE -> Excel).');
    } else {
      window.print();
      onShowToast('Use Imprimir -> Salvar como PDF.');
    }
  };

  return (
    <section className="p-4 space-y-6 text-left">
      {/* Camada 1: Painel de KPIs Ultra-Compacto e Harmônico */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-jaspe-card border border-jaspe-border p-3 rounded-xl shadow-sm text-left">
          <span className="text-[8px] text-zinc-400 font-bold uppercase tracking-wider block">
            Patrimônio
          </span>
          <strong className="text-xs font-extrabold text-zinc-100 block mt-1">
            R$ {totalPatrimonio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </strong>
          <span className="text-[7px] text-zinc-400 block mt-0.5">
            Custo: R$ {(totalCusto / 1000).toFixed(0)}k
          </span>
        </div>

        <div className="bg-jaspe-card border border-jaspe-border p-3 rounded-xl shadow-sm text-left">
          <span className="text-[8px] text-zinc-400 font-bold uppercase tracking-wider block">
            Proventos
          </span>
          <strong className="text-xs font-extrabold text-emerald-400 block mt-1">
            R$ {totalProventos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </strong>
          <span className="text-[7px] text-zinc-400 block mt-0.5">
            {safeProventos.length} lançamentos
          </span>
        </div>

        <div className="bg-jaspe-card border border-jaspe-border p-3 rounded-xl shadow-sm text-left">
          <span className="text-[8px] text-zinc-400 font-bold uppercase tracking-wider block">
            Retorno
          </span>
          <strong className="text-xs font-extrabold text-emerald-400 block mt-1">
            R$ {totalRetorno.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </strong>
          <span className={`text-[7px] px-1 py-0.5 rounded font-bold inline-block mt-0.5 ${totalRetorno >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
            {totalRetorno >= 0 ? '+' : ''}{returnPct}%
          </span>
        </div>
      </div>

      {/* Camada 2: Gráfico de Rosca de Alocação */}
      <div className="bg-jaspe-card border border-jaspe-border p-4 rounded-3xl space-y-3">
        <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider text-left">
          Distribuição da Carteira
        </h4>
        <div className="flex items-center justify-around">
          {allocation.length === 0 ? (
            <p className="text-[10px] text-zinc-500 py-6">Sem ativos — adicione para ver a distribuição real.</p>
          ) : (
          <>
          <svg className="w-20 h-20" viewBox="0 0 80 80">
            <circle
              cx="40"
              cy="40"
              r="30"
              fill="transparent"
              stroke="#352824"
              strokeWidth="10"
            />
            {allocSegs.map((s) => (
              <circle
                key={s.cat}
                cx="40"
                cy="40"
                r="30"
                fill="transparent"
                stroke={s.color}
                strokeWidth="10"
                pathLength={100}
                strokeDasharray={`${Math.max(0, s.pct - 0.6)} 100`}
                strokeDashoffset={25 - s.start}
                strokeLinecap="butt"
              />
            ))}
          </svg>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[9px] text-zinc-400">
            {allocation.map((s) => (
              <div key={s.cat} className="flex items-center gap-1" title={`R$ ${s.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}>
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }}></div>
                <span className="truncate">{s.cat}: {s.pct.toFixed(1)}%</span>
              </div>
            ))}
          </div>
          </>
          )}
        </div>
      </div>

      {/* Camada 3: Deck de Controle e Operações */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-1.5">
          <button
            onClick={onTriggerYahooSync}
            disabled={isYahooSyncing}
            className="flex-1 py-2 px-1.5 bg-jaspe-card hover:bg-[#352824] text-zinc-200 border border-jaspe-border rounded-xl text-[9px] font-bold flex items-center justify-center gap-1 active:scale-95 transition-all"
          >
            <RefreshCw
              className={`w-3 h-3 text-orange-400 ${
                isYahooSyncing ? 'animate-spin' : ''
              }`}
            />{' '}
            Atualizar carteira
          </button>
          <button
            onClick={() => onOpenEditAssetModal(null)}
            className="flex-1 py-2 px-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-[9px] font-bold flex items-center justify-center gap-1 active:scale-95 transition-all shadow-sm"
          >
            <Plus className="w-3 h-3" /> Novo Ativo
          </button>
          <button
            onClick={onOpenPDFImportModal}
            className="flex-1 py-2 px-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 rounded-xl text-[9px] font-bold flex items-center justify-center gap-1 active:scale-95 transition-all"
          >
            <FileText className="w-3 h-3" /> Importar PDF
          </button>
        </div>
        <p className="text-center text-zinc-500 font-semibold" style={{ fontSize: 9 }}>
          {isYahooSyncing
            ? 'Buscando cotações…'
            : lastSyncInfo
            ? `Última atualização: ${new Date(lastSyncInfo.at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} • ${lastSyncInfo.ok} ok / ${lastSyncInfo.fail} falhas${lastSyncInfo.fail > 0 && lastSyncInfo.detail ? ` • ${lastSyncInfo.detail.slice(0, 80)}` : ''}`
            : 'Nunca sincronizado — toque em Atualizar carteira'}
        </p>

        {!getBrapiToken() && (
          <button
            type="button"
            onClick={onOpenProfile}
            className="w-full text-center text-amber-400/90 font-semibold bg-amber-500/10 border border-amber-500/20 rounded-lg py-1.5 px-2 hover:bg-amber-500/15 transition-all"
            style={{ fontSize: 9 }}
          >
            Sem token Brapi — só PETR4/MGLU3/VALE3/ITUB4 atualizam direto. Toque para configurar em Perfil.
          </button>
        )}

        {/* Exportações (card expansível) + Bola de Neve e Seletores de View */}
        <div className="flex items-center justify-between border-t border-b border-jaspe-border py-2.5">
          <div className="flex gap-2">
            <div className="relative">
              <button
                onClick={() => {
                  playSynthSound('click');
                  setShowExport((v) => !v);
                }}
                className="p-1.5 bg-zinc-800 rounded text-[9px] font-bold text-zinc-300 flex items-center gap-1 hover:text-white transition-all active:scale-95"
                title="Exportar carteira (JASPE -> Planilha, unidirecional)"
                aria-haspopup="menu"
                aria-expanded={showExport}
              >
                <FileSpreadsheet className="w-3 h-3 text-emerald-500" /> Exportar
                <ChevronDown className={`w-3 h-3 transition-transform ${showExport ? 'rotate-180' : ''}`} />
              </button>
              {showExport && (
                <div className="absolute left-0 top-full mt-1.5 w-44 rounded-2xl border border-jaspe-border bg-[#1A1311] shadow-2xl z-30 overflow-hidden p-1.5 space-y-1">
                  <button
                    onClick={() => {
                      handleExport('xlsx');
                      setShowExport(false);
                    }}
                    className="w-full px-2.5 py-2 rounded-xl text-[10px] font-bold text-zinc-200 hover:bg-white/5 flex items-center gap-2 transition-all text-left"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> Excel (.xls)
                  </button>
                  <button
                    onClick={() => {
                      handleExport('csv');
                      setShowExport(false);
                    }}
                    className="w-full px-2.5 py-2 rounded-xl text-[10px] font-bold text-zinc-200 hover:bg-white/5 flex items-center gap-2 transition-all text-left"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-blue-400 shrink-0" /> CSV
                  </button>
                  <button
                    onClick={() => {
                      handleExport('pdf');
                      setShowExport(false);
                    }}
                    className="w-full px-2.5 py-2 rounded-xl text-[10px] font-bold text-zinc-200 hover:bg-white/5 flex items-center gap-2 transition-all text-left"
                  >
                    <File className="w-3.5 h-3.5 text-red-500 shrink-0" /> PDF
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={toggleSnow}
              className={`p-1.5 rounded text-[9px] font-bold flex items-center gap-1 transition-all active:scale-95 border ${
                showSnow
                  ? 'bg-amber-500 text-white border-amber-500 shadow'
                  : 'bg-amber-500/15 border-amber-500/30 text-amber-300 hover:bg-amber-500/25'
              }`}
              title="Simulador Bola de Neve (REQ-38)"
              aria-pressed={showSnow}
            >
              <TrendingUp className="w-3 h-3" /> Bola de Neve
            </button>
          </div>
          <div className="flex bg-jaspe-card border border-jaspe-border p-1 rounded-xl shadow-sm gap-0.5">
            <button
              onClick={() => handleSetViewMode('grid')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'grid'
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="Modo Grade (Cards em 2 Colunas)"
              aria-label="Grade"
            >
              <Grid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleSetViewMode('list')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'list'
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="Modo Lista (Linhas Compactas)"
              aria-label="Lista"
            >
              <Menu className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleSetViewMode('compact')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'compact'
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="Modo Bloco Compactado (Mini-Cards Densos)"
              aria-label="Bloco Compactado"
            >
              <Grid3X3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleSetViewMode('detailed')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'detailed'
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="Modo Detalhado / Completo (Todas as Métricas & Detalhes)"
              aria-label="Detalhado"
            >
              <Layers className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Camada 4: Listagem de Ativos Dinâmica com 4 Modos de Visualização */}
      {safeAssets.length === 0 ? (
        <div className="p-8 text-center bg-jaspe-card rounded-2xl border border-jaspe-border shadow-sm">
          <p className="text-xs text-zinc-500">Nenhum ativo cadastrado na carteira.</p>
        </div>
      ) : (
        <>
          {/* MODO 1: DETALHADO / COMPLETO (Visão radiográfica com todas as métricas) */}
          {viewMode === 'detailed' && (
  <div className="space-y-2">
    <div className="flex items-center justify-between px-1">
      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Visão completa — todas as métricas</span>
      <span className="text-[9px] text-zinc-500 font-bold">{safeAssets.length} ativo(s)</span>
    </div>
    {selValid.length > 0 && (
      <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-[10px] font-bold text-red-300">
        <span>{selValid.length} selecionado(s)</span>
        {confirmBulk ? (
          <span className="flex gap-1.5">
            <button onClick={doBulkDelete} className="px-2.5 py-1 rounded-lg bg-red-600 text-white">Excluir</button>
            <button onClick={() => setConfirmBulk(false)} className="px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-300">Não</button>
          </span>
        ) : (
          <button onClick={() => setConfirmBulk(true)} className="px-2.5 py-1 rounded-lg bg-red-500/20 border border-red-500/30">Excluir</button>
        )}
      </div>
    )}
    <div className="rounded-2xl border border-jaspe-border overflow-hidden relative">
      <div ref={scrollRef} onPointerDown={onDragStart} onPointerMove={onDragMove} onPointerUp={endDrag} onPointerLeave={endDrag} onPointerCancel={endDrag} onClickCapture={swallowClickAfterDrag} className="overflow-x-auto table-scroll cursor-grab active:cursor-grabbing">
        <table className="w-full text-[10px] border-collapse bg-white/[0.02]" style={{ minWidth: 720 }}>
          <thead>
            <tr className="bg-black/40 text-zinc-400 uppercase tracking-wider" style={{ fontSize: 8 }}>
              <th className="p-2.5 text-center" style={{ width: 32 }}><input type="checkbox" checked={allChecked} onChange={toggleAll} className="accent-orange-600" style={{ width: 14, height: 14 }} aria-label="Selecionar todos" /></th>
              <th className="p-2.5 text-left">Ticker / Nome</th>
              <th className="p-2.5 text-left">Categoria</th>
              <th className="p-2.5 text-right">Qtd.</th>
              <th className="p-2.5 text-right">Preço médio</th>
              <th className="p-2.5 text-right">Preço atual</th>
              <th className="p-2.5 text-right">Total investido</th>
              <th className="p-2.5 text-right">Valor atual</th>
              <th className="p-2.5 text-right">Rentab. (%)</th>
              <th className="p-2.5 text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {safeAssets.map((a, rowIdx) => {
              const qty = Number(a && a.qty) || 0;
              const avg = Number(a && a.avgPrice) || 0;
              const cur = Number(a && a.currentPrice) || 0;
              const invested = qty * avg;
              const current = qty * cur;
              const pct = avg > 0 ? ((cur - avg) / avg) * 100 : 0;
              const pos = current - invested >= 0;
              const checked = selSet.has(a.id);
              return (
                <tr key={a?.id ?? `asset-${rowIdx}`} className={'border-t border-white/5' + (checked ? ' bg-orange-500/5' : '')}>
                  <td className="p-2.5 text-center"><input type="checkbox" checked={checked} onChange={() => toggleOne(a.id)} className="accent-orange-600" style={{ width: 14, height: 14 }} aria-label={'Selecionar ' + (a && a.ticker)} /></td>
                  <td className="p-2.5"><strong className="block text-zinc-100" style={{ fontSize: 11 }}>{(a && a.ticker) || '—'}</strong><span className="block text-zinc-500 truncate" style={{ fontSize: 9, maxWidth: 140 }}>{(a && a.name) || ''}</span></td>
                  <td className="p-2.5"><span className="font-bold px-1.5 py-0.5 rounded border bg-white/5 text-zinc-300 border-white/10 whitespace-nowrap" style={{ fontSize: 8 }}>{(a && a.category) || '—'}</span></td>
                  <td className="p-2.5 text-right text-zinc-200 font-semibold">{qty.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}</td>
                  <td className="p-2.5 text-right text-zinc-300">R$ {fmt2(avg)}</td>
                  <td className="p-2.5 text-right text-zinc-100 font-semibold">R$ {fmt2(cur)}</td>
                  <td className="p-2.5 text-right text-zinc-400">R$ {fmt2(invested)}</td>
                  <td className="p-2.5 text-right text-zinc-100 font-extrabold">R$ {fmt2(current)}</td>
                  <td className={'p-2.5 text-right font-extrabold ' + (pos ? 'text-emerald-400' : 'text-red-400')}>{pos ? '+' : ''}{pct.toFixed(2)}%</td>
                  <td className="p-2.5"><span className="flex items-center justify-center gap-1">
                    <button onClick={() => onOpenEditAssetModal(a.id)} className="p-1.5 rounded-lg bg-white/5 text-zinc-400 hover:text-orange-400 hover:bg-orange-500/10 transition-all active:scale-90" title="Editar" aria-label={'Editar ' + (a && a.ticker)}><Edit3 className="w-3.5 h-3.5" /></button>
                    {confirmId === a.id ? (
                      <span className="flex gap-1">
                        <button onClick={() => { if (onDeleteAsset) onDeleteAsset(a.id); setConfirmId(null); }} className="p-1.5 rounded-lg bg-red-600 text-white font-bold" style={{ fontSize: 9 }}>Sim</button>
                        <button onClick={() => setConfirmId(null)} className="p-1.5 rounded-lg bg-zinc-800 text-zinc-300 font-bold" style={{ fontSize: 9 }}>Não</button>
                      </span>
                    ) : (
                      <button onClick={() => setConfirmId(a.id)} className="p-1.5 rounded-lg bg-white/5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-all active:scale-90" title="Excluir" aria-label={'Excluir ' + (a && a.ticker)}><Trash2 className="w-3.5 h-3.5" /></button>
                    )}
                  </span></td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-orange-500/30 bg-black/30 font-extrabold">
              <td colSpan={6} className="p-2.5 text-right uppercase text-zinc-400" style={{ fontSize: 9 }}>Totais</td>
              <td className="p-2.5 text-right text-zinc-200">R$ {fmt2(totalCusto)}</td>
              <td className="p-2.5 text-right text-zinc-100">R$ {fmt2(totalPatrimonio)}</td>
              <td className={'p-2.5 text-right ' + (totalRetorno >= 0 ? 'text-emerald-400' : 'text-red-400')}>{totalRetorno >= 0 ? '+' : ''}{returnPct}%</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="px-3 py-2 bg-black/20 text-zinc-500 font-semibold" style={{ fontSize: 9 }}>Deslize p/ o lado p/ ver a tabela completa • ☐ seleciona tudo</p>
    </div>
  </div>
)}
          {/* MODO 2: BLOCO COMPACTADO (Mini-Cards densos) */}
          {viewMode === 'compact' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {safeAssets.map((asset, gridIdx) => {
                const aqty = Number(asset && asset.qty) || 0;
                const aavg = Number(asset && asset.avgPrice) || 0;
                const acur = Number(asset && asset.currentPrice) || 0;
                const valTotal = (aqty * acur).toFixed(2);
                const pct = (
                  (aavg > 0 ? ((acur - aavg) / aavg) * 100 : 0)
                ).toFixed(2);
                const isPositive = (aqty * acur - aqty * aavg) >= 0;

                return (
                  <div
                    key={asset?.id ?? `compact-${gridIdx}`}
                    onClick={() => onOpenEditAssetModal(asset.id)}
                    className="bg-jaspe-card border border-jaspe-border p-2.5 rounded-xl flex flex-col justify-between hover:border-orange-500/40 transition-all cursor-pointer text-left shadow-sm active:scale-98 group"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-black text-xs text-zinc-100 group-hover:text-orange-400 transition-colors truncate">
                        {(asset && asset.ticker) || '—'}
                      </span>
                      <span
                        className={`text-[8px] font-extrabold px-1.5 py-0.2 rounded ${
                          isPositive
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-red-500/10 text-red-400'
                        }`}
                      >
                        {isPositive ? '+' : ''}{pct}%
                      </span>
                    </div>

                    <div className="mt-2 pt-1 border-t border-white/5 flex items-center justify-between text-[9px]">
                      <span className="text-zinc-400">{aqty.toLocaleString('pt-BR', { maximumFractionDigits: 4 })} un</span>
                      <strong className="text-zinc-100 text-[10px]">
                        R$ {parseFloat(valTotal).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                      </strong>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* MODO 3: GRADE TRADICIONAL (2 Colunas) */}
          {viewMode === 'grid' && (
            <div className="grid grid-cols-2 gap-2.5">
              {safeAssets.map((asset, gridIdx) => {
                const aqty = Number(asset && asset.qty) || 0;
                const aavg = Number(asset && asset.avgPrice) || 0;
                const acur = Number(asset && asset.currentPrice) || 0;
                const valTotal = (aqty * acur).toFixed(2);
                const pct = (
                  (aavg > 0 ? ((acur - aavg) / aavg) * 100 : 0)
                ).toFixed(2);
                const isPositive = (aqty * acur - aqty * aavg) >= 0;

                return (
                  <div
                    key={asset?.id ?? `grid-${gridIdx}`}
                    onClick={() => onOpenEditAssetModal(asset.id)}
                    className="bg-jaspe-card border border-jaspe-border p-3.5 rounded-2xl space-y-2.5 cursor-pointer hover:border-orange-500/40 transition-all text-left shadow-sm flex flex-col justify-between active:scale-98"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1">
                        <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center font-extrabold text-orange-500 text-xs shrink-0">
                          {(asset?.ticker || "?").slice(0, 4)}
                        </div>
                        <span className="text-[8px] bg-orange-500/10 text-orange-400 px-1.5 py-0.5 rounded font-bold uppercase truncate">
                          {(asset && asset.category) || '—'}
                        </span>
                      </div>
                      <div className="mt-1.5">
                        <h4 className="font-extrabold text-xs text-zinc-100 truncate">
                          {(asset && asset.ticker) || '—'}
                        </h4>
                        <span className="text-[9px] text-zinc-400 truncate block">
                          {(asset && asset.name) || ''}
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-white/5 pt-2 space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-[8px] text-zinc-400">Total</span>
                        <strong className="text-zinc-100 text-[11px]">
                          R$ {parseFloat(valTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-[8px] text-zinc-400">{aqty.toLocaleString('pt-BR', { maximumFractionDigits: 4 })} un.</span>
                        <span
                          className={`text-[9px] font-bold ${
                            isPositive ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {isPositive ? '+' : ''}
                          {pct}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* MODO 4: LISTA COMPACTA */}
          {viewMode === 'list' && (
            <div className="space-y-2 flex flex-col">
              {safeAssets.map((asset, listIdx) => {
                const aqty = Number(asset && asset.qty) || 0;
                const aavg = Number(asset && asset.avgPrice) || 0;
                const acur = Number(asset && asset.currentPrice) || 0;
                const valTotal = (aqty * acur).toFixed(2);
                const pct = (
                  (aavg > 0 ? ((acur - aavg) / aavg) * 100 : 0)
                ).toFixed(2);
                const isPositive = (aqty * acur - aqty * aavg) >= 0;

                return (
                  <div
                    key={asset.id}
                    onClick={() => onOpenEditAssetModal(asset.id)}
                    className="bg-jaspe-card border border-jaspe-border p-3 rounded-xl flex items-center justify-between hover:border-orange-500/40 transition-all cursor-pointer text-left shadow-sm active:scale-98"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center font-bold text-orange-500 text-xs shrink-0">
                        {(asset?.ticker || "?").slice(0, 4)}
                      </div>
                      <div className="truncate">
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-extrabold text-xs text-zinc-100 truncate">
                            {(asset && asset.ticker) || '—'}
                          </h4>
                          <span className="text-[8px] bg-orange-500/10 text-orange-400 px-1.5 py-0.2 rounded font-bold uppercase">
                            {(asset && asset.category) || '—'}
                          </span>
                        </div>
                        <span className="text-[9px] text-zinc-400 truncate block">
                          {(asset && asset.name) || ''}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <strong className="text-xs text-zinc-100 block">
                        R$ {parseFloat(valTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </strong>
                      <span
                        className={`text-[9px] font-bold ${
                          isPositive ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {isPositive ? '+' : ''}
                        {pct}% • {aqty.toLocaleString('pt-BR', { maximumFractionDigits: 4 })} un.
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {showSnow && (
        <div ref={snowRef} className="bg-jaspe-card border border-amber-500/30 p-4 rounded-3xl space-y-3 text-left shadow-sm scroll-mt-2">
          {/* Toque ou empurre p/ cima para fechar */}
          <button
            onClick={toggleSnow}
            onTouchStart={(e) => {
              snowTouchY.current = e.touches[0].clientY;
            }}
            onTouchEnd={(e) => {
              if (snowTouchY.current == null) return;
              const dy = e.changedTouches[0].clientY - snowTouchY.current;
              snowTouchY.current = null;
              if (dy < -50) {
                snowSuppressTap.current = true;
                setShowSnow(false);
                setTimeout(() => {
                  snowSuppressTap.current = false;
                }, 350);
              }
            }}
            className="w-full flex flex-col items-center gap-1.5 pt-0.5 active:opacity-70"
            aria-label="Fechar simulador Bola de Neve"
          >
            <span className="w-10 h-1.5 rounded-full bg-white/20" />
            <span className="w-full text-xs font-bold text-amber-300 text-left">⛄ Bola de Neve — juros sobre juros</span>
          </button>
          <p className="text-[10px] text-zinc-400 leading-relaxed">
            Começa do seu patrimônio atual de <strong className="text-zinc-200">R$ {totalPatrimonio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>,
            soma o aporte todo mês e reinveste os rendimentos a <strong className="text-zinc-200">{snowYield}% ao ano</strong>.
            O resultado é a projeção abaixo.
          </p>
          <div className="grid grid-cols-3 gap-2 text-[10px]">
            <label className="space-y-1 text-zinc-400">Aporte/mês (R$)
              <input type="number" value={snowMonthly} onChange={(e) => setSnowMonthly(Number(e.target.value))} className="w-full bg-black/30 border border-white/10 rounded-lg p-2 text-zinc-100" />
            </label>
            <label className="space-y-1 text-zinc-400">Yield % a.a.
              <input type="number" step="0.1" value={snowYield} onChange={(e) => setSnowYield(Number(e.target.value))} className="w-full bg-black/30 border border-white/10 rounded-lg p-2 text-zinc-100" />
            </label>
            <label className="space-y-1 text-zinc-400">Anos
              <input type="number" value={snowYears} min={1} max={40} onChange={(e) => setSnowYears(Number(e.target.value))} className="w-full bg-black/30 border border-white/10 rounded-lg p-2 text-zinc-100" />
            </label>
          </div>
          {snowFinal && (
            <div className="text-[11px] text-zinc-200 bg-black/30 rounded-xl p-3 border border-white/5 space-y-1">
              <div className="flex justify-between"><span>Aportado (total):</span><strong>R$ {snowFinal.invested.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></div>
              <div className="flex justify-between"><span>Patrimônio final:</span><strong className="text-emerald-400">R$ {snowFinal.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></div>
              <div className="flex justify-between"><span>Ganhos reinvestidos:</span><strong className="text-amber-300">R$ {snowFinal.dividends.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></div>
              <div className="flex justify-between"><span>Renda/mês estimada:</span><strong className="text-sky-300">R$ {(snowFinal.balance * (Math.pow(1 + (Number(snowYield) || 0) / 100, 1 / 12) - 1)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></div>
              <div className="pt-2 space-y-1.5">
                {snowData.slice(1).map((p) => (
                  <div key={p.year} className="flex items-center gap-2">
                    <span className="text-[9px] text-zinc-500 w-8 shrink-0 font-bold">Ano {p.year}</span>
                    <div className="flex-1 h-2.5 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-400"
                        style={{ width: `${snowFinal.balance > 0 ? Math.max(2, (p.balance / snowFinal.balance) * 100) : 0}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-zinc-300 w-16 text-right font-semibold shrink-0">
                      {(p.balance / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}k
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[9px] text-zinc-500 pt-1">Projeção educacional com taxa fixa. Não é recomendação de investimento.</p>
            </div>
          )}
        </div>
      )}

      {/* Histórico de Proventos Recebidos */}
      <div className="bg-jaspe-card border border-jaspe-border p-4 rounded-3xl space-y-4 text-left shadow-sm">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-zinc-200">
            Histórico de Proventos
          </h4>
          <span className="text-xs text-emerald-400 font-bold">
            R$ {totalProventos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
        </div>

        {safeProventos.length === 0 ? (
          <p className="text-[10px] text-zinc-500 text-center py-4">Nenhum provento lançado ainda.</p>
        ) : (
        <div className="space-y-2">
          {safeProventos.map((p, idx) => (
            <div
              key={p?.id ?? `prov-${idx}`}
              className="flex justify-between items-center p-3 bg-black/20 rounded-2xl border border-white/5 text-left"
            >
              <div>
                <strong className="text-xs text-zinc-200 block">
                  {(p?.ticker || '—')} ({(p?.company || '—')})
                </strong>
                <span className="block text-[9px] text-zinc-400 mt-0.5">
                  {(p?.type || '—')} • {(p?.date || '—')}
                </span>
              </div>
              <span className="text-xs font-bold text-emerald-400">
                +R$ {Number(p?.amount || 0).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
        )}
      </div>
    </section>
  );
}
