import React, { useState, useEffect } from 'react';
import {
  Presentation,
  Table2,
  FileText,
  Play,
  Edit,
  FilePlus,
  Trash2,
  Unlink,
  Grid,
  Menu,
  LayoutGrid,
  AlignJustify
} from 'lucide-react';
import { OfficeDocument } from '../types';
import { playSynthSound } from '../utils/audio';

interface OfficeStudioViewProps {
  documents: OfficeDocument[];
  onOpenDoc: (doc: OfficeDocument) => void;
  onCreateDoc: () => void;
  onCreateDocWith?: (title: string, type: OfficeDocument['type']) => void;
  onDeleteDoc?: (id: number) => void;
  onUnlinkDoc?: (id: number) => void;
  // Painel de criação controlado pela store (o FAB abre a página já criando).
  isCreating: boolean;
  onOpenCreate: () => void;
  onCloseCreate: () => void;
}

type ViewMode = 'grid' | 'list' | 'compact' | 'detailed';

export default function OfficeStudioView({
  documents,
  onOpenDoc,
  onCreateDoc,
  onCreateDocWith,
  onDeleteDoc,
  onUnlinkDoc,
  isCreating,
  onOpenCreate,
  onCloseCreate
}: OfficeStudioViewProps) {
  const [newTitle, setNewTitle] = useState('');
  // Tipos eliminados do projeto: só DOCUMENTO. Filtro defensivo (o expurgo
  // definitivo acontece no load da store; aqui cobre qualquer resíduo).
  const docs = (Array.isArray(documents) ? documents : []).filter((d) => d && d.type === 'DOCUMENTO');
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      const v = localStorage.getItem('jaspe_office_view');
      if (v === 'grid' || v === 'list' || v === 'compact' || v === 'detailed' || v === 'kanban') return v as ViewMode;
    } catch {}
    return 'list';
  });

  useEffect(() => {
    try {
      localStorage.setItem('jaspe_office_view', viewMode);
    } catch {}
  }, [viewMode]);

  const getDocIcon = (iconName?: string) => {
    return iconName === 'presentation'
      ? Presentation
      : iconName === 'table-2'
      ? Table2
      : FileText;
  };

  const typeBadge = (type: OfficeDocument['type']) =>
    type === 'APRESENTAÇÃO'
      ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
      : type === 'PLANILHA'
      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
      : 'bg-blue-500/15 text-blue-300 border-blue-500/30';

  const previewOf = (doc: OfficeDocument) => {
    const lines = (doc.content || '').split('\n').map((l) => l.trim()).filter((l) => l && l !== '---');
    return lines.slice(0, 2).join(' • ') || 'Toque para abrir e editar';
  };

  const metaOf = (doc: OfficeDocument) => {
    const kb = (((doc.content || '').length + (doc.title || '').length) / 1024).toFixed(1);
    return `${doc.date || '—'}${doc.version ? ` • v${doc.version}` : ''} • ${kb} KB`;
  };

  return (
    <section className="p-4 space-y-4 text-left">
      <div className="flex items-center justify-between">
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

        <button
          onClick={() => {
            playSynthSound('click');
            if (onCreateDocWith) onOpenCreate();
            else onCreateDoc();
          }}
          className="py-2 px-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
        >
          <FilePlus className="w-4 h-4" /> Criar Novo
        </button>
      </div>

      {isCreating && (
        <div className="bg-jaspe-card border border-orange-500/30 p-4 rounded-2xl space-y-3 shadow-sm">
          <h4 className="text-xs font-bold text-zinc-200">Novo documento</h4>
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && onCreateDocWith) {
                onCreateDocWith(newTitle, 'DOCUMENTO');
                setNewTitle('');
                onCloseCreate();
              }
              if (e.key === 'Escape') onCloseCreate();
            }}
            autoFocus
            placeholder="Título (ex: Ata da reunião)"
            className="w-full bg-black/30 border border-white/10 p-2.5 rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-orange-500/50"
          />
          <div className="flex gap-2">
            <button
              onClick={() => onCloseCreate()}
              className="flex-1 py-2.5 bg-zinc-800 text-zinc-300 text-xs font-bold rounded-xl"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                onCreateDocWith?.(newTitle, 'DOCUMENTO');
                setNewTitle('');
                onCloseCreate();
              }}
              className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl shadow"
            >
              Criar e abrir
            </button>
          </div>
        </div>
      )}

      {docs.length === 0 ? (
        <div className="p-8 text-center bg-jaspe-card rounded-2xl border border-jaspe-border shadow-sm">
          <p className="text-xs text-zinc-500">Nenhum documento encontrado.</p>
        </div>
      ) : viewMode === 'grid' ? (
        /* Modo 1: Grade */
        <div className="grid grid-cols-2 gap-2.5">
          {docs.map((doc) => {
            const IconComp = getDocIcon(doc.iconName);
            return (
              <div
                key={doc.id}
                onClick={() => onOpenDoc(doc)}
                className="bg-jaspe-card border border-jaspe-border p-3.5 rounded-2xl flex flex-col justify-between space-y-2.5 shadow-sm hover:border-orange-500/40 transition-all cursor-pointer text-left active:scale-98"
              >
                <div>
                  <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-400 shrink-0">
                    <IconComp className="w-4 h-4" />
                  </div>
                  <h5 className="font-extrabold text-xs text-zinc-100 truncate mt-2">
                    {doc.title}
                  </h5>
                  <span className={`text-[8px] font-bold block mt-1 px-1.5 py-0.5 rounded border w-fit ${typeBadge(doc.type)}`}>
                    {doc.type}
                  </span>
                  <p className="text-[9px] text-zinc-400 truncate mt-1">{previewOf(doc)}</p>
                </div>
                <div className="flex items-center justify-between border-t border-white/5 pt-2 text-[8px] text-zinc-500">
                  <span>{doc.date || '—'}</span>
                  <span className="flex items-center gap-0.5">
                    <button onClick={(e) => { e.stopPropagation(); onUnlinkDoc?.(doc.id); }} className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-white/10 transition-all" title="Desvincular (preserva mídia)" aria-label="Desvincular">
                      <Unlink className="w-3 h-3" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onDeleteDoc?.(doc.id); }} className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all" title="Mover para lixeira" aria-label="Mover para lixeira">
                      <Trash2 className="w-3 h-3" />
                    </button>
                    <span className="text-orange-400 font-bold ml-0.5">Abrir →</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : viewMode === 'list' ? (
        /* Modo 2: Lista */
        <div className="space-y-2.5">
          {docs.map((doc) => {
            const IconComp = getDocIcon(doc.iconName);
            return (
              <div
                key={doc.id}
                onClick={() => onOpenDoc(doc)}
                className="bg-jaspe-card border border-jaspe-border p-3.5 rounded-2xl flex items-center justify-between hover:border-orange-500/30 transition-all cursor-pointer shadow-sm text-left active:scale-98"
              >
                <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-400 shrink-0">
                    <IconComp className="w-4 h-4" />
                  </div>
                  <div className="overflow-hidden min-w-0">
                    <h5 className="text-xs font-bold text-zinc-200 truncate">
                      {doc.title}
                    </h5>
                    <span className="text-[9px] text-zinc-400 block mt-0.5 truncate">
                      {doc.type} • {doc.date}
                    </span>
                    <p className="text-[9px] text-zinc-500 truncate mt-0.5">{previewOf(doc)}</p>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenDoc(doc);
                  }}
                  className="p-2 hover:bg-white/10 rounded-xl text-zinc-400 hover:text-zinc-100 transition-all active:scale-95 shrink-0 ml-2"
                  aria-label="Abrir Documento"
                >
                  {doc.type === 'APRESENTAÇÃO' ? (
                    <Play className="w-4 h-4" />
                  ) : (
                    <Edit className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteDoc?.(doc.id);
                  }}
                  className="p-2 hover:bg-red-500/10 rounded-xl text-zinc-500 hover:text-red-400 transition-all active:scale-95 shrink-0"
                  aria-label="Mover para lixeira"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      ) : viewMode === 'compact' ? (
        /* Modo 3: Bloco Compactado */
        <div className="grid grid-cols-2 gap-2">
          {docs.map((doc) => {
            const IconComp = getDocIcon(doc.iconName);
            return (
              <div
                key={doc.id}
                onClick={() => onOpenDoc(doc)}
                className="bg-jaspe-card border border-jaspe-border p-2.5 rounded-xl flex items-center justify-between shadow-sm hover:border-orange-500/30 transition-all cursor-pointer active:scale-98"
              >
                  <div className="overflow-hidden min-w-0 pr-1">
                    <div className="flex items-center gap-1.5">
                      <IconComp className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                      <h4 className="font-extrabold text-[11px] text-zinc-100 truncate">
                        {doc.title}
                      </h4>
                    </div>
                    <span className={`text-[8px] font-bold block truncate mt-1 px-1 py-0.5 rounded border w-fit ${typeBadge(doc.type)}`}>
                      {doc.type}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteDoc?.(doc.id);
                    }}
                    className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0"
                    aria-label="Mover para lixeira"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
              </div>
            );
          })}
        </div>
      ) : (
        /* Modo 4: Detalhado */
        <div className="space-y-3">
          {docs.map((doc) => {
            const IconComp = getDocIcon(doc.iconName);
            return (
              <div
                key={doc.id}
                onClick={() => onOpenDoc(doc)}
                className="bg-jaspe-card border border-jaspe-border p-4 rounded-2xl space-y-3 shadow-sm hover:border-orange-500/30 transition-all cursor-pointer text-left"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-11 h-11 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-400 shrink-0">
                      <IconComp className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-extrabold text-sm text-zinc-100 truncate">
                        {doc.title}
                      </h4>
                      <span className={`text-[9px] font-bold block mt-1 px-2 py-0.5 rounded-full border w-fit ${typeBadge(doc.type)}`}>
                        {doc.type}
                      </span>
                      <p className="text-[10px] text-zinc-400 mt-1.5 line-clamp-2 leading-relaxed">{previewOf(doc)}</p>
                    </div>
                  </div>
                  <span className="text-[9px] bg-orange-500/15 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-full font-bold uppercase shrink-0">
                    Ativo
                  </span>
                </div>

                <div className="bg-black/30 p-2.5 rounded-xl border border-white/5 flex items-center justify-between text-[10px] text-zinc-400">
                  <span>Ficha: {metaOf(doc)}</span>
                  <span className="text-orange-400 font-bold hover:underline flex items-center gap-1">
                    {doc.type === 'APRESENTAÇÃO' ? <Play className="w-3 h-3" /> : <Edit className="w-3 h-3" />}
                    Abrir Documento →
                  </span>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); onUnlinkDoc?.(doc.id); }}
                    className="flex-1 py-1.5 text-[10px] font-bold rounded-lg bg-white/5 text-zinc-300 hover:bg-white/10 border border-white/10"
                    title="REQ-41: remove vínculo sem apagar mídia"
                  >
                    Desvincular (preserva mídia)
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteDoc?.(doc.id); }}
                    className="flex-1 py-1.5 text-[10px] font-bold rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20"
                    title="Move p/ lixeira 30 dias"
                  >
                    Lixeira 30d
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
