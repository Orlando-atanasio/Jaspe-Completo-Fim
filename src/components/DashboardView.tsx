import { useState, useEffect } from 'react';
import {
  TrendingUp,
  DollarSign,
  CheckSquare,
  FileText,
  Heart,
  Sparkles,
  ArrowUpRight,
  Edit3,
  Calendar,
  FilePlus,
  Circle,
  CheckCircle2
} from 'lucide-react';
import { Task, TabType, Asset, Provento, Contact } from '../types';
import { playSynthSound } from '../utils/audio';
import HealthModal from './HealthModal';
import CaptureModal from './CaptureModal';

interface DashboardViewProps {
  onNavigate: (tab: TabType) => void;
  tasks: Task[];
  notesCount: number;
  contactsCount?: number;
  userName?: string;
  assets: Asset[];
  proventos: Provento[];
  onToggleTask: (id: number) => void;
  onOpenTaskModal: (id: number | null) => void;
  onSaveScratchpadAsNote: (text: string) => void;
  onShowToast: (msg: string) => void;
  onTriggerConfetti: () => void;
  onSaveTask: (t: Partial<Task>) => void;
  onSaveContact: (c: Partial<Contact>) => void;
}

export default function DashboardView({
  onNavigate,
  tasks,
  notesCount,
  contactsCount = 0,
  userName = 'Orlando',
  assets,
  proventos,
  onToggleTask,
  onOpenTaskModal,
  onSaveScratchpadAsNote,
  onShowToast,
  onTriggerConfetti,
  onSaveTask,
  onSaveContact
}: DashboardViewProps) {
  const [scratchpadText, setScratchpadText] = useState('');
  const [showHealth, setShowHealth] = useState(false);
  const [showCapture, setShowCapture] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('jaspe_scratchpad') || '';
      setScratchpadText(saved);
    } catch {}
  }, []);

  const handleScratchpadChange = (text: string) => {
    setScratchpadText(text);
    try { localStorage.setItem('jaspe_scratchpad', text); } catch {}
  };

  const handleSaveScratchpad = () => {
    if (!scratchpadText.trim()) { onShowToast('Escreva algo no rascunho primeiro.'); return; }
    onSaveScratchpadAsNote(scratchpadText);
    setScratchpadText('');
    try { localStorage.setItem('jaspe_scratchpad', ''); } catch {}
  };

  // Cálculos dinâmicos (blindados p/ backup corrompido)
  const safeAssets = Array.isArray(assets) ? assets : [];
  const safeProventos = Array.isArray(proventos) ? proventos : [];
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const hourNow = new Date().getHours();
  const getGreeting = () => (hourNow >= 5 && hourNow < 12 ? 'Bom dia' : hourNow >= 12 && hourNow < 18 ? 'Boa tarde' : hourNow >= 18 && hourNow < 24 ? 'Boa noite' : 'Boa madrugada');
  const totalPatrimonio = safeAssets.reduce((acc, a) => acc + (Number(a?.qty) || 0) * (Number(a?.currentPrice) || 0), 0);
  const totalProventos = safeProventos.reduce((acc, p) => acc + (Number(p?.amount) || 0), 0);
  const totalCusto = safeAssets.reduce((acc, a) => acc + (Number(a?.qty) || 0) * (Number(a?.avgPrice) || 0), 0);
  const totalRetorno = totalPatrimonio - totalCusto;
  const returnPct = totalCusto > 0 ? ((totalRetorno / totalCusto) * 100).toFixed(1) : '0.0';
  const retPos = totalRetorno >= 0;
  const todayISO = new Date().toISOString().slice(0, 10);
  const todayBR = new Date().toLocaleDateString('pt-BR');
  const pendingTasks = safeTasks.filter((t) => {
    if (!t || t.done || t.status === 'Concluída') return false;
    if (!t.date || t.date === 'Sem prazo') return true;
    if (t.dateISO) {
      return t.dateISO.slice(0, 10) <= todayISO;
    }
    const part = t.date.split(' ')[0];
    return part <= todayBR;
  });
  const CAT_COLORS_D: Record<string, string> = { 'Ações': '#3B82F6', 'FIIs': '#10B981', 'Renda Fixa': '#8B5CF6', 'Cripto': '#F59E0B' };
  const EXTRA_D = ['#EC4899', '#14B8A6', '#F59E0B', '#6366F1'];
  const allocationD = (() => {
    const totals = new Map<string, number>();
    safeAssets.forEach((a) => {
      const cat = ((a && a.category) || 'Outros').trim() || 'Outros';
      totals.set(cat, (totals.get(cat) || 0) + (Number(a && a.qty) || 0) * (Number(a && a.currentPrice) || 0));
    });
    let ex = 0;
    return Array.from(totals.entries()).map(([cat, value]) => ({ cat, value, pct: totalPatrimonio > 0 ? (value / totalPatrimonio) * 100 : 0, color: CAT_COLORS_D[cat] || EXTRA_D[ex++ % EXTRA_D.length] })).sort((a, b) => b.value - a.value);
  })();
  let allocAccD = 0;
  const allocSegsD = allocationD.map((s) => { const start = allocAccD; allocAccD += s.pct; return { cat: s.cat, pct: s.pct, color: s.color, start }; });

  return (
    <section className="p-4 space-y-6">
      {/* Banner Executivo Laranja/Cacau */}
      <div className="banner-executivo rounded-3xl bg-gradient-to-r from-[#4A1E12] to-[#251C1A] p-5 relative overflow-hidden border border-orange-900/50 shadow-lg">
        <div className="banner-glow absolute right-[-20%] top-[-30%] w-44 h-44 bg-orange-600/20 rounded-full blur-2xl pointer-events-none"></div>
        <div className="relative z-10 space-y-4 text-left">
          <span className="banner-badge inline-flex items-center gap-1.5 bg-orange-500/10 text-orange-400 text-[9px] uppercase font-bold tracking-widest px-2.5 py-1 rounded-full border border-orange-500/20">
            <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse"></span>{' '}
            Painel Executivo Jaspe
          </span>
          <div>
            <h1 className="banner-title text-2xl font-extrabold text-zinc-100 tracking-tight">
              {getGreeting()}, {(userName || 'Orlando').split(' ')[0]}!
            </h1>
            <p className="banner-subtitle text-zinc-400 mt-1 text-xs">
              Você possui{' '}
              <span className="banner-highlight-tasks text-orange-400 font-bold">
                {pendingTasks.length}
              </span>{' '}
              {pendingTasks.length === 1 ? 'tarefa pendente' : 'tarefas pendentes'} e{' '}
              <span className="banner-highlight-assets text-emerald-400 font-bold">
                R$ {Math.round(totalPatrimonio).toLocaleString('pt-BR')}
              </span>{' '}
              sob gestão.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { playSynthSound('click'); setShowHealth(true); }}
              className="btn-saude px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white font-bold text-[10px] rounded-xl transition-all shadow-md flex items-center gap-1.5 active:scale-95"
            >
              <Heart className="w-3.5 h-3.5 fill-white text-white" /> Saúde
            </button>
            <button
              onClick={() => { playSynthSound('click'); setShowCapture(true); }}
              className="btn-captura px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold text-[10px] rounded-xl transition-all shadow-md flex items-center gap-1.5 active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5 text-white" /> Captura IA
            </button>
          </div>
        </div>
      </div>

      {/* KPI Grid (Métricas Compactas e Harmônicas) */}
      <div className="grid grid-cols-2 gap-4">
        {/* Card Patrimônio */}
        <div
          onClick={() => onNavigate('carteira')}
          className="bg-jaspe-card border border-jaspe-border p-4 rounded-2xl flex flex-col justify-between h-28 shadow-md active:scale-98 transition-all cursor-pointer text-left hover:border-orange-500/30"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
              Patrimônio
            </span>
            <div className="p-1 rounded bg-orange-500/10 text-orange-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-base font-extrabold text-zinc-100">
              R$ {totalPatrimonio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </h3>
            <span className={
              retPos ? 'text-[10px] text-emerald-400 font-semibold mt-1 block' : 'text-[10px] text-red-400 font-semibold mt-1 block'
            }>
              {retPos ? '+' : ''}{returnPct}% retorno
            </span>
          </div>
        </div>

        {/* Card Dividendos */}
        <div
          onClick={() => onNavigate('carteira')}
          className="bg-jaspe-card border border-jaspe-border p-4 rounded-2xl flex flex-col justify-between h-28 shadow-md active:scale-98 transition-all cursor-pointer text-left hover:border-orange-500/30"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
              Dividendos
            </span>
            <div className="p-1 rounded bg-emerald-500/10 text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-base font-extrabold text-emerald-400">
              R$ {totalProventos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </h3>
            <span className="text-[10px] text-zinc-400 block mt-1">
              {safeProventos.length} recebimentos
            </span>
          </div>
        </div>

        {/* Card Tarefas */}
        <div
          onClick={() => onNavigate('tarefas')}
          className="bg-jaspe-card border border-jaspe-border p-4 rounded-2xl flex flex-col justify-between h-28 shadow-md active:scale-98 transition-all cursor-pointer text-left hover:border-orange-500/30"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
              Tarefas
            </span>
            <div className="p-1 rounded bg-red-500/10 text-red-400">
              <CheckSquare className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-base font-extrabold text-zinc-100">
              {pendingTasks.length}
            </h3>
            <span className="text-[10px] text-emerald-400 font-semibold block mt-1">
              {pendingTasks.length === 0 ? 'Todas concluídas' : 'Todas em dia'}
            </span>
          </div>
        </div>

        {/* Card Notas & Agenda */}
        <div
          onClick={() => onNavigate('anotacoes')}
          className="bg-jaspe-card border border-jaspe-border p-4 rounded-2xl flex flex-col justify-between h-28 shadow-md active:scale-98 transition-all cursor-pointer text-left hover:border-orange-500/30"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
              Notas & Agenda
            </span>
            <div className="p-1 rounded bg-amber-500/10 text-amber-400">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-base font-extrabold text-zinc-100">
              {notesCount}
            </h3>
            <span className="text-[10px] text-zinc-400 block mt-1">
              {contactsCount} contatos salvos
            </span>
          </div>
        </div>
      </div>

      {/* Gráfico de Alocação */}
      <div className="bg-jaspe-card border border-jaspe-border p-4 rounded-3xl space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-zinc-200">
            Alocação de Investimentos
          </h4>
          <button
            onClick={() => onNavigate('carteira')}
            className="text-[10px] text-orange-400 hover:text-orange-300 font-bold flex items-center gap-1 hover:underline transition-all"
          >
            Ver Carteira <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex items-center justify-around">
          {allocationD.length === 0 ? (
            <p className="text-[10px] text-zinc-500 py-6">Sem ativos — adicione para ver a distribuição real.</p>
          ) : (
          <>
          <svg className="w-24 h-24" viewBox="0 0 96 96">
            <circle
              cx="48"
              cy="48"
              r="36"
              fill="transparent"
              className="donut-track"
              stroke="#2B221F"
              strokeWidth="12"
            />
            {allocSegsD.map((s) => (
              <circle
                key={s.cat}
                cx="48"
                cy="48"
                r="36"
                fill="transparent"
                stroke={s.color}
                strokeWidth="12"
                pathLength={100}
                strokeDasharray={Math.max(0, s.pct - 0.8) + ' 100'}
                strokeDashoffset={25 - s.start}
              />
            ))}
          </svg>
          <div className="space-y-1 text-[10px] text-zinc-400 text-left">
            {allocationD.map((s) => (
              <div key={s.cat} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }}></div>{' '}
                <span className="chart-legend-text truncate">{s.cat}: {s.pct.toFixed(1)}%</span>
              </div>
            ))}
          </div>
          </>
          )}
        </div>
      </div>

      {/* Scratchpad (Rascunho Rápido) */}
      <div className="scratchpad-container bg-jaspe-card border border-jaspe-border p-4 rounded-3xl flex flex-col space-y-3 text-left">
        <h4 className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
          <Edit3 className="w-4 h-4 text-orange-400" /> Scratchpad (Rascunho Rápido)
        </h4>
        <textarea
          value={scratchpadText}
          onChange={(e) => handleScratchpadChange(e.target.value)}
          placeholder="Sua ideia rápida... Salva automaticamente."
          className="scratchpad-textarea w-full bg-[#1A1311] border border-jaspe-border p-3 rounded-xl text-xs focus:outline-none focus:border-orange-500/50 text-zinc-200 resize-none h-20 placeholder-zinc-500"
        ></textarea>
        <button
          onClick={handleSaveScratchpad}
          className="scratchpad-btn w-full py-2.5 bg-orange-600/10 text-orange-400 hover:bg-orange-600 hover:text-white border border-orange-500/25 rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1.5 active:scale-98"
        >
          <FilePlus className="w-3.5 h-3.5" /> Salvar como Nota Permanente
        </button>
      </div>

      {/* Compromissos de Hoje */}
      <div className="compromissos-container bg-jaspe-card border border-jaspe-border p-4 rounded-3xl space-y-4 text-left">
        <h4 className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
          <Calendar className="w-4 h-4 text-orange-400" /> Compromissos de Hoje
        </h4>
        <div className="space-y-2">
          {pendingTasks.length === 0 ? (
            <p className="text-[10px] text-zinc-500 py-3 text-center">
              Nenhum compromisso pendente para hoje.
            </p>
          ) : (
            pendingTasks.map((task) => (
              <div
                key={task.id}
                className="compromisso-item flex items-center justify-between p-3.5 bg-[#1A1311] border border-jaspe-border rounded-2xl active:scale-98 transition-all"
              >
                <div
                  className="flex items-center gap-3 text-left cursor-pointer flex-1"
                  onClick={() => onOpenTaskModal(task.id)}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      task.priority === 'Urgente'
                        ? 'bg-red-500'
                        : task.priority === 'Alta'
                        ? 'bg-orange-400'
                        : 'bg-emerald-400'
                    }`}
                  ></span>
                  <div>
                    <p className="compromisso-title text-xs font-bold text-zinc-200 leading-snug">
                      {task.text || '(sem título)'}
                    </p>
                    <span className="compromisso-sub text-[8px] text-zinc-500 uppercase font-semibold mt-0.5 block">
                      {task.type || 'Tarefa'} • {task.date || 'Sem data'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => onToggleTask(task.id)}
                  className="compromisso-check p-1 text-zinc-500 hover:text-emerald-400 active:scale-90 transition-all"
                  aria-label="Concluir tarefa"
                >
                  {task.done ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <Circle className="w-5 h-5" />
                  )}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
      {showHealth && (
        <HealthModal
          tasks={tasks}
          onClose={() => setShowHealth(false)}
          onToggleTask={onToggleTask}
          onNavigate={onNavigate}
        />
      )}
      {showCapture && (
        <CaptureModal
          onClose={() => setShowCapture(false)}
          onToast={onShowToast}
          onCreateNote={(t) => { onSaveScratchpadAsNote(t); onTriggerConfetti(); }}
          onCreateTask={(t) => { onSaveTask(t); onTriggerConfetti(); }}
          onCreateContact={(c) => { onSaveContact(c); onTriggerConfetti(); }}
        />
      )}
    </section>
  );
}
