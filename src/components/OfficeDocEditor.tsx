import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowLeft,
  Play,
  X,
  Trash,
  Copy,
  Save,
  ChevronLeft,
  ChevronRight,
  FileText,
  Table2,
  Presentation,
  Pencil,
  Eye
} from 'lucide-react';
import { OfficeDocument } from '../types';
import { playSynthSound } from '../utils/audio';
import { copyTextSafe } from '../utils/share';

interface OfficeDocEditorProps {
  doc: OfficeDocument;
  onSave: (updated: Partial<OfficeDocument>) => void;
  onClose: () => void;
  onDelete: (id: number) => void;
  onShowToast: (msg: string) => void;
  // Recém-criado (FAB/painel) abre já em edição; existente abre em leitura.
  startEditing?: boolean;
}

function iconFor(type: OfficeDocument['type']): OfficeDocument['iconName'] {
  return type === 'APRESENTAÇÃO' ? 'presentation' : type === 'PLANILHA' ? 'table-2' : 'file-text';
}

function TypeIcon({ type, className }: { type: OfficeDocument['type']; className?: string }) {
  if (type === 'APRESENTAÇÃO') return <Presentation className={className} />;
  if (type === 'PLANILHA') return <Table2 className={className} />;
  return <FileText className={className} />;
}

const MAX_COLS = 12;
const MAX_ROWS = 80;
const CELL_DELIM = '\t';

function parseSheet(text: string): string[][] {
  const rows = (text || '').split('\n').map((l) => {
    const delim = l.includes('\t') ? '\t' : ';';
    return l.split(delim).map((c) => c.trim());
  });
  const nonEmpty = rows.filter((r) => r.some((c) => c !== ''));
  const base = nonEmpty.length > 0 ? nonEmpty : [['Categoria', 'Valor']];
  let cols = 1;
  base.forEach((r) => { if (r.length > cols) cols = r.length; });
  return base.map((r) => r.concat(Array(Math.max(0, cols - r.length)).fill('')));
}

function serializeSheet(rows: string[][]): string {
  return rows.map((r) => r.join(CELL_DELIM)).join('\n');
}

function colLetter(i: number): string {
  let s = '';
  let n = i;
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

function SheetEditor({ initial, onChange, onToast }: { initial: string; onChange: (text: string) => void; onToast: (msg: string) => void }) {
  const [rows, setRows] = useState<string[][]>(() => parseSheet(initial));
  const cols = rows.length > 0 ? rows[0].length : 0;

  const commit = (r: string[][]) => {
    setRows(r);
    onChange(serializeSheet(r));
  };

  const setCell = (ri: number, ci: number, v: string) => {
    commit(rows.map((r, i) => (i === ri ? r.map((c, j) => (j === ci ? v : c)) : r)));
  };

  const addRow = () => {
    if (rows.length >= MAX_ROWS) { onToast('Limite de 80 linhas.'); return; }
    playSynthSound('click');
    const width = rows.length > 0 ? rows[0].length : 2;
    commit(rows.concat([Array(width).fill('')]));
  };

  const addCol = () => {
    if (cols >= MAX_COLS) { onToast('Limite de 12 colunas.'); return; }
    playSynthSound('click');
    commit(rows.map((r) => r.concat([''])));
  };

  const delRow = (ri: number) => {
    if (rows.length <= 1) { onToast('A planilha precisa de ao menos 1 linha.'); return; }
    playSynthSound('click');
    commit(rows.filter((_, i) => i !== ri));
  };

  const delCol = (ci: number) => {
    if (cols <= 1) { onToast('A planilha precisa de ao menos 1 coluna.'); return; }
    playSynthSound('click');
    commit(rows.map((r) => r.filter((_, j) => j !== ci)));
  };

  return (
    <div className="space-y-2">
      <div className="rounded-2xl border border-white/10 overflow-hidden">
        <div className="overflow-auto max-h-[320px]" style={{ WebkitOverflowScrolling: 'touch' }}>
          <table className="border-collapse">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="bg-black/60 p-1 w-8 min-w-[32px]"></th>
                {rows.length > 0 && rows[0].map((_, ci) => (
                  <th key={ci} className="bg-black/60 p-1 min-w-[104px]">
                    <span className="flex items-center justify-between gap-1 px-1">
                      <span className="text-[9px] font-black text-orange-400">{colLetter(ci)}</span>
                      <button onClick={() => delCol(ci)} className="text-[10px] text-zinc-500 hover:text-red-400 font-bold px-1" title={'Excluir coluna ' + colLetter(ci)} aria-label={'Excluir coluna ' + colLetter(ci)}>×</button>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri}>
                  <td className="bg-black/60 p-1 text-center">
                    <span className="block text-[9px] font-bold text-zinc-500">{ri + 1}</span>
                    <button onClick={() => delRow(ri)} className="text-[10px] text-zinc-500 hover:text-red-400 font-bold" title={'Excluir linha ' + (ri + 1)} aria-label={'Excluir linha ' + (ri + 1)}>×</button>
                  </td>
                  {row.map((cell, ci) => (
                    <td key={ci} className="p-0.5 border-t border-white/5">
                      <input
                        value={cell}
                        onChange={(e) => setCell(ri, ci, e.target.value)}
                        placeholder={ri === 0 ? 'Cabeçalho' : '—'}
                        className={'w-full min-w-[96px] px-2 py-2 rounded-lg text-[11px] focus:outline-none focus:border-orange-500/60 border border-transparent ' + (ri === 0 ? 'bg-orange-600/15 font-extrabold text-orange-200 placeholder-orange-300/40' : 'bg-black/40 text-zinc-100 placeholder-zinc-700')}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={addRow} className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-zinc-100 text-[11px] font-bold active:scale-95 transition-all">＋ Linha</button>
        <button onClick={addCol} className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-zinc-100 text-[11px] font-bold active:scale-95 transition-all">＋ Coluna</button>
      </div>
      <p className="text-[9px] text-zinc-500">Primeira linha = cabeçalho laranja. × apaga linha/coluna. Tudo salva sozinho.</p>
    </div>
  );
}

export default function OfficeDocEditor({
  doc,
  onSave,
  onClose,
  onDelete,
  onShowToast,
  startEditing = false
}: OfficeDocEditorProps) {
  // Todos os hooks antes de qualquer early return
  const [viewing, setViewing] = useState(true); // leitura por padrão; lápis edita
  // Aplica o "já editando" uma única vez por montagem (o effect abaixo roda
  // também no mount e resetaria para leitura sem este guarda).
  const startEditApplied = useRef(false);
  const [title, setTitle] = useState(doc?.title || '');
  const [docType, setDocType] = useState<OfficeDocument['type']>(doc?.type || 'DOCUMENTO');
  const [content, setContent] = useState(doc?.content || '');
  const [isPresenting, setIsPresenting] = useState(false);
  const [slideIdx, setSlideIdx] = useState(0);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  useEffect(() => {
    setViewing(true);
    if (startEditing && !startEditApplied.current) {
      startEditApplied.current = true;
      setViewing(false);
    }
    setTitle(doc?.title || '');
    setDocType(doc?.type || 'DOCUMENTO');
    setContent(doc?.content || '');
    setSlideIdx(0);
    setIsPresenting(false);
    setIsConfirmingDelete(false);
  }, [doc?.id]);

  const slides = docType === 'APRESENTAÇÃO'
    ? content.split(/\n\s*---\s*\n/).map((s) => s.trim()).filter(Boolean)
    : [];

  const tableRows = docType === 'PLANILHA'
    ? content.split('\n').map((l) => l.split(';').map((c) => c.trim())).filter((r) => r.some((c) => c !== ''))
    : [];

  const paragraphs = docType === 'DOCUMENTO'
    ? content.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
    : [];

  const closePresent = useCallback(() => setIsPresenting(false), []);

  // Teclado no player: ESC sai, setas navegam
  useEffect(() => {
    if (!isPresenting) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePresent();
      if (e.key === 'ArrowRight') setSlideIdx((i) => Math.min(slides.length - 1, i + 1));
      if (e.key === 'ArrowLeft') setSlideIdx((i) => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isPresenting, slides.length, closePresent]);

  if (!doc) return null;

  const persist = (patch: Partial<OfficeDocument>) => {
    onSave(patch);
  };

  const openPresent = (at = 0) => {
    playSynthSound('click');
    if (slides.length === 0) {
      onShowToast('Sem slides. No modo edição, separe blocos com linha ---');
      return;
    }
    setSlideIdx(Math.min(Math.max(0, at), slides.length - 1));
    setIsPresenting(true);
  };

  const handleCopy = async () => {
    playSynthSound('click');
    const ok = await copyTextSafe(`${title}\n\n${content}`);
    onShowToast(ok ? 'Documento copiado.' : 'Falha ao copiar.');
  };

  const handleDelete = () => {
    playSynthSound('click');
    onDelete(doc.id);
    onClose();
    onShowToast('Documento movido p/ lixeira (30 dias).');
  };

  const words = content.trim() === '' ? 0 : content.trim().split(/\s+/).length;
  const sizeKb = ((content.length + title.length) / 1024).toFixed(1);

  return (
    <div className="absolute inset-0 bg-jaspe-bg z-30 flex flex-col text-left">
      {/* Topo: voltar + tipo + ver/editar + apresentar */}
      <div className="min-h-14 border-b border-jaspe-border flex items-center justify-between gap-2 px-3 py-2 bg-black/30">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-zinc-100 text-xs font-bold active:scale-95 transition-all shrink-0"
          aria-label="Voltar para a biblioteca"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <span className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/30 truncate max-w-[110px]">
          <TypeIcon type={docType} className="w-3 h-3 shrink-0" />
          <span className="truncate">{docType}</span>
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => {
              playSynthSound('click');
              setViewing((v) => !v);
            }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold active:scale-95 transition-all ${
              viewing ? 'bg-white/10 hover:bg-white/15 text-zinc-200' : 'bg-orange-600 text-white'
            }`}
            title={viewing ? 'Editar conteúdo' : 'Ver leitura'}
            aria-label={viewing ? 'Editar' : 'Ver leitura'}
          >
            {viewing ? <Pencil className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {viewing ? 'Editar' : 'Ver'}
          </button>
          {viewing && docType === 'APRESENTAÇÃO' && slides.length > 0 && (
            <button
              onClick={() => openPresent(0)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold active:scale-95 transition-all shadow"
              aria-label="Apresentar do início"
            >
              <Play className="w-4 h-4" /> Apresentar
            </button>
          )}
          <button
            onClick={handleCopy}
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-zinc-200 active:scale-95 transition-all"
            title="Copiar"
            aria-label="Copiar"
          >
            <Copy className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Título sempre visível */}
      <div className="px-4 pt-3">
        {viewing ? (
          <h2 className="text-lg font-extrabold text-zinc-100 leading-snug">{title || 'Sem título'}</h2>
        ) : (
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              persist({ title: e.target.value });
            }}
            placeholder="Título do documento"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-base font-bold focus:outline-none focus:border-orange-500/60 text-zinc-100 placeholder-zinc-600"
          />
        )}
      </div>

      {/* ===== MODO LEITURA ===== */}
      {viewing && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* APRESENTAÇÃO: quadrinhos de slide com play no meio */}
          {docType === 'APRESENTAÇÃO' && (
            <>
              {slides.length === 0 ? (
                <div className="p-6 text-center rounded-2xl border border-dashed border-white/15 text-xs text-zinc-400">
                  Nenhum slide ainda. Toque em <strong>Editar</strong> e escreva blocos separados por linha com <strong>---</strong>
                </div>
              ) : (
                slides.map((s, i) => {
                  const lines = s.split('\n').filter((l) => l.trim() !== '');
                  const head = lines[0] || `Slide ${i + 1}`;
                  const rest = lines.slice(1, 3).join(' • ');
                  return (
                    <button
                      key={i}
                      onClick={() => openPresent(i)}
                      className="w-full flex items-stretch gap-3 p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-orange-500/50 transition-all active:scale-[0.98] text-left"
                    >
                      {/* Quadrinho do slide com play */}
                      <span className="relative w-20 h-16 rounded-xl bg-gradient-to-br from-[#0F172A] to-[#3a2418] border border-orange-500/40 flex items-center justify-center shrink-0 overflow-hidden">
                        <span className="absolute top-1 left-1.5 text-[8px] font-black text-orange-400">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <span className="w-9 h-9 rounded-full bg-orange-600 flex items-center justify-center shadow-lg">
                          <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                        </span>
                      </span>
                      <span className="flex-1 min-w-0 py-0.5">
                        <strong className="block text-xs font-extrabold text-zinc-100 truncate">{head}</strong>
                        {rest ? (
                          <span className="block text-[10px] text-zinc-400 truncate mt-1">{rest}</span>
                        ) : (
                          <span className="block text-[10px] text-orange-400/80 font-bold mt-1">Toque para apresentar ▶</span>
                        )}
                        <span className="block text-[9px] text-zinc-500 mt-1">Slide {i + 1} de {slides.length}</span>
                      </span>
                    </button>
                  );
                })
              )}
            </>
          )}

          {/* PLANILHA: tabela de verdade */}
          {docType === 'PLANILHA' && (
            <>
              {tableRows.length === 0 ? (
                <div className="p-6 text-center rounded-2xl border border-dashed border-white/15 text-xs text-zinc-400">
                  Planilha vazia. Toque em <strong>Editar</strong> e digite linhas como <strong>Categoria;Previsto;Realizado</strong>
                </div>
              ) : (
                <div className="rounded-2xl border border-white/10 overflow-hidden">
                  <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
                    <table className="w-max min-w-full text-[11px] border-collapse bg-white/[0.03]">
                      <thead>
                        <tr className="bg-orange-600">
                          {tableRows[0].map((cell, ci) => (
                            <th key={ci} className={`px-3 py-2.5 text-left font-extrabold text-white uppercase tracking-wide whitespace-nowrap border-r border-white/20 last:border-r-0 ${ci === 0 ? 'sticky left-0 z-10 bg-orange-700 shadow-[2px_0_6px_rgba(0,0,0,0.35)]' : ''}`}>
                              {cell || '—'}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {tableRows.slice(1).map((row, ri) => (
                          <tr key={ri} className={ri % 2 === 0 ? 'bg-white/[0.02]' : 'bg-transparent'}>
                            {tableRows[0].map((_, ci) => (
                              <td key={ci} className={`px-3 py-2 text-zinc-200 border-t border-white/5 whitespace-nowrap ${ci === 0 ? 'sticky left-0 z-10 bg-[#1A1311] font-bold shadow-[2px_0_6px_rgba(0,0,0,0.35)]' : ''}`}>
                                {row[ci] || <span className="text-zinc-600">—</span>}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-3 py-2 bg-black/30 text-[9px] text-zinc-500 font-semibold flex items-center justify-between gap-2">
                    <span>{tableRows.length - 1} linha(s) • {tableRows[0].length} coluna(s)</span>
                    {tableRows[0].length > 2 && <span className="text-orange-400/90 font-bold">◀ deslize p/ ver tudo ▶</span>}
                  </div>
                </div>
              )}
            </>
          )}

          {/* DOCUMENTO: folha de papel */}
          {docType === 'DOCUMENTO' && (
            <article className="bg-[#F5EFE6] rounded-2xl p-5 shadow-xl border border-black/20">
              {paragraphs.length === 0 ? (
                <p className="text-xs text-neutral-500 italic">Documento vazio. Toque em Editar para escrever.</p>
              ) : (
                paragraphs.map((p, i) => (
                  <p key={i} className={`text-neutral-900 leading-relaxed mb-3 last:mb-0 ${i === 0 && p.length < 60 ? 'text-base font-extrabold tracking-tight' : 'text-[13px]'}`}>
                    {p}
                  </p>
                ))
              )}
            </article>
          )}

          {/* Ficha (REQ-43) */}
          <div className="flex flex-wrap gap-x-3 gap-y-1 px-1 text-[9px] text-zinc-500">
            <span>Modificado: <strong className="text-zinc-300">{doc.date || '—'}</strong></span>
            {doc.version ? <span>Versão: <strong className="text-zinc-300">v{doc.version}</strong></span> : null}
            <span>Tamanho: <strong className="text-zinc-300">{sizeKb} KB</strong></span>
            <span>Palavras: <strong className="text-zinc-300">{words}</strong></span>
          </div>
        </div>
      )}

      {/* ===== MODO EDIÇÃO ===== */}
      {!viewing && (
        <>
          <div className="px-4 py-2.5 space-y-2 border-b border-jaspe-border bg-black/10">
            <div className="flex items-center gap-1.5 text-[10px]">
              {(['APRESENTAÇÃO', 'PLANILHA', 'DOCUMENTO'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    playSynthSound('click');
                    setDocType(t);
                    persist({ type: t, iconName: iconFor(t) });
                  }}
                  className={`flex-1 px-1 py-1.5 rounded-lg border font-bold transition-all active:scale-95 truncate ${
                    docType === t
                      ? 'bg-orange-600 text-white border-orange-600'
                      : 'bg-white/5 text-zinc-300 border-white/10 hover:bg-white/10'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <p className="text-[9px] text-zinc-500">
              {docType === 'PLANILHA'
                ? 'Toque numa célula para digitar. Botões ＋ adicionam linhas e colunas.'
                : docType === 'APRESENTAÇÃO'
                ? 'Um bloco por slide, separados por linha com ---'
                : 'Parágrafo em branco separa blocos do texto.'}
            </p>
          </div>
          <div className="flex-1 p-3 overflow-y-auto">
            {docType === 'PLANILHA' ? (
              <SheetEditor
                key={doc.id}
                initial={content}
                onToast={onShowToast}
                onChange={(text) => {
                  setContent(text);
                  persist({ content: text });
                }}
              />
            ) : (
              <textarea
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  persist({ content: e.target.value });
                }}
                placeholder={
                  docType === 'APRESENTAÇÃO'
                    ? 'Título do slide 1\n---\nConteúdo do slide 2'
                    : 'Escreva o documento...'
                }
                className="w-full h-full min-h-[280px] p-4 rounded-2xl bg-black/40 border border-white/10 resize-none focus:outline-none focus:border-orange-500/60 text-sm leading-relaxed text-zinc-100 placeholder-zinc-600"
              />
            )}
          </div>
        </>
      )}

      {/* Rodapé */}
      <div className="min-h-14 border-t border-jaspe-border px-4 py-2 flex items-center justify-between gap-2 bg-black/30 text-[10px] text-zinc-500">
        <span className="flex items-center gap-1.5">
          <Save className="w-3.5 h-3.5 text-emerald-400" /> Salvo automático
        </span>
        {isConfirmingDelete ? (
          <div className="flex items-center gap-2">
            <span className="text-red-400 font-bold">Excluir?</span>
            <button
              onClick={handleDelete}
              className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold"
            >
              Sim, excluir
            </button>
            <button
              onClick={() => setIsConfirmingDelete(false)}
              className="px-3 py-1.5 bg-zinc-800 text-zinc-300 rounded-lg text-xs"
            >
              Não
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              playSynthSound('click');
              setIsConfirmingDelete(true);
            }}
            className="text-red-500 font-bold hover:underline flex items-center gap-1 text-xs px-2 py-1"
          >
            <Trash className="w-3.5 h-3.5" /> Excluir
          </button>
        )}
      </div>

      {/* Player offline (REQ-42) — SAIR + ESC + Encerrar */}
      {isPresenting && (
        <div className="absolute inset-0 z-50 flex flex-col bg-gradient-to-b from-[#0F172A] via-[#1A1311] to-black">
          <div className="flex items-center justify-between gap-2 px-3 h-14 border-b border-white/15 bg-black/50 shrink-0">
            <span className="text-[11px] text-zinc-200 font-bold bg-white/10 px-2.5 py-1.5 rounded-lg">
              Slide {slideIdx + 1} / {slides.length}
            </span>
            <span className="text-[10px] text-zinc-400 font-semibold truncate flex-1 text-center px-1">
              {title || 'Apresentação'}
            </span>
            <button
              onClick={closePresent}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-extrabold active:scale-95 transition-all shadow-lg shrink-0"
              aria-label="Sair da apresentação"
            >
              <X className="w-4 h-4" /> SAIR
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col justify-center">
            <div
              key={slideIdx}
              className="bg-[#F5EFE6] text-neutral-900 rounded-3xl p-6 shadow-2xl border-4 border-orange-500/40 min-h-[220px] flex items-center justify-center"
            >
              <p className="text-lg font-bold whitespace-pre-wrap text-center leading-relaxed w-full">
                {slides[slideIdx]}
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-4 flex-wrap">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setSlideIdx(i)}
                  aria-label={`Ir para slide ${i + 1}`}
                  className={`h-2.5 rounded-full transition-all ${
                    i === slideIdx ? 'w-7 bg-orange-500' : 'w-2.5 bg-white/25 hover:bg-white/50'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 px-4 pb-6 pt-2 shrink-0">
            <button
              onClick={() => setSlideIdx((i) => Math.max(0, i - 1))}
              disabled={slideIdx === 0}
              className="flex-1 py-3.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white text-sm font-bold disabled:opacity-30 flex items-center justify-center gap-1 active:scale-95 transition-all"
            >
              <ChevronLeft className="w-5 h-5" /> Anterior
            </button>
            {slideIdx >= slides.length - 1 ? (
              <button
                onClick={closePresent}
                className="flex-1 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold flex items-center justify-center gap-1 active:scale-95 transition-all"
              >
                <X className="w-5 h-5" /> Encerrar
              </button>
            ) : (
              <button
                onClick={() => setSlideIdx((i) => Math.min(slides.length - 1, i + 1))}
                className="flex-1 py-3.5 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white text-sm font-bold flex items-center justify-center gap-1 active:scale-95 transition-all"
              >
                Próximo <ChevronRight className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
