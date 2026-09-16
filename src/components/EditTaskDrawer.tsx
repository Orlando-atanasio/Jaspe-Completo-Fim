import React, { useState, useEffect, useRef } from 'react';
import { CheckSquare, X, Trash, ChevronDown } from 'lucide-react';
import { Task } from '../types';
import { playSynthSound } from '../utils/audio';
import { newId } from '../utils/ids';
import { clampRemindBeforeMin, clampRepeatEveryMin } from '../utils/notify';

interface EditTaskDrawerProps {
  taskId: number | null;
  tasks: Task[];
  isOpen: boolean;
  isLightTheme: boolean;
  onClose: () => void;
  onSave: (task: Partial<Task> & { id?: number }) => void;
  onDelete: (id: number) => void;
  onShowToast: (msg: string) => void;
}

// Dropdown na cor da ficha (o popup nativo do select abre branco no Android e ignora CSS)
function SheetSelect({ value, options, onPick, isLightTheme }: {
  value: string;
  options: { value: string; label: string }[];
  onPick: (v: string) => void;
  isLightTheme: boolean;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => { playSynthSound('click'); setOpen((o) => !o); }}
        className="task-sheet-field w-full bg-transparent border border-jaspe-border py-1.5 px-2.5 rounded-lg text-[11px] text-zinc-100 font-bold focus:outline-none flex items-center justify-between gap-2 text-left"
      >
        <span className="truncate">{current?.label ?? value}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-orange-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} strokeWidth={2.5} />
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default bg-transparent"
          />
          <div
            className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl border border-jaspe-border shadow-2xl py-1 max-h-48 overflow-y-auto"
            style={{
              backgroundColor: isLightTheme ? 'rgba(250, 246, 240, 0.96)' : 'rgba(26, 19, 17, 0.96)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)'
            }}
          >
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => { playSynthSound('click'); onPick(o.value); setOpen(false); }}
                className={`w-full px-3 py-2 text-xs font-bold text-left transition-colors ${
                  o.value === value ? 'text-orange-400 bg-orange-500/10' : 'text-zinc-200 hover:bg-white/5'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function EditTaskDrawer({
  taskId,
  tasks,
  isOpen,
  isLightTheme,
  onClose,
  onSave,
  onDelete,
  onShowToast
}: EditTaskDrawerProps) {
  const [text, setText] = useState('');
  const [type, setType] = useState<string>('Tarefa');
  const [status, setStatus] = useState<'Pendente' | 'Em Andamento' | 'Concluída'>('Pendente');
  const [priority, setPriority] = useState<'Baixa' | 'Média' | 'Alta' | 'Urgente'>('Média');
  const [dateISO, setDateISO] = useState('');
  const [alarm, setAlarm] = useState(false);
  const [google, setGoogle] = useState(false);
  const [remindBeforeMin, setRemindBeforeMin] = useState(0);
  const [repeatEveryMin, setRepeatEveryMin] = useState(0);
  const [localId, setLocalId] = useState<number | null>(null);

  // Hidrata 1x por abertura/troca de tarefa — NUNCA por update da lista,
  // senão o autosave apagaria o que o usuário está digitando.
  useEffect(() => {
    if (!isOpen) return;
    setLocalId(taskId);
    if (taskId != null) {
      const list = Array.isArray(tasks) ? tasks : [];
      const t = list.find((item) => item && item.id === taskId);
      if (t) {
        setText(t.text || "");
        setType(t.type || 'Tarefa');
        setStatus(t.status || (t.done ? 'Concluída' : 'Pendente'));
        setPriority(t.priority || 'Média');
        setDateISO(t.dateISO || '');
        setAlarm(!!t.alarm);
        setGoogle(!!t.google);
        setRemindBeforeMin(t.remindBeforeMin ?? 0);
        setRepeatEveryMin(t.repeatEveryMin ?? 0);
      }
    } else {
      setLocalId(newId());
      setText('');
      setType('Tarefa');
      setStatus('Pendente');
      setPriority('Média');
      setDateISO('');
      setAlarm(false);
      setGoogle(false);
    }
  }, [taskId, isOpen]);

  // Gaveta animada: monta, desliza da direita; ao fechar, recolhe e desmonta
  const [render, setRender] = useState(isOpen);
  const [slide, setSlide] = useState(false);
  const touchX = useRef<number | null>(null);
  const touchY = useRef<number | null>(null);

  // Hooks precisam ficar ANTES do early return para respeitar as regras do React
  const [customRemindOpen, setCustomRemindOpen] = useState(false);
  const [customRemindDraft, setCustomRemindDraft] = useState('');

  useEffect(() => {
    if (isOpen) {
      setRender(true);
      const raf = requestAnimationFrame(() =>
        requestAnimationFrame(() => setSlide(true))
      );
      return () => cancelAnimationFrame(raf);
    } else {
      setSlide(false);
      const t = setTimeout(() => setRender(false), 300);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  if (!render) return null;

  const getFormattedDate = (iso: string) => {
    if (!iso) return 'Sem prazo';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return 'Sem prazo';
    return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    })}`;
  };

  // Rascunho sempre no MESMO id (localId): blur repetido atualiza, não duplica.
  const buildDraft = (over: Partial<Task> = {}): Partial<Task> & { id?: number } => {
    const st = ((over.status ?? status) as Task['status']);
    const iso = over.dateISO ?? dateISO;
    return {
      id: localId ?? taskId ?? undefined,
      text: text.trim(),
      type: over.type ?? type,
      status: st,
      priority: ((over.priority ?? priority) as Task['priority']),
      done: st === 'Concluída',
      dateISO: iso,
      date: getFormattedDate(iso),
      alarm: over.alarm ?? alarm,
      google: over.google ?? google,
      remindBeforeMin: over.remindBeforeMin ?? remindBeforeMin,
      repeatEveryMin: over.repeatEveryMin ?? repeatEveryMin
    };
  };

  const handleBlurAutoSave = () => {
    if (!text.trim()) return;
    onSave(buildDraft());
  };

  const handleSaveAndClose = () => {
    if (!text.trim()) {
      onShowToast('Por favor informe o título da tarefa.');
      return;
    }
    onSave(buildDraft());
    onClose();
  };

  const handleDelete = () => {
    if (taskId != null) {
      playSynthSound('click');
      onDelete(taskId);
      onShowToast('Tarefa excluída!');
      onClose();
    }
  };

  // Padrão ao ligar o alarme: repete a cada 10min até o usuário agir
  // (concluir/soneca/parar). Só aplica o default se o usuário ainda não
  // tiver escolhido uma repetição — nunca sobrescreve escolha existente.
  const handleToggleAlarm = (checked: boolean) => {
    setAlarm(checked);
    const nextRepeat = checked && repeatEveryMin <= 0 ? 10 : repeatEveryMin;
    if (checked && nextRepeat !== repeatEveryMin) setRepeatEveryMin(nextRepeat);
    if (checked) {
      playSynthSound('success');
      onShowToast('Alarme configurado — vai repetir até você concluir, adiar ou parar.');
    }
    if (text.trim()) onSave(buildDraft({ alarm: checked, repeatEveryMin: nextRepeat }));
  };

  const remindBeforeOptions = [
    { value: 0, label: 'Na hora' },
    { value: 15, label: '15 min antes' },
    { value: 30, label: '30 min antes' },
    { value: 60, label: '1h antes' },
    { value: 1440, label: '1 dia antes' },
    { value: 2880, label: '2 dias antes' },
  ];

  const isCustomRemindBefore = !remindBeforeOptions.some((o) => o.value === remindBeforeMin);

  const commitCustomRemind = () => {
    const n = clampRemindBeforeMin(customRemindDraft);
    setRemindBeforeMin(n);
    setCustomRemindOpen(false);
    if (text.trim()) onSave(buildDraft({ remindBeforeMin: n }));
  };

  // Repetição do alerta após disparar: continua tocando/renotificando neste
  // intervalo até o usuário concluir, adiar (soneca) ou parar.
  const repeatOptions = [
    { value: 0, label: 'Não repetir' },
    { value: 5, label: 'A cada 5 min' },
    { value: 10, label: 'A cada 10 min' },
    { value: 15, label: 'A cada 15 min' },
    { value: 30, label: 'A cada 30 min' },
    { value: 60, label: 'A cada 1h' },
  ];

  const handleToggleGoogle = (checked: boolean) => {
    setGoogle(checked);
    if (checked) {
      playSynthSound('success');
      onShowToast('Marcado como evento de agenda (apenas local).');
    }
    if (text.trim()) onSave(buildDraft({ google: checked }));
  };

  return (
    <div
      className={`absolute inset-0 bg-black/15 z-40 flex justify-end items-stretch py-6 px-4 transition-opacity duration-300 ${slide ? 'opacity-100' : 'opacity-0'}`}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => {
            touchX.current = e.touches[0].clientX;
            touchY.current = e.touches[0].clientY;
          }}
          onTouchEnd={(e) => {
            if (touchX.current == null || touchY.current == null) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            const dy = e.changedTouches[0].clientY - touchY.current;
            touchX.current = null;
            touchY.current = null;
            // Só fecha em gesto horizontal predominante (scroll vertical não fecha)
            if (dx > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) onClose();
          }}
        className={`w-80 max-w-[90%] h-auto max-h-[96vh] drawer-translucent task-sheet-transparent border border-white/10 rounded-2xl p-3.5 flex flex-col z-50 overflow-y-auto text-left shadow-lg transition-transform duration-300 ease-out ${slide ? 'translate-x-0' : 'translate-x-full'}`}
        style={{
          backgroundColor: isLightTheme
            ? 'rgba(250, 246, 240, 0.20)'
            : 'rgba(26, 19, 17, 0.12)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)'
        }}
      >
        <div>
          <div className="flex items-center justify-between border-b border-jaspe-border pb-2 mb-2.5">
            <h3 className="font-extrabold text-xs text-zinc-100 flex items-center gap-1.5">
              <CheckSquare className="w-3.5 h-3.5 text-orange-400" /> Ficha da Tarefa
            </h3>
            <button
              onClick={onClose}
              className="text-zinc-500 hover:text-zinc-300 p-0.5"
              aria-label="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2">
            <div className="space-y-0.5">
              <label className="text-[9px] text-zinc-300 font-extrabold uppercase">
                Título da Tarefa *
              </label>
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onBlur={handleBlurAutoSave}
                placeholder="ex: Reunião com Diretoria"
                className="task-sheet-field w-full bg-transparent border border-jaspe-border py-1.5 px-2.5 rounded-lg text-[11px] text-zinc-100 font-bold focus:outline-none focus:border-orange-500/50"
              />
            </div>

            <div className="space-y-0.5">
              <label className="text-[9px] text-zinc-300 font-extrabold uppercase">
                Tipo de Tarefa
              </label>
              <SheetSelect
                value={type}
                isLightTheme={isLightTheme}
                options={[
                  { value: 'Tarefa', label: 'Geral' },
                  { value: 'Reunião', label: 'Reunião' },
                  { value: 'Compra de Ativo', label: 'Compra de Ativo' },
                  { value: 'Provento', label: 'Provento' },
                ]}
                onPick={(v) => {
                  setType(v);
                  if (text.trim()) onSave(buildDraft({ type: v }));
                }}
              />
            </div>

            <div className="space-y-0.5">
              <label className="text-[9px] text-zinc-300 font-extrabold uppercase">
                Status de Execução
              </label>
              <SheetSelect
                value={status}
                isLightTheme={isLightTheme}
                options={[
                  { value: 'Pendente', label: 'Pendente' },
                  { value: 'Em Andamento', label: 'Em Andamento' },
                  { value: 'Concluída', label: 'Concluída' },
                ]}
                onPick={(v) => {
                  const vv = v as 'Pendente' | 'Em Andamento' | 'Concluída';
                  setStatus(vv);
                  if (text.trim()) onSave(buildDraft({ status: vv }));
                }}
              />
            </div>

            <div className="space-y-0.5">
              <label className="text-[9px] text-zinc-300 font-extrabold uppercase">
                Criticidade / Prioridade
              </label>
              <SheetSelect
                value={priority}
                isLightTheme={isLightTheme}
                options={[
                  { value: 'Baixa', label: 'Baixa (Verde)' },
                  { value: 'Média', label: 'Média (Amarela)' },
                  { value: 'Alta', label: 'Alta (Laranja)' },
                  { value: 'Urgente', label: 'Urgente (Vermelho)' },
                ]}
                onPick={(v) => {
                  const vv = v as 'Baixa' | 'Média' | 'Alta' | 'Urgente';
                  setPriority(vv);
                  if (text.trim()) onSave(buildDraft({ priority: vv }));
                }}
              />
            </div>

            <div className="space-y-0.5">
              <label className="text-[9px] text-zinc-300 font-extrabold uppercase">
                Prazo (Data e Hora)
              </label>
              <input
                type="datetime-local"
                min={new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                value={dateISO}
                onChange={(e) => {
                  const v = e.target.value;
                  setDateISO(v);
                  if (text.trim()) onSave(buildDraft({ dateISO: v }));
                }}
                className="task-sheet-field w-full bg-transparent border border-jaspe-border py-1.5 px-2.5 rounded-lg text-[11px] text-zinc-100 font-bold focus:outline-none"
              />
            </div>

            <div className="space-y-1.5 pt-1.5 border-t border-jaspe-border/30">
              <label className="text-[9px] text-zinc-300 font-extrabold uppercase block">
                Configurações de Alerta
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-[11px] text-zinc-200 font-semibold select-none">
                <input
                  type="checkbox"
                  checked={alarm}
                  onChange={(e) => handleToggleAlarm(e.target.checked)}
                  className="rounded border-jaspe-border text-orange-600 bg-[#1A1311] focus:ring-orange-500/20 w-3.5 h-3.5"
                />
                <span>Agendar Alarme no Aparelho</span>
              </label>

              <div className="space-y-0.5">
                <label className="text-[8px] text-zinc-400 font-bold uppercase">Avisar antes</label>
                <div className="grid grid-cols-3 gap-1">
                  {remindBeforeOptions.map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex flex-col items-center py-1 px-1 rounded border cursor-pointer ${
                        !isCustomRemindBefore && remindBeforeMin === opt.value ? 'bg-orange-500/10 text-orange-400 border-orange-500/40' : 'border-white/5 text-zinc-200 hover:bg-white/5'
                      }`}
                      onClick={() => {
                        const newV = opt.value;
                        setCustomRemindOpen(false);
                        setRemindBeforeMin(newV);
                        if (text.trim()) onSave(buildDraft({ remindBeforeMin: newV }));
                      }}
                    >
                      <span className="text-[7.5px] font-bold leading-tight">{opt.label}</span>
                    </label>
                  ))}
                  <label
                    className={`flex flex-col items-center py-1 px-1 rounded border cursor-pointer ${
                      isCustomRemindBefore || customRemindOpen ? 'bg-orange-500/10 text-orange-400 border-orange-500/40' : 'border-white/5 text-zinc-200 hover:bg-white/5'
                    }`}
                    onClick={() => {
                      setCustomRemindDraft(isCustomRemindBefore ? String(remindBeforeMin) : '');
                      setCustomRemindOpen(true);
                    }}
                  >
                    <span className="text-[7.5px] font-bold leading-tight truncate max-w-full">
                      {isCustomRemindBefore ? `${remindBeforeMin}m antes` : 'Personalizado'}
                    </span>
                  </label>
                </div>
                {customRemindOpen && (
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <input
                      type="number"
                      min={0}
                      max={10080}
                      autoFocus
                      placeholder="Minutos antes"
                      value={customRemindDraft}
                      onChange={(e) => setCustomRemindDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') commitCustomRemind(); }}
                      className="flex-1 bg-transparent border border-jaspe-border py-1 px-2 rounded-lg text-[10px] text-zinc-100 font-bold focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={commitCustomRemind}
                      className="px-2.5 py-1 bg-orange-600 hover:bg-orange-700 text-white text-[9px] font-bold rounded-lg active:scale-95 transition-all"
                    >
                      OK
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-0.5">
                <label className="text-[8px] text-zinc-400 font-bold uppercase">
                  Repetir alerta até concluir/adiar/parar
                </label>
                <div className="grid grid-cols-3 gap-1">
                  {repeatOptions.map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex flex-col items-center py-1 px-1 rounded border cursor-pointer ${
                        repeatEveryMin === opt.value ? 'bg-orange-500/10 text-orange-400 border-orange-500/40' : 'border-white/5 text-zinc-200 hover:bg-white/5'
                      }`}
                      onClick={() => {
                        const newV = clampRepeatEveryMin(opt.value);
                        setRepeatEveryMin(newV);
                        if (text.trim()) onSave(buildDraft({ repeatEveryMin: newV }));
                      }}
                    >
                      <span className="text-[7.5px] font-bold leading-tight">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-[11px] text-zinc-200 font-semibold select-none mt-0.5">
                <input
                  type="checkbox"
                  checked={google}
                  onChange={(e) => handleToggleGoogle(e.target.checked)}
                  className="rounded border-jaspe-border text-orange-600 bg-[#1A1311] focus:ring-orange-500/20 w-3.5 h-3.5"
                />
                <span>Marcar como evento de agenda</span>
              </label>

              <button
                onClick={handleSaveAndClose}
                className="w-full mt-2 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-lg active:scale-95 transition-all"
              >
                Salvar
              </button>
              {taskId ? (
                <button
                  onClick={handleDelete}
                  className="w-full text-red-500/90 font-bold text-[10px] hover:underline flex items-center justify-center gap-1 active:scale-95 transition-all pt-0.5"
                >
                  <Trash className="w-3 h-3" /> Excluir tarefa
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
