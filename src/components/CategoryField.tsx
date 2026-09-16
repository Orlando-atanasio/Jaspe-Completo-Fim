import { useState, useEffect, useRef } from 'react';
import { Trash2, Plus, Check, X, ChevronDown, List } from 'lucide-react';
import { loadCats, saveCats, CategoryKind } from '../utils/categories';
import { playSynthSound } from '../utils/audio';

interface CategoryFieldProps {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  kind: CategoryKind;
  counts?: Record<string, number>;
  inputClassName?: string;
  onToast?: (msg: string) => void;
  onAfterChange?: () => void;
  hideLabel?: boolean;
  expand?: boolean;
}

export default function CategoryField({
  label,
  value,
  onChange,
  kind,
  counts,
  inputClassName,
  onToast,
  onAfterChange,
  hideLabel,
  expand
}: CategoryFieldProps) {
  const [cats, setCats] = useState<string[]>(() => loadCats(kind));
  const [open, setOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [draft, setDraft] = useState('');
  const boxRef = useRef<HTMLDivElement | null>(null);

  const notify = (msg: string) => {
    if (onToast) onToast(msg);
  };
  const after = () => {
    if (onAfterChange) setTimeout(onAfterChange, 0);
  };

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      try { boxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch {}
    }, 60);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
        setIsCreating(false);
        setDraft('');
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setIsCreating(false);
        setDraft('');
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const options = value && !cats.includes(value) ? [...cats, value] : cats;
  const total = counts
    ? options.reduce((a, c) => a + (counts[c] || 0), 0)
    : options.length;

  const pick = (v: string) => {
    playSynthSound('click');
    onChange(v);
    setOpen(false);
    setIsCreating(false);
    setDraft('');
    after();
  };

  const confirmCreate = () => {
    const name = draft.trim();
    if (!name) {
      setIsCreating(false);
      setDraft('');
      return;
    }
    const hit = cats.find((c) => c.toLowerCase() === name.toLowerCase());
    if (hit) {
      playSynthSound('click');
      onChange(hit);
      setOpen(false);
      setIsCreating(false);
      setDraft('');
      after();
      return;
    }
    playSynthSound('success');
    const next = [...cats, name];
    setCats(next);
    saveCats(kind, next);
    onChange(name);
    setOpen(false);
    setIsCreating(false);
    setDraft('');
    notify(`Categoria "${name}" criada!`);
    after();
  };

  const removeCat = (c: string) => {
    playSynthSound('click');
    if (!cats.includes(c)) return;
    if (cats.length <= 1) {
      notify('Mantenha ao menos 1 categoria.');
      return;
    }
    const next = cats.filter((x) => x !== c);
    setCats(next);
    saveCats(kind, next);
    if (value === c) onChange(next[0]);
    notify(`Categoria "${c}" excluída.`);
    after();
  };

  const triggerClasses = `flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition-all w-full active:scale-[0.99] ${
    open
      ? 'border-orange-500/40 bg-orange-500/10 shadow-[0_0_16px_rgba(249,115,22,0.18)]'
      : 'border-jaspe-border bg-jaspe-card hover:border-orange-500/25'
  } ${inputClassName || 'text-sm'}`;

    const cardClasses = expand
    ? 'absolute right-[-12px] top-full mt-1.5 rounded-xl border border-jaspe-border bg-jaspe-card shadow-2xl z-50 overflow-hidden w-[220px]'
    : 'rounded-xl border border-jaspe-border bg-jaspe-card shadow-xl overflow-hidden mt-1.5';

  return (
    <div className="space-y-1">
      {!hideLabel && (
        <label className="text-[10px] text-zinc-400 font-bold uppercase">{label}</label>
      )}
      <div ref={boxRef} className="relative">
        {/* Gatilho — só texto selecionado */}
        <button
          type="button"
          onClick={() => {
            playSynthSound('click');
            setOpen((o) => !o);
            setIsCreating(false);
            setDraft('');
          }}
          className={triggerClasses}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span className="font-bold text-zinc-200 flex-1">{value || 'Selecionar...'}</span>
          {counts && (
            <span className="min-w-[28px] h-5 px-1 rounded-full bg-white/8 text-zinc-400 text-[10px] font-extrabold flex items-center justify-center shrink-0">
              {counts[value] || 0}
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 shrink-0 transition-transform ${open ? 'rotate-180 text-orange-400' : 'text-zinc-500'}`}
          />
        </button>

        {/* Card expandido */}
        {open && (
          <div className={cardClasses}>
            {/* Cabeçalho */}
            <div className="px-4 pt-3 pb-2 flex items-center justify-between border-b border-jaspe-border">
              <span className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-zinc-400">
                <List className="w-3.5 h-3.5" /> Categorias & Pastas
              </span>
              <span className="text-[10px] font-bold text-zinc-500">{total} total</span>
            </div>

            {/* Lista */}
            <div className="max-h-56 overflow-y-auto py-1" role="listbox">
              {options.map((c, idx) => (
                <div
                  key={c + '_' + idx}
                  className={`flex items-center gap-2 px-3 py-2.5 mx-1 rounded-lg transition-all ${
                    c === value ? 'bg-orange-500/12' : 'hover:bg-white/[0.04]'
                  }`}
                >
                  <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      c === value ? 'bg-orange-500' : 'bg-zinc-600'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => pick(c)}
                    role="option"
                    aria-selected={c === value}
                    className={`flex-1 min-w-0 text-left px-2 py-1.5 rounded-lg text-[13px] transition-all ${
                      c === value ? 'font-extrabold text-orange-400' : 'font-medium text-zinc-300 hover:text-zinc-100'
                    }`}
                  >
                    {c}
                  </button>
                  {counts && (
                    <span className="min-w-[28px] h-5 px-1 rounded-full bg-white/8 text-zinc-400 text-[10px] font-extrabold flex items-center justify-center shrink-0">
                      {counts[c] || 0}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeCat(c)}
                    className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-all active:scale-90 shrink-0"
                    title={`Excluir "${c}"`}
                    aria-label={`Excluir categoria ${c}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  {c === value && (
                    <Check className="w-4 h-4 text-orange-400 shrink-0" />
                  )}
                </div>
              ))}
            </div>

            {/* Criar */}
            <div className="p-2">
              {!isCreating ? (
                <button
                  type="button"
                  onClick={() => {
                    playSynthSound('click');
                    setDraft('');
                    setIsCreating(true);
                  }}
                  className="w-full py-2.5 rounded-xl border border-dashed border-orange-500/25 text-orange-400 hover:bg-orange-500/8 text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" /> Criar Nova Categoria
                </button>
              ) : (
                <div className="space-y-1.5">
                  <input
                    type="text"
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') confirmCreate();
                    }}
                    placeholder="Digite o nome da nova categoria..."
                    className="w-full bg-jaspe-bg border border-jaspe-border rounded-xl px-3 py-3 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-orange-500/50"
                  />
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreating(false);
                        setDraft('');
                      }}
                      className="flex-1 py-2.5 rounded-xl bg-zinc-800 text-zinc-400 hover:bg-zinc-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95"
                    >
                      <X className="w-3.5 h-3.5" /> Desistir
                    </button>
                    <button
                      type="button"
                      onClick={confirmCreate}
                      className="flex-[2] py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 hover:brightness-110 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-lg shadow-orange-950/20"
                    >
                      <Check className="w-3.5 h-3.5" /> Criar categoria
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
