import { X, Heart, CheckCircle2, Circle, AlertTriangle } from 'lucide-react';
import { Task, TabType } from '../types';
import { playSynthSound } from '../utils/audio';

interface HealthModalProps {
  tasks: Task[];
  onClose: () => void;
  onToggleTask: (id: number) => void;
  onNavigate: (tab: TabType) => void;
}

export interface HealthScore {
  score: number;
  status: 'Saudável' | 'Atenção' | 'Crítica';
  done: number;
  pending: number;
  overdue: number;
  overdueList: Task[];
}

export function calcHealth(tasks: Task[]): HealthScore {
  const list = Array.isArray(tasks) ? tasks.filter((t) => t && typeof t === 'object') : [];
  const now = Date.now();
  let done = 0;
  let pending = 0;
  const overdueList: Task[] = [];
  for (const t of list) {
    if (t.done || t.status === 'Concluída') { done++; continue; }
    pending++;
    const ts = t.dateISO ? new Date(t.dateISO).getTime() : NaN;
    if (Number.isFinite(ts) && ts < now) overdueList.push(t);
  }
  const score = Math.max(0, Math.min(100, 100 - Math.min(60, overdueList.length * 10) - Math.min(20, Math.max(0, pending - overdueList.length) * 2)));
  const status = score >= 80 ? 'Saudável' : score >= 50 ? 'Atenção' : 'Crítica';
  overdueList.sort((a, b) => {
    const ta = new Date(a.dateISO || 0).getTime();
    const tb = new Date(b.dateISO || 0).getTime();
    return ta - tb;
  });
  return { score, status, done, pending, overdue: overdueList.length, overdueList: overdueList.slice(0, 8) };
}

const STATUS_STYLE: Record<HealthScore['status'], { ring: string; text: string; bg: string; tip: string }> = {
  'Saudável': { ring: '#10B981', text: 'text-emerald-400', bg: 'bg-emerald-500/10', tip: 'Tudo em dia. Continue dando ok nas tarefas.' },
  'Atenção': { ring: '#F59E0B', text: 'text-amber-400', bg: 'bg-amber-500/10', tip: 'Há pendências acumulando. Conclua as vencidas.' },
  'Crítica': { ring: '#EF4444', text: 'text-red-400', bg: 'bg-red-500/10', tip: 'Muitas tarefas vencidas. Dê ok para recuperar a saúde.' }
};

export default function HealthModal({ tasks, onClose, onToggleTask, onNavigate }: HealthModalProps) {
  const h = calcHealth(tasks);
  const st = STATUS_STYLE[h.status];
  const R = 44;
  const CIRC = 2 * Math.PI * R;

  return (
    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-3">
      <div className="w-full bg-[#1A1311] border border-jaspe-border rounded-[28px] p-6 max-h-[90%] overflow-y-auto space-y-5 text-left">
        <div className="flex items-center justify-between border-b border-jaspe-border pb-3">
          <h3 className="font-extrabold text-sm text-zinc-100 flex items-center gap-2">
            <Heart className="w-4 h-4 text-pink-500 fill-pink-500" /> Saúde do Sistema
          </h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-4">
          <svg className="w-28 h-28 shrink-0" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r={R} fill="transparent" stroke="#2B221F" strokeWidth="12" />
            <circle
              cx="60" cy="60" r={R} fill="transparent"
              stroke={st.ring} strokeWidth="12" strokeLinecap="round"
              pathLength={100} strokeDasharray={`${h.score} 100`}
              strokeDashoffset={25} transform="rotate(0 60 60)"
            />
            <text x="60" y="58" textAnchor="middle" fill="#F4F4F5" fontSize="22" fontWeight="800">{h.score}%</text>
            <text x="60" y="76" textAnchor="middle" fill="#A1A1AA" fontSize="10" fontWeight="700">{h.status}</text>
          </svg>
          <div className="space-y-2 text-[11px] flex-1">
            <div className={`px-3 py-2 rounded-xl ${st.bg} ${st.text} font-bold`}>{st.tip}</div>
            <div className="grid grid-cols-3 gap-1.5 text-center">
              <div className="bg-white/5 rounded-xl py-2">
                <div className="text-emerald-400 font-extrabold text-sm">{h.done}</div>
                <div className="text-zinc-500 text-[9px] font-bold uppercase">OK</div>
              </div>
              <div className="bg-white/5 rounded-xl py-2">
                <div className="text-amber-400 font-extrabold text-sm">{h.pending}</div>
                <div className="text-zinc-500 text-[9px] font-bold uppercase">Pend.</div>
              </div>
              <div className="bg-white/5 rounded-xl py-2">
                <div className="text-red-400 font-extrabold text-sm">{h.overdue}</div>
                <div className="text-zinc-500 text-[9px] font-bold uppercase">Venc.</div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Vencidas e não concluídas ({h.overdue})
          </h4>
          {h.overdueList.length === 0 ? (
            <p className="text-[11px] text-zinc-500 bg-white/5 rounded-xl px-3 py-3 text-center">
              Nenhuma tarefa vencida. Cada "ok" mantém a saúde em alta.
            </p>
          ) : (
            h.overdueList.map((t) => (
              <div key={t.id} className="flex items-center gap-2.5 p-3 bg-white/5 border border-white/5 rounded-xl">
                <button
                  onClick={() => { playSynthSound('success'); onToggleTask(t.id); }}
                  className="p-1 hover:bg-white/10 rounded shrink-0"
                  aria-label="Dar ok"
                  title="Dar ok e recuperar a saúde"
                >
                  <Circle className="w-5 h-5 text-zinc-500" />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-zinc-200 truncate">{t.text || '(sem título)'}</p>
                  <span className="text-[9px] text-red-400 font-semibold">{t.date || 'Sem data'}</span>
                </div>
                <CheckCircle2 className="w-4 h-4 text-zinc-600 shrink-0" />
              </div>
            ))
          )}
        </div>

        <button
          onClick={() => { playSynthSound('click'); onClose(); onNavigate('tarefas'); }}
          className="w-full py-3 bg-pink-600 hover:bg-pink-700 text-white font-bold text-xs rounded-xl shadow-lg active:scale-95 transition-all"
        >
          Abrir Tarefas
        </button>
      </div>
    </div>
  );
}
