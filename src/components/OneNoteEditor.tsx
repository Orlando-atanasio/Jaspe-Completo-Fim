import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Pin,
  List,
  ListOrdered,
  MessageSquare,
  Send,
  Share2,
  Copy,
  Calendar,
  Trash,
  Plus,
  Check,
  X,
  Tag,
  ChevronDown,
  Square,
  CheckSquare,
  Highlighter,
  Clock,
  Undo2,
  Redo2
} from 'lucide-react';
import { Note } from '../types';
import { playSynthSound } from '../utils/audio';
import CategoryField from './CategoryField';
import { copyTextSafe, shareTextSafe } from '../utils/share';
import { newUUID } from '../utils/ids';
import { sanitizeNoteBody } from '../utils/sanitize';
import { NOTE_PALETTES, getNoteTheme, lightenHex, hexToRgb } from '../utils/noteColors';

// Dropdown ancorado estilo Excel (abre p/ baixo, sem picker nativo do Android).
// Fora do componente p/ não remontar (e fechar sozinho) a cada tecla digitada.
function MiniDrop({ label, options, value, onPick, panelWidth }: {
  label: React.ReactNode;
  options: { value: string; label: string }[];
  value: string;
  onPick: (v: string) => void;
  panelWidth?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 bg-jaspe-card border border-jaspe-border text-[10px] rounded-lg px-2 py-1 text-zinc-300 active:scale-95 transition-all"
      >
        <span className="truncate max-w-[110px]">{label}</span>
        <ChevronDown className={`w-3 h-3 text-zinc-500 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-label="Fechar"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default bg-transparent"
          />
          <div
            className={`absolute left-0 top-full mt-1 z-50 ${panelWidth || 'min-w-[140px]'} max-h-52 overflow-y-auto rounded-xl border border-jaspe-border bg-[#1A1311] shadow-2xl py-1`}
          >
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onPick(o.value); setOpen(false); }}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-[11px] transition-colors truncate ${
                  o.value === value ? 'text-orange-400 font-extrabold bg-orange-500/10' : 'text-zinc-300 hover:bg-white/5'
                }`}
              >
                <span className="truncate">{o.label}</span>
                {o.value === value && <Check className="w-3.5 h-3.5 shrink-0" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

interface OneNoteEditorProps {
  note: Note;
  onSave: (updated: Partial<Note>) => void;
  onClose: () => void;
  onDelete: (id: number) => void;
  onScheduleNote: (note: Note) => void;
  onShowToast: (msg: string) => void;
}

export default function OneNoteEditor({
  note,
  onSave,
  onClose,
  onDelete,
  onScheduleNote,
  onShowToast
}: OneNoteEditorProps) {
  const [title, setTitle] = useState(note?.title || "");
  const [body, setBody] = useState(note?.body || "");
  const [pinned, setPinned] = useState(!!note?.pinned);
  const [color, setColor] = useState(note?.color || '#251C1A');
  const [paperStyle, setPaperStyle] = useState(note?.paperStyle || 'dots-paper');
  const [category, setCategory] = useState(note?.category || 'Trabalho');
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  // Carimbo do cabeçalho (SEMPRE acima do título): inicializa da nota, sincroniza por id.
  // Não deriva de updatedAt em render porque cada tecla atualiza updatedAt.
  const stampFromNote = (n: typeof note) => {
    const d = n?.date || new Date().toLocaleDateString('pt-BR');
    let hm = '';
    try {
      if (n?.updatedAt) {
        hm = new Date(n.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      }
    } catch {}
    if (!hm || hm === 'Invalid Date') {
      hm = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
    return { date: d, time: hm };
  };
  const [headerStamp, setHeaderStamp] = useState(() => stampFromNote(note));


  const editorRef = useRef<HTMLDivElement>(null);
  // No celular o toque na barra rouba o cursor: guarda a última seleção válida
  const savedRange = useRef<Range | null>(null);
  // CORREÇÃO (bug reportado: tamanho de fonte não aplica em texto já selecionado):
  // guarda se o último toque (pointerdown/mousedown/touchstart) caiu DENTRO do
  // editor ou FORA dele (barra de ferramentas, dropdowns, painéis). É a única
  // forma confiável de diferenciar um colapso de seleção intencional (usuário
  // tocou no texto p/ reposicionar o cursor) de um colapso incidental causado
  // pelo próprio toque na barra — que no Android acontece no nível nativo do
  // WebView (dismiss da UI de seleção), mesmo com `ae === ed` (o foco continua
  // no editor) e mesmo com onMouseDown->preventDefault nos botões. A guarda
  // anterior (checar só o activeElement) não cobria esse caso, pois o foco de
  // fato não saía do editor — só a seleção colapsava — e por isso o comando de
  // tamanho caía no modo "armar digitação" em vez de aplicar ao trecho já
  // selecionado.
  const lastPointerInsideEditor = useRef(true);
  useEffect(() => {
    const onPointerDown = (e: Event) => {
      const ed = editorRef.current;
      const t = e.target as Node | null;
      lastPointerInsideEditor.current = !!(ed && t && ed.contains(t));
    };
    const onSel = () => {
      try {
        const sel = window.getSelection();
        const ed = editorRef.current;
        if (!ed || !sel || sel.rangeCount === 0) return;
        // Fora de foco (toque na barra/menus/dropdowns): NÃO sobrescreve.
        const ae = document.activeElement;
        if (ae !== ed && !(ae && ed.contains(ae))) return;
        if (!ed.contains(sel.anchorNode)) return;
        // Colapso originado por toque FORA do editor enquanto havia uma
        // seleção de verdade guardada: ignora — preserva o trecho selecionado
        // p/ os comandos de formatação (negrito, tamanho, marca-texto etc.).
        if (
          sel.isCollapsed &&
          !lastPointerInsideEditor.current &&
          savedRange.current &&
          !savedRange.current.collapsed
        ) {
          return;
        }
        savedRange.current = sel.getRangeAt(0).cloneRange();
      } catch {}
    };
    document.addEventListener('selectionchange', onSel);
    // capture:true — precisa registrar o alvo do toque antes de qualquer
    // outro handler (inclusive o preventDefault dos botões da barra) rodar.
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('mousedown', onPointerDown, true);
    document.addEventListener('touchstart', onPointerDown, true);
    return () => {
      document.removeEventListener('selectionchange', onSel);
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('mousedown', onPointerDown, true);
      document.removeEventListener('touchstart', onPointerDown, true);
    };
  }, []);

  const restoreCaret = (): boolean => {
    const ed = editorRef.current;
    if (!ed) return false;
    try {
      const sel = window.getSelection();
      // Seleção válida e não-colapsada dentro do editor: segue direto.
      if (sel && sel.rangeCount > 0 && !sel.isCollapsed && ed.contains(sel.anchorNode)) return true;
      // Toque na barra no Android costuma colapsar o cursor (às vezes p/ dentro
      // do próprio editor): nesse caso o ramo acima retornava true com seleção
      // colapsada e o tamanho/fonte caía no modo "armar digitação" — o texto já
      // escrito nunca mudava. Tenta o último range válido guardado antes.
      const sv = savedRange.current;
      try {
        if (sv && !sv.collapsed && ed.contains(sv.startContainer) && ed.contains(sv.endContainer)) {
          try { ed.focus({ preventScroll: true } as FocusOptions); } catch { try { ed.focus(); } catch {} }
          if (sel) {
            sel.removeAllRanges();
            sel.addRange(sv.cloneRange());
            try { savedRange.current = sel.getRangeAt(0).cloneRange(); } catch {}
            return true;
          }
        }
      } catch {}
      if (sel && sel.rangeCount > 0 && ed.contains(sel.anchorNode)) return true;
      if (savedRange.current) {
        ed.focus({ preventScroll: true } as FocusOptions);
        const s2 = window.getSelection();
        if (s2) { s2.removeAllRanges(); s2.addRange(savedRange.current); return true; }
      }
    } catch {}
    try { ed.focus(); } catch {}
    return true;
  };

  // Histórico próprio de desfazer/refazer (as mutações via Range API não entram
  // no undo nativo do navegador — por isso as setinhas ↩↪ são necessárias).
  // Digitação contínua agrupa (1,5s); ações de botão sempre viram novo passo.
  const histRef = useRef<{ stack: string[]; idx: number; lastTime: number; program: boolean }>({
    stack: [], idx: -1, lastTime: 0, program: false,
  });
  const [histNav, setHistNav] = useState({ canUndo: false, canRedo: false });
  const syncHistNav = () => {
    const { stack, idx } = histRef.current;
    setHistNav({ canUndo: idx > 0, canRedo: idx >= 0 && idx < stack.length - 1 });
  };
  const pushHistory = (html: string) => {
    const h = histRef.current;
    if (h.idx < h.stack.length - 1) h.stack = h.stack.slice(0, h.idx + 1); // descarta refazer
    const now = Date.now();
    if (!h.program && h.idx >= 0 && now - h.lastTime < 1500) {
      h.stack[h.idx] = html; // agrupa digitação contínua
    } else {
      h.stack.push(html);
      if (h.stack.length > 50) h.stack.shift();
      h.idx = h.stack.length - 1;
    }
    h.lastTime = now;
    h.program = false;
    syncHistNav();
  };
  const markProgramStep = () => { histRef.current.program = true; };
  const applyHistoryState = (html: string) => {
    const ed = editorRef.current;
    if (!ed) return;
    const safe = sanitizeNoteBody(html);
    ed.innerHTML = safe;
    setBody(safe);
    onSave({ body: safe });
    histRef.current.lastTime = 0; // próxima digitação vira passo novo
    try {
      ed.focus();
      const sel = window.getSelection();
      if (sel) {
        const r = document.createRange();
        r.selectNodeContents(ed);
        r.collapse(false);
        sel.removeAllRanges();
        sel.addRange(r);
        try { savedRange.current = r.cloneRange(); } catch {}
      }
    } catch {}
    syncHistNav();
  };
  const undoEdit = () => {
    playSynthSound('click');
    const h = histRef.current;
    if (h.idx <= 0) { onShowToast('Nada a desfazer.'); return; }
    h.idx -= 1;
    applyHistoryState(h.stack[h.idx]);
  };
  const redoEdit = () => {
    playSynthSound('click');
    const h = histRef.current;
    if (h.idx < 0 || h.idx >= h.stack.length - 1) { onShowToast('Nada a refazer.'); return; }
    h.idx += 1;
    applyHistoryState(h.stack[h.idx]);
  };

  // Sincroniza por id (objeto muda a cada tecla — dep em [note] faria o cursor pular)
  useEffect(() => {
    setTitle(note?.title || "");
    setBody(note?.body || "");
    setPinned(!!note?.pinned);
    setColor(note?.color || '#251C1A');
    setPaperStyle(note?.paperStyle || 'dots-paper');
    setCategory(note?.category || 'Trabalho');
    setIsConfirmingDelete(false);
    setHeaderStamp(stampFromNote(note));
    savedRange.current = null;
    if (editorRef.current) {
      // Migração: carimbo antigo inserido no corpo (abaixo do título) volta p/ o cabeçalho
      const raw = sanitizeNoteBody(note?.body || "");
      const cleaned = raw.replace(/<p>📅 \d{2}\/\d{2}\/\d{4} • \d{2}:\d{2}<\/p>/, '<p><br></p>');
      if (cleaned !== raw) {
        editorRef.current.innerHTML = cleaned;
        setBody(cleaned);
        onSave({ body: cleaned });
      } else {
        editorRef.current.innerHTML = raw;
      }
      histRef.current = { stack: [editorRef.current.innerHTML], idx: 0, lastTime: 0, program: false };
      syncHistNav();
    }
  }, [note?.id]);

  const handleTitleChange = (val: string) => {
    setTitle(val);
    onSave({ title: val });
  };

  const handleBodyInput = () => {
    if (editorRef.current) {
      const raw = editorRef.current.innerHTML;
      setBody(raw);
      onSave({ body: raw });
      pushHistory(raw);
    }
  };

  const handleBodyBlur = () => {
    if (!editorRef.current) return;
    const safe = sanitizeNoteBody(editorRef.current.innerHTML);
    if (editorRef.current.innerHTML !== safe) {
      editorRef.current.innerHTML = safe;
      setBody(safe);
      onSave({ body: safe });
      pushHistory(safe);
    }
  };

  // Cola sanitizada: impede <img onerror> / <svg onload> vindos de fora.
  const handleBodyPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const ed = editorRef.current;
    if (!ed) return;
    try {
      const htmlData = e.clipboardData?.getData('text/html') || '';
      const textData = e.clipboardData?.getData('text/plain') || '';
      restoreCaret();
      markProgramStep();
      if (htmlData) {
        const safe = sanitizeNoteBody(htmlData);
        if (safe && insertHtmlAtCaret(safe)) { handleBodyInput(); return; }
      }
      if (textData) {
        const esc = textData.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
        if (insertHtmlAtCaret(`<p>${esc}</p>`)) { handleBodyInput(); return; }
      }
    } catch { /* fallback abaixo */ }
    try { document.execCommand('insertText', false, e.clipboardData?.getData('text/plain') || ''); } catch {}
    handleBodyInput();
  };

  const handleTogglePin = () => {
    playSynthSound('click');
    const newPinned = !pinned;
    setPinned(newPinned);
    onSave({ pinned: newPinned });
  };

  const handleColorChange = (newColor: string) => {
    playSynthSound('click');
    setColor(newColor);
    onSave({ color: newColor });
  };

  const handlePaperStyleChange = (style: string) => {
    playSynthSound('click');
    setPaperStyle(style);
    onSave({ paperStyle: style });
  };


  const formatText = (cmd: string, val: string | null = null) => {
    playSynthSound('click');
    if (!restoreCaret()) { onShowToast('Toque no texto da nota e tente de novo.'); return; }
    try {
      markProgramStep();
      const ok = document.execCommand(cmd, false, val || undefined);
      if (!ok) { histRef.current.program = false; onShowToast('Selecione o texto e tente de novo.'); return; }
    } catch (err) {
      console.warn('Falha no comando de formatação:', err);
      histRef.current.program = false;
      onShowToast('Falha na formatação.');
      return;
    }
    handleBodyInput();
  };

  // Opções dos dropdowns ancorados (o MiniDrop mora no escopo do módulo)
  const PAPER_OPTS = [
    { value: 'ruled-paper', label: 'Linhas' },
    { value: 'dots-paper', label: 'Pontilhado' },
    { value: 'grid-paper', label: 'Quadriculado' },
    { value: 'bg-jaspe-card', label: 'Branco' }
  ];
  const PAPER_LABEL: Record<string, string> = {
    'ruled-paper': 'Linhas', 'dots-paper': 'Pontilhado', 'grid-paper': 'Quadriculado', 'bg-jaspe-card': 'Branco'
  };

  const SIZE_OPTS = [7, 8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 40, 44, 48].map((n) => ({
    value: String(n), label: `${n}${n === 16 ? ' (Padrão)' : ''}`
  }));
  const [lastSize, setLastSize] = useState('16');

  const ZWSP = String.fromCharCode(8203); // âncora invisível do cursor

  // Estilo inline efetivo sobre a seleção: ancestrais do ponto inicial
  // MAIS todos os estilos dentro do fragmento selecionado. Sem a 2ª parte,
  // seleção em nível de elemento (comum no Android) perde tamanho/cor internos.
  const effectiveInlineStyle = (): string => {
    try {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return '';
      const parts: string[] = [];
      const pushTag = (tag: string) => {
        if (tag === 'B' || tag === 'STRONG') parts.push('font-weight:bold');
        if (tag === 'I' || tag === 'EM') parts.push('font-style:italic');
        if (tag === 'U') parts.push('text-decoration:underline');
        if (tag === 'S' || tag === 'STRIKE') parts.push('text-decoration:line-through');
      };
      // 1) ancestrais do início (de fora p/ dentro)
      const ed = editorRef.current;
      const chain: HTMLElement[] = [];
      let node: Node | null = sel.getRangeAt(0).startContainer;
      while (node && node !== ed) {
        if (node instanceof HTMLElement) chain.unshift(node);
        node = node.parentNode;
      }
      for (const el of chain) {
        const st = el.getAttribute('style');
        if (st) parts.push(st.replace(/;\s*$/, ''));
        pushTag(el.tagName);
      }
      // 2) estilos dentro do conteúdo selecionado (primeiro achado de cada prop)
      const PROPS = ['font-size', 'font-weight', 'font-style', 'color', 'text-decoration', 'background-color'];
      const joined = `;${parts.join(';').toLowerCase()};`;
      const seen = new Set(PROPS.filter((p) => joined.includes(`;${p}:`)));
      const div = document.createElement('div');
      div.appendChild(sel.getRangeAt(0).cloneContents());
      div.querySelectorAll('[style]').forEach((el) => {
        const h = el as HTMLElement;
        for (const p of PROPS) {
          if (seen.has(p)) continue;
          const v = h.style.getPropertyValue(p);
          if (v) { parts.push(`${p}:${v}`); seen.add(p); }
        }
      });
      div.querySelectorAll('b,strong,i,em,u,s,strike').forEach((el) => {
        if (!seen.has('font-weight') && (el.tagName === 'B' || el.tagName === 'STRONG')) { parts.push('font-weight:bold'); seen.add('font-weight'); }
        if (!seen.has('font-style') && (el.tagName === 'I' || el.tagName === 'EM')) { parts.push('font-style:italic'); seen.add('font-style'); }
        if (!seen.has('text-decoration') && (el.tagName === 'U' || el.tagName === 'S' || el.tagName === 'STRIKE')) { parts.push('text-decoration:underline'); seen.add('text-decoration'); }
      });
      return parts.join(';');
    } catch { return ''; }
  };

  const withoutProp = (style: string, prop: string): string =>
    style.split(';').map((s) => s.trim()).filter((s) => s && !s.toLowerCase().startsWith(prop + ':')).join(';');

  // Núcleo de inserção via Range API (execCommand está depreciado e falha
  // silenciosamente no WebView Android — causa raiz do "não obedece").
  // Retorna true se inseriu; posiciona o cursor logo após o conteúdo.
  const insertHtmlAtCaret = (html: string): boolean => {
    const ed = editorRef.current;
    const sel = window.getSelection();
    if (!ed || !sel || sel.rangeCount === 0) return false;
    const range = sel.getRangeAt(0);
    if (!ed.contains(range.commonAncestorContainer)) return false;
    try {
      range.deleteContents();
      const tmp = document.createElement('div');
      tmp.innerHTML = html;
      const frag = document.createDocumentFragment();
      let last: Node | null = null;
      while (tmp.firstChild) { last = tmp.firstChild; frag.appendChild(last); }
      range.insertNode(frag);
      if (last) {
        const after = document.createRange();
        after.setStartAfter(last);
        after.collapse(true);
        sel.removeAllRanges();
        sel.addRange(after);
        try { savedRange.current = after.cloneRange(); } catch {}
      }
      return true;
    } catch {
      try {
        return document.execCommand('insertHTML', false, html);
      } catch { return false; }
    }
  };

  // Envolve a seleção preservando o HTML interno E o estilo do ponto (tamanho,
  // negrito etc.). overrideProp troca a propriedade (ex: novo tamanho substitui o velho).
  const wrapSelection = (style: string, overrideProp?: string): boolean => {
    const sel = window.getSelection();
    const ed = editorRef.current;
    if (!sel || sel.isCollapsed || sel.rangeCount === 0 || !ed) return false;
    const range = sel.getRangeAt(0);
    if (!ed.contains(range.commonAncestorContainer)) return false;
    let base = effectiveInlineStyle();
    if (overrideProp) base = withoutProp(base, overrideProp);
    const merged = base ? `${base};${style}` : style;
    try {
      const contents = range.extractContents();
      const span = document.createElement('span');
      span.setAttribute('style', merged);
      span.appendChild(contents);
      range.insertNode(span);
      const applied = document.createRange();
      applied.selectNodeContents(span);
      sel.removeAllRanges();
      sel.addRange(applied);
      try { savedRange.current = applied.cloneRange(); } catch {}
      return true;
    } catch {
      // fallback legado p/ navegadores antigos
      try {
        const div = document.createElement('div');
        div.appendChild(sel.getRangeAt(0).cloneContents());
        sel.removeAllRanges();
        sel.addRange(range);
        return document.execCommand('insertHTML', false, `<span style="${merged}">${div.innerHTML}</span>`);
      } catch { return false; }
    }
  };

  // Remove só o fundo (destaque), mantendo tamanho/negrito do trecho
  const stripBackground = (): boolean => {
    const sel = window.getSelection();
    const ed = editorRef.current;
    if (!sel || sel.isCollapsed || sel.rangeCount === 0 || !ed) return false;
    const range = sel.getRangeAt(0);
    if (!ed.contains(range.commonAncestorContainer)) return false;
    try {
      const frag = range.extractContents();
      const walker = document.createTreeWalker(frag, NodeFilter.SHOW_ELEMENT);
      const els: Element[] = [];
      let n: Node | null;
      while ((n = walker.nextNode())) els.push(n as Element);
      els.forEach((el) => {
        const h = el as HTMLElement;
        if (h.style && h.style.backgroundColor) {
          h.style.backgroundColor = '';
          if (!h.getAttribute('style')) h.removeAttribute('style');
        }
      });
      // se o próprio conteúdo era só texto com fundo herdado, nada a limpar acima;
      // reinsere o fragmento tratado (quem chamou persiste via handleBodyInput)
      range.insertNode(frag);
      return true;
    } catch { return false; }
  };

  // Insere span vazio estilizado e põe o cursor dentro (p/ continuar digitando)
  const insertArmedSpan = (style: string): boolean => {
    const ed = editorRef.current;
    if (!ed) return false;
    const marker = `st${Date.now().toString(36)}`;
    const ok = insertHtmlAtCaret(`<span id="${marker}" style="${style}">${ZWSP}</span>`);
    if (!ok) return false;
    try {
      const el = ed.querySelector(`#${marker}`);
      const sel = window.getSelection();
      if (el && el.firstChild && sel) {
        el.removeAttribute('id');
        const caret = document.createRange();
        caret.setStart(el.firstChild, 0);
        caret.collapse(true);
        sel.removeAllRanges();
        sel.addRange(caret);
        try { savedRange.current = caret.cloneRange(); } catch {}
        return true;
      }
    } catch {}
    return ok;
  };

  const HL_COLORS = ['#FEF3C7', '#FFEDD5', '#FED7AA', '#FECACA', '#FBCFE8', '#E9D5FF', '#BAE6FD', '#BBF7D0', '#D9F99D', '#251C1A'];
  const [hlOpen, setHlOpen] = useState(false);

  // Marca-texto: com seleção aplica a cor (sem matar tamanho/negrito);
  // sem seleção arma p/ digitar
  const applyHighlight = (hex: string | null) => {
    playSynthSound('click');
    if (!restoreCaret()) return;
    markProgramStep();
    try {
      if (hex) {
        if (wrapSelection(`background-color:${hex}`, 'background-color')) {
          onShowToast('Destaque aplicado.');
        } else if (insertArmedSpan(`background-color:${hex}`)) {
          onShowToast('Destaque ativado — pode digitar.');
        } else {
          onShowToast('Toque no texto da nota e tente de novo.');
          return;
        }
      } else {
        if (stripBackground()) {
          onShowToast('Destaque removido.');
        } else {
          onShowToast('Selecione o texto p/ remover o destaque.');
          return;
        }
      }
    } catch (err) {
      console.warn('Falha no destaque:', err);
    }
    setHlOpen(false);
    handleBodyInput();
  };

  // Linhas HTML da seleção (quebra em blocos, mantém inline: tamanho, cor etc.)
  const selectionHtmlLines = (): string[] | null => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
    const div = document.createElement('div');
    div.appendChild(sel.getRangeAt(0).cloneContents());
    const html = div.innerHTML
      .replace(/<\/(p|div|li|h1|h2|h3|h4)>\s*<(p|div|li|h1|h2|h3|h4)[^>]*>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n');
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    tmp.querySelectorAll('p,div,ul,ol,li,h1,h2,h3,h4').forEach((el) => {
      el.replaceWith(...Array.from(el.childNodes));
    });
    return tmp.innerHTML.split('\n');
  };

  // Listas via Range API (execCommand de lista é ignorado no WebView Android)
  const insertList = (ordered: boolean) => {
    playSynthSound('click');
    const ed = editorRef.current;
    if (!ed) return;
    if (!restoreCaret()) return;
    markProgramStep();
    const tag = ordered ? 'ol' : 'ul';
    try {
      const lines = selectionHtmlLines();
      if (lines && lines.some((l) => l.replace(/<[^>]*>/g, '').trim() !== '')) {
        const items = lines.map((l) => `<li>${l.trim() || '<br>'}</li>`).join('');
        if (insertHtmlAtCaret(`<${tag}>${items}</${tag}><p><br></p>`)) {
          onShowToast(ordered ? 'Lista numerada criada.' : 'Lista criada.');
        } else {
          onShowToast('Selecione o texto da nota antes de criar a lista.');
          return;
        }
      } else {
        const marker = `li${Date.now().toString(36)}`;
        if (!insertHtmlAtCaret(`<${tag}><li id="${marker}">${ZWSP}</li></${tag}><p><br></p>`)) {
          onShowToast('Toque no texto da nota e tente de novo.');
          return;
        }
        const el = ed.querySelector(`#${marker}`);
        const selNow = window.getSelection();
        if (el && el.firstChild && selNow) {
          el.removeAttribute('id');
          const range = document.createRange();
          range.setStart(el.firstChild, 0);
          range.collapse(true);
          selNow.removeAllRanges();
          selNow.addRange(range);
        }
      }
    } catch (err) {
      console.warn('Falha ao inserir lista:', err);
      onShowToast('Falha ao criar lista.');
      return;
    }
    handleBodyInput();
  };
  // Com seleção: aplica no trecho. Sem seleção: "arma" o tamanho —
  // insere span vazio e põe o cursor dentro, p/ o que for digitado sair no tamanho.
  const applyFontSize = (px: number) => {
    playSynthSound('click');
    const ed = editorRef.current;
    if (!ed) return;
    if (!restoreCaret()) { onShowToast('Toque no texto da nota e tente de novo.'); return; }
    markProgramStep();
    try {
      if (wrapSelection(`font-size:${px}px`, 'font-size')) {
        onShowToast(`Tamanho ${px} aplicado.`);
      } else if (insertArmedSpan(`font-size:${px}px`)) {
        onShowToast(`Tamanho ${px} ativado — pode digitar.`);
      } else {
        onShowToast('Selecione o texto ou toque onde quer digitar.');
        return;
      }
    } catch (err) {
      console.warn('Falha ao aplicar tamanho:', err);
      onShowToast('Falha ao aplicar tamanho.');
      return;
    }
    setLastSize(String(px));
    handleBodyInput();
  };

  // Reloginho: atualiza o carimbo ACIMA do título (padrão: data/hora sempre acima,
  // nunca no corpo). Não insere nada no texto.
  const insertDateTime = () => {
    playSynthSound('click');
    const now = new Date();
    const d = now.toLocaleDateString('pt-BR');
    const hm = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    setHeaderStamp({ date: d, time: hm });
    onSave({ date: d, updatedAt: now.toISOString() });
    onShowToast('Data/hora atualizadas.');
  };

  const handleShare = (channel: string) => {
    playSynthSound('click');
    const textClean = (body || "").replace(/<[^>]*>/g, "");
    const textToShare = `${title || 'Anotação'}\n\n${textClean}`.trim();
    if (!textClean && !title.trim()) { onShowToast('Nota vazia — nada para compartilhar.'); return; }
    if (channel === 'copy') {
      copyTextSafe(textToShare).then((ok) => {
        onShowToast(ok ? 'Anotação copiada para a área de transferência!' : 'Falha ao copiar.');
      });
      return;
    } else if (channel === 'universal') {
      void shareTextSafe(title || 'JaspeNote', textToShare).then((r) => {
        if (r === 'copied') onShowToast('Compartilhamento indisponível — texto copiado.');
        else if (r === 'failed') onShowToast('Falha ao compartilhar.');
      });
    } else if (channel === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(textToShare)}`, '_blank', 'noopener,noreferrer');
    } else if (channel === 'telegram') {
      window.open(`https://t.me/share/url?url=&text=${encodeURIComponent(textToShare)}`, '_blank', 'noopener,noreferrer');
    } else {
      copyTextSafe(textToShare).then((ok) => {
        onShowToast(ok ? 'Compartilhamento indisponível — texto copiado.' : 'Falha ao copiar.');
      });
    }
  };

  const [checklist, setChecklist] = useState<{ id: string; text: string; done: boolean }[]>(note?.checklist || []);
  const [newCheckText, setNewCheckText] = useState('');
  // Linha "+ Adicionar item" (estilo Keep): fechada = botão; aberta = caixinha + campo com cursor.
  const [isAddingCheck, setIsAddingCheck] = useState(false);
  // Painel oculto por padrão; liga na caixinha da barra (✓) e sobe p/ cima do texto
  const [showChecklist, setShowChecklist] = useState((note?.checklist?.length || 0) > 0);
  const imgRef = React.useRef<HTMLInputElement | null>(null);
  const checkInputRef = React.useRef<HTMLInputElement | null>(null);

  // sincroniza checklist ao trocar de nota
  React.useEffect(() => {
    setChecklist(note?.checklist || []);
    setShowChecklist((note?.checklist?.length || 0) > 0);
    setNewCheckText('');
    setIsAddingCheck(false);
  }, [note?.id]);

  const persistChecklist = (list: { id: string; text: string; done: boolean }[]) => {
    setChecklist(list);
    onSave({ checklist: list });
  };

  // Caixinha da barra: liga (✓) e chama o painel p/ cima; desliga e oculta.
  // Com texto selecionado, ele já nasce como item com caixinha de verdade.
  const toggleChecklistPanel = () => {
    playSynthSound('click');
    if (showChecklist) { setShowChecklist(false); setIsAddingCheck(false); setNewCheckText(''); return; }
    const sel = window.getSelection();
    const txt = sel ? sel.toString().trim().slice(0, 120) : '';
    if (txt) {
      persistChecklist([...checklist, { id: newUUID(), text: txt, done: false }]);
      onShowToast('Item adicionado ao checklist.');
    }
    setShowChecklist(true);
    setTimeout(() => {
      try { checkInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch {}
      try { checkInputRef.current?.focus({ preventScroll: true } as FocusOptions); } catch {}
    }, 60);
  };

  const handleImage = async (f: File) => {
    try {
      if (!f.type.startsWith('image/')) { onShowToast('Selecione uma imagem.'); return; }
      if (f.size > 2 * 1024 * 1024) { onShowToast('Imagem >2MB — comprimida via redimensionamento pode falhar.'); }
      const rawUrl = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result));
        r.onerror = rej;
        r.readAsDataURL(f);
      });
      const dataUrl = await compressImage(rawUrl);
      // insere <img> redimensionada (armazenada na nota; sandbox futura: Filesystem)
      if (editorRef.current) {
        restoreCaret();
        markProgramStep();
        const ok = insertHtmlAtCaret('<br/><img src="' + dataUrl + '" style="max-width:100%;border-radius:12px;" /><br/>');
        if (ok) handleBodyInput();
        else { onShowToast('Toque no texto da nota e tente de novo.'); return; }
      }
      onShowToast('Imagem inserida na nota.');
    } catch { onShowToast('Falha ao inserir imagem.'); }
  };

  // Reduz p/ no máximo 1024px JPEG 0.8 — original de 4MB vira ~150KB
  const compressImage = (src: string): Promise<string> => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const MAX = 1024;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const cv = document.createElement('canvas');
        cv.width = Math.max(1, Math.round(img.width * scale));
        cv.height = Math.max(1, Math.round(img.height * scale));
        const ctx = cv.getContext('2d');
        if (!ctx) { resolve(src); return; }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.drawImage(img, 0, 0, cv.width, cv.height);
        resolve(cv.toDataURL('image/jpeg', 0.8));
      } catch { resolve(src); }
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });

  const handleDelete = () => {
    playSynthSound('click');
    if (note?.id == null) { onClose(); return; }
    onDelete(note.id);
    onClose();
    onShowToast('Anotação excluída com sucesso!');
  };

  // Text stats
  const textOnly = (body || "").replace(/<[^>]*>/g, "").trim();
  const wordCount = textOnly === '' ? 0 : textOnly.split(/\s+/).length;
  const charCount = textOnly.length;

  const currentTheme = getNoteTheme(color);
  const isDarkColor = currentTheme.isDark;
  const lightMode = !isDarkColor;

  // Padrão de zonas: A = cor forte (cabeçalho), B em diante = mesma cor em tom claro
  // Papel precisa ser visivelmente tingido (folha de papel), não quase-branco:
  // deriva do headerBg clareado, mantendo o matiz da cor selecionada.
  const zoneABg = currentTheme.headerBg;
  const paperBg = lightMode ? lightenHex(currentTheme.headerBg, 0.62) : currentTheme.bodyBg;
  const zoneBBg = paperBg;
  const bodyBg = paperBg;
  const zoneAFg = currentTheme.headerFg;
  const zoneBFg = currentTheme.bodyFg;

  // Papel: folha inteira tingida + textura (linha/pontilhado/grade) em tom
  // derivado do cabeçalho p/ ficar visível sobre o papel claro.
  const lineOnPaper = (() => {
    if (isDarkColor) return currentTheme.lineColor;
    const rgb = hexToRgb(currentTheme.headerBg);
    if (!rgb) return currentTheme.lineColor;
    // escurece o header p/ a linha contrastar com o papel claro
    const dk = (v: number) => Math.round(v * 0.72);
    return `rgba(${dk(rgb.r)}, ${dk(rgb.g)}, ${dk(rgb.b)}, 0.38)`;
  })();
  const lightTexture: string | undefined =
    isDarkColor ? undefined
    : paperStyle === 'ruled-paper' ? `linear-gradient(${lineOnPaper} 1px, transparent 1px)`
    : paperStyle === 'dots-paper' ? `radial-gradient(${lineOnPaper} 1.3px, transparent 0)`
    : paperStyle === 'grid-paper' ? `linear-gradient(${lineOnPaper} 1px, transparent 1px), linear-gradient(90deg, ${lineOnPaper} 1px, transparent 1px)`
    : undefined;
  const lightTexSize =
    paperStyle === 'ruled-paper' ? '100% 28px'
    : paperStyle === 'dots-paper' ? '24px 24px'
    : '20px 20px';

  return (
    <div className="absolute inset-0 bg-jaspe-bg z-30 flex flex-col text-left">
      {/* Camada 1: Controle e Status (Voltar + Badge de Sucesso + Pin) — zona A forte */}
      <div className="h-14 border-b border-black/10 flex items-center justify-between px-4 transition-colors duration-200" style={{ backgroundColor: zoneABg }}>
        <button
          onClick={onClose}
          className="p-2 hover:bg-black/5 rounded-xl transition-all active:scale-95"
          style={{ color: zoneAFg }}
          aria-label="Voltar"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="bg-emerald-500/15 border border-emerald-600/25 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-xs">
          <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${lightMode ? 'bg-emerald-700' : 'bg-emerald-400'}`}></span>
          <span className={`text-[9px] uppercase tracking-wider font-extrabold ${lightMode ? 'text-emerald-800' : 'text-emerald-400'}`}>
            ✓ Salvo em tempo real
          </span>
        </div>
        <button
          onClick={handleTogglePin}
          className={`p-2 rounded-xl transition-all active:scale-95 ${
            pinned ? 'bg-amber-400/30 text-amber-900 shadow-xs' : 'hover:bg-black/5'
          }`}
          style={{ color: pinned ? '#b45309' : zoneAFg }}
          aria-label="Fixar Anotação"
        >
          <Pin className={`w-5 h-5 ${pinned ? 'fill-amber-500' : ''}`} />
        </button>
      </div>

      {/* Camada 2: Estilos de Caderno & Tingimento do Papel — zona A forte (para na linha) */}
      {/* overflow visível + z-30 p/ o dropdown do papel abrir POR CIMA do cabeçalho de baixo */}
      <div className="h-12 relative z-30 border-b border-black/10 px-4 flex items-center justify-between gap-2 transition-colors duration-200" style={{ backgroundColor: zoneABg }}>
        {/* Seletor do Papel do Caderno (ancorado, sem picker nativo) */}
        <MiniDrop
          label={PAPER_LABEL[paperStyle] || 'Papel'}
          options={PAPER_OPTS}
          value={paperStyle}
          onPick={handlePaperStyleChange}
        />

        {/* Tingimento Circular (10 cores harmonizadas com o print) */}
        <div className="flex items-center gap-1.5 overflow-x-auto min-w-0 flex-1 justify-end bg-black/10 px-2 py-1 rounded-full backdrop-blur-xs">
          {NOTE_PALETTES.map((p) => {
            const isSelected = currentTheme.swatch === p.swatch;
            return (
              <button
                key={p.swatch}
                onClick={() => handleColorChange(p.swatch)}
                className={`w-4.5 h-4.5 shrink-0 rounded-full border transition-all active:scale-90 ${
                  isSelected
                    ? 'ring-2 ring-zinc-900 scale-110 border-white shadow-xs'
                    : 'border-black/20 hover:scale-105'
                }`}
                style={{ backgroundColor: p.swatch }}
                title={p.name}
              />
            );
          })}
        </div>
      </div>

      {/* Camada 3: Formato (linha 1) + Listas de texto e Inserir (linha 2) — zona B clara */}
      <div className="relative z-10 border-b border-jaspe-border px-2 py-1.5 bg-black/15 text-zinc-300 space-y-1.5" style={lightMode ? { backgroundColor: zoneBBg, color: zoneBFg } : undefined}>
        <div className="flex items-center gap-1">
          <span className="text-[8px] font-bold text-zinc-500 uppercase w-9 shrink-0" style={lightMode ? { color: zoneBFg, opacity: 0.6 } : undefined}>Texto</span>
          <div className="flex items-center gap-0.5">
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => formatText('bold')}
              className="w-6 h-6 flex items-center justify-center font-extrabold hover:bg-white/10 rounded text-[11px] transition-colors"
              title="Negrito (Ctrl+B)"
            >
              N
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => formatText('italic')}
              className="w-6 h-6 flex items-center justify-center italic hover:bg-white/10 rounded text-[11px] transition-colors font-serif"
              title="Itálico (Ctrl+I)"
            >
              I
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => formatText('underline')}
              className="w-6 h-6 flex items-center justify-center underline hover:bg-white/10 rounded text-[11px] transition-colors"
              title="Sublinhado (Ctrl+U)"
            >
              U
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => formatText('strikeThrough')}
              className="w-6 h-6 flex items-center justify-center line-through hover:bg-white/10 rounded text-[11px] transition-colors text-zinc-400"
              style={lightMode ? { color: zoneBFg } : undefined}
              title="Tachado"
            >
              S
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => formatText('removeFormat')}
              className="w-6 h-6 flex items-center justify-center text-[9px] hover:bg-white/10 rounded transition-colors text-zinc-400"
              style={lightMode ? { color: zoneBFg } : undefined}
              title="Limpar formatação (tira tudo da seleção)"
            >
              Tx
            </button>
          </div>
          <div className="h-4 w-[1px] bg-jaspe-border shrink-0"></div>
          <div className="flex items-center gap-0.5">
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={undoEdit}
              disabled={!histNav.canUndo}
              className="w-6 h-6 flex items-center justify-center hover:bg-white/10 rounded transition-colors disabled:opacity-30 disabled:pointer-events-none"
              style={lightMode ? { color: zoneBFg } : undefined}
              title="Desfazer (Ctrl+Z)"
              aria-label="Desfazer"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={redoEdit}
              disabled={!histNav.canRedo}
              className="w-6 h-6 flex items-center justify-center hover:bg-white/10 rounded transition-colors disabled:opacity-30 disabled:pointer-events-none"
              style={lightMode ? { color: zoneBFg } : undefined}
              title="Refazer (Ctrl+Y)"
              aria-label="Refazer"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>
          <div className="h-4 w-[1px] bg-jaspe-border shrink-0"></div>
          <MiniDrop
            label={lastSize}
            options={SIZE_OPTS}
            value={lastSize}
            onPick={(v) => applyFontSize(Number(v))}
            panelWidth="min-w-[110px]"
          />
          <div className="relative shrink-0">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setHlOpen((o) => !o)}
              className="w-6 h-6 flex items-center justify-center hover:bg-white/10 rounded transition-colors"
              title="Marca-texto"
            >
              <Highlighter className={`w-4 h-4 ${lightMode ? 'text-amber-700' : 'text-amber-400'}`} />
            </button>
            {hlOpen && (
              <>
                <button
                  type="button"
                  aria-label="Fechar"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setHlOpen(false)}
                  className="fixed inset-0 z-40 cursor-default bg-transparent"
                />
                <div className="absolute right-0 top-full mt-1 z-50 rounded-xl border border-jaspe-border bg-[#1A1311] shadow-2xl p-2 w-[72px] max-h-[50vh] overflow-y-auto">
                  <div className="flex flex-col gap-1.5">
                    {HL_COLORS.map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => applyHighlight(hex)}
                        className="w-full h-7 rounded-lg border border-white/20 active:scale-95 transition-transform"
                        style={{ backgroundColor: hex }}
                        title={`Destacar de ${hex}`}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyHighlight(null)}
                    className="w-full mt-2 py-1.5 text-[10px] font-bold text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    Remover destaque
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[8px] font-bold text-zinc-500 uppercase w-9 shrink-0" style={lightMode ? { color: zoneBFg, opacity: 0.6 } : undefined}>Listas</span>
          <div className="flex items-center gap-0.5">
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertList(false)}
              className="p-1.5 hover:bg-white/10 rounded text-zinc-300 transition-colors"
              style={lightMode ? { color: zoneBFg } : undefined}
              title="Lista com marcadores (• item)"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertList(true)}
              className="p-1.5 hover:bg-white/10 rounded text-zinc-300 transition-colors"
              style={lightMode ? { color: zoneBFg } : undefined}
              title="Lista numerada (1. 2. 3.)"
            >
              <ListOrdered className="w-4 h-4" />
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={toggleChecklistPanel}
              className="p-1.5 hover:bg-white/10 rounded transition-colors"
              style={lightMode && !showChecklist ? { color: zoneBFg } : undefined}
              title="Checklist (caixinha de marcar)"
            >
              {showChecklist ? (
                <CheckSquare className={`w-4 h-4 ${lightMode ? 'text-emerald-700' : 'text-emerald-400'}`} />
              ) : (
                <Square className="w-4 h-4 text-zinc-300" style={lightMode ? { color: zoneBFg } : undefined} />
              )}
            </button>
          </div>
          <div className="h-4 w-[1px] bg-jaspe-border shrink-0"></div>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={insertDateTime}
            className="p-1.5 hover:bg-white/10 rounded transition-colors"
            style={lightMode ? { color: zoneBFg } : undefined}
            title="Inserir data e hora"
            aria-label="Inserir data e hora"
          >
            <Clock className="w-4 h-4" />
          </button>
          <button
            onClick={() => imgRef.current?.click()}
            className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-bold transition-all active:scale-95 shrink-0 ${lightMode ? 'bg-orange-700/10 border-orange-700/40 text-orange-800 hover:bg-orange-700/20' : 'bg-orange-600/15 border-orange-500/30 text-orange-400 hover:bg-orange-600/25'}`}
            title="Inserir imagem"
          >
            Inserir
          </button>
          <input ref={imgRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImage(f); e.target.value = ''; }} />
        </div>
      </div>
      {/* Camada 4: Ações Rápidas de Compartilhamento & Classificação — zona B clara */}
      <div className="h-12 relative z-0 border-b border-jaspe-border px-4 flex items-center justify-between bg-black/20 gap-2" style={lightMode ? { backgroundColor: zoneBBg } : undefined}>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => handleShare('whatsapp')}
            className={`p-1.5 rounded-full active:scale-95 ${lightMode ? 'bg-emerald-700/15 text-emerald-800 hover:bg-emerald-700/25' : 'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30'}`}
            title="WhatsApp"
          >
            <MessageSquare className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleShare('telegram')}
            className={`p-1.5 rounded-full active:scale-95 ${lightMode ? 'bg-blue-700/15 text-blue-800 hover:bg-blue-700/25' : 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30'}`}
            title="Telegram"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleShare('universal')}
            className={`p-1.5 rounded-full active:scale-95 ${lightMode ? 'bg-orange-700/15 text-orange-800 hover:bg-orange-700/25' : 'bg-orange-600/20 text-orange-400 hover:bg-orange-600/30'}`}
            title="Compartilhar"
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleShare('copy')}
            className={`p-1.5 rounded-full active:scale-95 ${lightMode ? 'bg-indigo-700/15 text-indigo-800 hover:bg-indigo-700/25' : 'bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30'}`}
            title="Copiar"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              playSynthSound('click');
              onScheduleNote(note);
            }}
            className={`p-1.5 rounded-full active:scale-95 ${lightMode ? 'bg-purple-700/15 text-purple-800 hover:bg-purple-700/25' : 'bg-purple-600/20 text-purple-400 hover:bg-purple-600/30'}`}
            title="Agendar como Reunião / Tarefa"
          >
            <Calendar className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="relative w-36 shrink-0">
          <CategoryField
            expand
            hideLabel
            kind="notas"
            value={category}
            onChange={(v) => {
              setCategory(v);
              onSave({ category: v });
            }}
            onToast={onShowToast}
            inputClassName="text-[11px] font-bold px-2 py-1.5 w-full"
          />
        </div>
      </div>
      {/* Editor Body Sheet — mesmo matiz da zona B (tom claro da cor selecionada) */}
      <div
        className={`flex-1 min-h-0 px-6 pt-3 pb-6 overflow-y-auto ${paperStyle}`}
        style={{
          backgroundColor: bodyBg,
          ...(lightTexture ? { backgroundImage: lightTexture, backgroundSize: lightTexSize } : {})
        }}
      >
        <div className="flex items-center gap-2 mb-1 text-[10px] opacity-60 select-none" style={{ color: zoneBFg }}>
          <Clock className="w-3 h-3" />
          <span>📅 {headerStamp.date} • {headerStamp.time}</span>
        </div>
        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Título da Nota"
          className="w-full bg-transparent border-none text-xl font-bold focus:outline-none mb-2 placeholder:text-current placeholder:opacity-40"
          style={{ color: zoneBFg }}
        />
        <div className="h-[1px] w-full mb-2" style={{ backgroundColor: lightMode ? lineOnPaper : 'rgba(255,255,255,0.1)' }} />
        {/* Checklist (REQ-47) — dentro da folha, sobre as linhas (mesmo fundo/papel) */}
        {showChecklist && (
        <div className="border-b border-jaspe-border pb-3 mb-3 space-y-1">
          <div className="text-[10px] font-bold uppercase" style={lightMode ? { color: zoneBFg, opacity: 0.75 } : undefined}>Checklist de tarefas (caixinha de marcar){checklist.length > 0 ? ` • ${checklist.length}` : ''}</div>
          <div className="space-y-1.5 max-h-[24vh] overflow-y-auto pr-1">
            {checklist.map((c) => (
              <div key={c.id} className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={c.done} onChange={() => persistChecklist(checklist.map((x) => (x.id === c.id ? { ...x, done: !x.done } : x)))} className="accent-emerald-500 w-4 h-4" />
                <span className={"flex-1 " + (c.done ? "line-through text-zinc-500" : "text-zinc-200")} style={!c.done && lightMode ? { color: zoneBFg } : undefined}>{c.text}</span>
                <button onClick={() => persistChecklist(checklist.filter((x) => x.id !== c.id))} className="text-zinc-500 hover:text-red-400 text-xs">×</button>
              </div>
            ))}
          </div>
          {isAddingCheck && (
            <div className="flex items-center gap-2 text-xs">
              <Square className="w-4 h-4 shrink-0 text-zinc-500" style={lightMode ? { color: zoneBFg, opacity: 0.6 } : undefined} aria-hidden />
              <input
                ref={checkInputRef}
                autoFocus
                value={newCheckText}
                onChange={(e) => setNewCheckText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newCheckText.trim()) {
                    persistChecklist([...checklist, { id: newUUID(), text: newCheckText.trim(), done: false }]);
                    setNewCheckText('');
                    setTimeout(() => { try { checkInputRef.current?.focus(); } catch {} }, 0);
                  } else if (e.key === 'Escape') {
                    setNewCheckText('');
                    setIsAddingCheck(false);
                  }
                }}
                onBlur={() => {
                  if (!newCheckText.trim()) setIsAddingCheck(false);
                }}
                aria-label="Novo item do checklist"
                style={lightMode ? { color: zoneBFg } : undefined}
                className="flex-1 bg-transparent border-none focus:outline-none text-xs text-zinc-200 placeholder-zinc-500 py-1"
              />
            </div>
          )}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              playSynthSound('click');
              if (isAddingCheck && newCheckText.trim()) {
                persistChecklist([...checklist, { id: newUUID(), text: newCheckText.trim(), done: false }]);
                setNewCheckText('');
              } else if (!isAddingCheck) {
                setNewCheckText('');
              }
              setIsAddingCheck(true);
              setTimeout(() => {
                try { checkInputRef.current?.focus({ preventScroll: true } as FocusOptions); } catch {}
              }, 60);
            }}
            className="flex items-center gap-2 text-xs py-1 text-zinc-500 hover:text-zinc-300 transition-colors active:scale-95"
            style={lightMode ? { color: zoneBFg, opacity: 0.6 } : undefined}
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>Adicionar item</span>
          </button>
        </div>
        )}
        <div
          ref={editorRef}
          contentEditable
          onInput={handleBodyInput}
          onBlur={handleBodyBlur}
          onPaste={handleBodyPaste}
          onKeyDown={(e) => {
            const mod = e.ctrlKey || e.metaKey;
            if (!mod) return;
            const k = e.key.toLowerCase();
            if (k === 'z' && !e.shiftKey) { e.preventDefault(); undoEdit(); }
            else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redoEdit(); }
          }}
          className="text-sm leading-relaxed min-h-[300px] focus:outline-none [&_ul]:my-1 [&_ol]:my-1 [&_ul]:pl-5 [&_ol]:pl-5 [&_li]:my-0"
          style={{ color: zoneBFg }}
        />
        <div className="flex items-center gap-1.5 text-[10px] opacity-60 select-none mt-8 pt-2" style={{ color: zoneBFg }}>
          <span className="text-xs">🔗</span>
          <span>Nenhum item vinculado</span>
        </div>
      </div>

      {/* Editor Footer — mesmo tom claro do corpo */}
      <div
        className="h-16 shrink-0 border-t border-black/10 px-4 flex items-center justify-between transition-colors duration-200"
        style={{ backgroundColor: lightMode ? bodyBg : '#1A1311', color: zoneBFg }}
      >
        <div className="flex items-center gap-3">
          {isConfirmingDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-red-600">Excluir esta nota?</span>
              <button
                onClick={handleDelete}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-all active:scale-95 shadow-sm"
              >
                Sim, Excluir
              </button>
              <button
                onClick={() => setIsConfirmingDelete(false)}
                className="px-2.5 py-1.5 bg-zinc-200 text-zinc-800 rounded-lg text-xs font-medium transition-all"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                playSynthSound('click');
                setIsConfirmingDelete(true);
              }}
              className="font-bold hover:underline flex items-center gap-1.5 active:scale-95 transition-all text-xs text-red-600 hover:text-red-700"
            >
              <Trash className="w-4 h-4" /> Excluir Nota
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex gap-3 text-[10px] opacity-60">
            <span>Palavras: <strong style={{ color: zoneBFg }}>{wordCount}</strong></span>
            <span>Carac: <strong style={{ color: zoneBFg }}>{charCount}</strong></span>
          </div>

          <button
            onClick={() => {
              playSynthSound('click');
              onClose();
              onShowToast('Nota salva com sucesso!');
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-extrabold text-xs text-white bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 active:scale-95 transition-all shadow-md shadow-orange-500/20"
          >
            <Check className="w-4 h-4 stroke-[3]" /> Concluir / Salvo ✓
          </button>
        </div>
      </div>
    </div>
  );
}
