import { useMemo, useState } from 'react';
import { X, Sparkles, StickyNote, ListChecks, UserPlus, Check } from 'lucide-react';
import { Task, Contact } from '../types';
import { playSynthSound } from '../utils/audio';
import { interpretCapture, CaptureMode, CaptureKind } from '../utils/capture';

interface CaptureModalProps {
  onClose: () => void;
  onToast: (msg: string) => void;
  onCreateNote: (text: string) => void;
  onCreateTask: (t: Partial<Task>) => void;
  onCreateContact: (c: Partial<Contact>) => void;
}

const MODES: { id: CaptureMode; label: string; icon: typeof Sparkles }[] = [
  { id: 'auto', label: 'Auto IA local', icon: Sparkles },
  { id: 'nota', label: 'Nota', icon: StickyNote },
  { id: 'tarefa', label: 'Tarefa', icon: ListChecks },
  { id: 'contato', label: 'Contato', icon: UserPlus }
];

const KIND_LABEL: Record<CaptureKind, string> = { nota: 'Nota', tarefa: 'Tarefa', contato: 'Contato' };

export default function CaptureModal({ onClose, onToast, onCreateNote, onCreateTask, onCreateContact }: CaptureModalProps) {
  const [text, setText] = useState('');
  const [mode, setMode] = useState<CaptureMode>('auto');
  const interp = useMemo(() => interpretCapture(text, mode), [text, mode]);

  const preview = !text.trim()
    ? 'Digite livremente acima...'
    : interp.kind === 'tarefa'
      ? `Será criado: Tarefa • ${interp.dateLabel || 'sem data'}`
      : interp.kind === 'contato'
        ? `Será criado: Contato • ${interp.contactName || '(sem nome)'}${interp.contactPhone ? ' • ' + interp.contactPhone : ''}${interp.contactEmail ? ' • ' + interp.contactEmail : ''}`
        : `Será criado: Nota • ${interp.noteTitle}`;

  const handleCreate = () => {
    if (!text.trim()) { onToast('Escreva algo primeiro.'); return; }
    playSynthSound('success');
    if (interp.kind === 'tarefa') {
      onCreateTask({
        text: interp.taskText,
        date: interp.dateDisplay || new Date().toLocaleDateString('pt-BR'),
        dateISO: interp.dateISO,
        category: 'Trabalho',
        status: 'Pendente',
        type: 'Tarefa',
        priority: 'Média',
        done: false
      });
      onToast('Tarefa criada pela captura!');
    } else if (interp.kind === 'contato') {
      if (!interp.contactName) { onToast('Não identifiquei o nome do contato.'); return; }
      onCreateContact({
        name: interp.contactName,
        phone: interp.contactPhone,
        email: interp.contactEmail,
        telegram: interp.contactTelegram,
        company: 'Geral',
        category: 'Trabalho',
        isFavorite: false
      });
      onToast('Contato criado pela captura!');
    } else {
      onCreateNote(text.trim());
      onToast('Nota criada pela captura!');
    }
    onClose();
  };

  return (
    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-3">
      <div className="w-full bg-[#1A1311] border border-jaspe-border rounded-[28px] p-6 max-h-[90%] overflow-y-auto space-y-4 text-left">
        <div className="flex items-center justify-between border-b border-jaspe-border pb-3">
          <h3 className="font-extrabold text-sm text-zinc-100 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-orange-400" /> Captura rápida e inteligente
          </h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-[11px] text-zinc-400">
          Digite livremente indicando data, tarefa ou contato. Ex.: <em className="text-zinc-300">"Ligar para Maria amanhã às 14h"</em> ou <em className="text-zinc-300">"joao@empresa.com 11987654321"</em>
        </p>

        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Digite livremente..."
          className="w-full h-24 bg-[#251C1A] border border-jaspe-border p-3 rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-orange-500/50 resize-none"
        />

        <div>
          <label className="text-[10px] text-zinc-400 font-bold uppercase">Interpretar como</label>
          <div className="flex gap-1.5 mt-1.5 flex-wrap">
            {MODES.map((m) => {
              const Icon = m.icon;
              const active = mode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => { playSynthSound('click'); setMode(m.id); }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold transition-all active:scale-95 ${
                    active
                      ? 'bg-orange-600 text-white shadow-md'
                      : 'bg-white/5 text-zinc-400 hover:text-zinc-200 border border-white/10'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" /> {m.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-3 py-2.5 rounded-xl bg-orange-500/10 border border-orange-500/25 text-[11px] text-orange-300 font-semibold">
          {text.trim() ? `${interp.reason} → ` : ''}{preview}
          {interp.kind !== 'nota' && <span className="ml-1 text-[10px] text-zinc-400">({KIND_LABEL[interp.kind]})</span>}
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-zinc-800 text-zinc-400 hover:bg-zinc-700 text-xs font-bold transition-all active:scale-95"
          >
            Cancelar
          </button>
          <button
            onClick={handleCreate}
            className="flex-[2] py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg transition-all active:scale-95"
          >
            <Check className="w-4 h-4" /> Criar {text.trim() ? KIND_LABEL[interp.kind] : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
