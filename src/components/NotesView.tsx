import React, { useState, useEffect } from 'react';
import {
  Folder,
  ChevronDown,
  Grid,
  Menu,
  Grid3X3,
  Layers,
  Plus,
  Pin,
  X,
  PlusCircle,
  Trash2,
  Check
} from 'lucide-react';
import { Note } from '../types';
import { playSynthSound } from '../utils/audio';
import { getNoteTheme } from '../utils/noteColors';

interface NotesViewProps {
  notes: Note[];
  onOpenEditor: (noteId: number) => void;
  onCreateNewNote: (folder?: string) => void;
  onTogglePin: (noteId: number) => void;
  onShowToast: (msg: string) => void;
  onMigrateCategory?: (from: string, to: string) => void;
}

export default function NotesView({
  notes,
  onOpenEditor,
  onCreateNewNote,
  onTogglePin,
  onShowToast,
  onMigrateCategory
}: NotesViewProps) {
  const [activeFolder, setActiveFolder] = useState<string>('Todas');
  const [isCategoryDrawerOpen, setIsCategoryDrawerOpen] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'compact' | 'detailed'>(() => {
    try {
      const saved = localStorage.getItem('jaspe_notes_view');
      if (saved === 'grid' || saved === 'list' || saved === 'compact' || saved === 'detailed') {
        return saved;
      }
    } catch {
      // fallback
    }
    return 'grid';
  });

  const handleSetViewMode = (mode: 'grid' | 'list' | 'compact' | 'detailed') => {
    playSynthSound('click');
    setViewMode(mode);
    try {
      localStorage.setItem('jaspe_notes_view', mode);
    } catch (e) {
      console.warn('Erro ao salvar viewMode', e);
    }
  };

  // Categorias dinâmicas com persistência local
  const [categories, setCategories] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('jaspe_note_categories');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.includes('Todas') ? parsed : ['Todas', ...parsed];
        }
      }
    } catch {
      // fallback
    }
    return ['Todas', 'Trabalho', 'Pessoal', 'Ideias'];
  });

  // Estado para criar nova categoria inline
  const [isCreatingCategory, setIsCreatingCategory] = useState<boolean>(false);
  const [newCategoryName, setNewCategoryName] = useState<string>('');

  useEffect(() => {
    try {
      localStorage.setItem('jaspe_note_categories', JSON.stringify(categories));
    } catch (e) {
      console.warn('Erro ao salvar categorias no localStorage', e);
    }
  }, [categories]);

  const safeNotes = Array.isArray(notes) ? notes : [];
  const filteredNotes = safeNotes
    .filter((n) => n && (activeFolder === 'Todas' || n.category === activeFolder))
    .sort((a, b) => (a.pinned === b.pinned ? 0 : a.pinned ? -1 : 1));

  // Card assume a cor da nota (pastel); escuro mantém o tema do Jaspe
  const isLightCard = (n: Note | null | undefined) => {
    if (!n?.color) return false;
    const theme = getNoteTheme(n.color);
    return !theme.isDark;
  };
  const cardBg = (n: Note | null | undefined) => {
    if (!n?.color) return undefined;
    const theme = getNoteTheme(n.color);
    return theme.isDark ? undefined : theme.bodyBg;
  };
  const cardBorder = (n: Note | null | undefined) => {
    if (!n?.color) return undefined;
    const theme = getNoteTheme(n.color);
    return theme.isDark ? undefined : theme.border;
  };
  const cardAccent = (n: Note | null | undefined) => {
    if (!n?.color) return undefined;
    const theme = getNoteTheme(n.color);
    return theme.isDark ? undefined : theme.headerBg;
  };

  const handleSelectFolder = (cat: string) => {
    playSynthSound('click');
    setActiveFolder(cat);
    setIsCategoryDrawerOpen(false);
  };

  const handleConfirmCreateCategory = () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) {
      setIsCreatingCategory(false);
      return;
    }
    const dup = categories.find((c) => c.toLowerCase() === trimmed.toLowerCase());
    if (dup) {
      setActiveFolder(dup);
      setNewCategoryName('');
      setIsCreatingCategory(false);
      return;
    }
    playSynthSound('success');
    const updated = [...categories, trimmed];
    setCategories(updated);
    setActiveFolder(trimmed);
    setNewCategoryName('');
    setIsCreatingCategory(false);
  };

  const handleDeleteCategory = (catToDelete: string) => {
    playSynthSound('click');
    if (catToDelete === 'Todas') return;

    const affected = safeNotes.filter((n) => n && n.category === catToDelete).length;
    const updated = categories.filter((c) => c !== catToDelete);
    setCategories(updated);
    if (activeFolder === catToDelete) {
      setActiveFolder('Todas');
    }
    // Migra notas órfãs p/ Trabalho (sem ressurreição ao recriar a categoria)
    if (affected > 0 && onMigrateCategory) onMigrateCategory(catToDelete, 'Trabalho');
    onShowToast(affected > 0 ? `Categoria excluída. ${affected} nota(s) movidas para Trabalho.` : 'Categoria excluída.');
  };

  return (
    <section className="p-4 space-y-4 text-left">
      <div className="flex items-center justify-between gap-2">
        {/* Botão Filtro de Pastas */}
        <button
          onClick={() => {
            playSynthSound('click');
            setIsCategoryDrawerOpen(true);
          }}
          className="flex items-center gap-2 bg-jaspe-card border border-jaspe-border px-3 py-2 rounded-xl text-xs text-zinc-200 active:scale-95 transition-all shadow-sm"
        >
          <Folder className="w-4 h-4 text-orange-500 shrink-0" />
          <span className="font-semibold">{activeFolder === 'Todas' ? 'Todas as Notas' : activeFolder}</span>
          <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded-full font-bold text-orange-400">
            {filteredNotes.length}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
        </button>

        {/* Nova anotação — fixa no topo, entre filtro e visualizações */}
        <button
          onClick={() => {
            playSynthSound('click');
            onCreateNewNote(activeFolder === 'Todas' ? 'Trabalho' : activeFolder);
          }}
          className="flex items-center gap-1 bg-orange-600 hover:bg-orange-700 text-white px-2.5 py-2 rounded-xl text-xs font-bold shadow-md active:scale-95 transition-all shrink-0"
          title="Nova anotação"
        >
          <Plus className="w-4 h-4" /> Nova
        </button>

        {/* Layout Toggle - 4 Modos de Visualização */}
        <div className="flex bg-jaspe-card border border-jaspe-border p-1 rounded-xl shadow-sm gap-0.5">
          <button
            onClick={() => handleSetViewMode('grid')}
            className={`p-1.5 rounded-lg transition-all ${
              viewMode === 'grid'
                ? 'bg-orange-600 text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title="Modo Grade (2 Colunas)"
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
            title="Modo Detalhado / Completo (Texto Integral)"
            aria-label="Detalhado"
          >
            <Layers className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Galeria de Cards - 4 Modos de Visualização */}
      {filteredNotes.length === 0 ? (
        <div className="p-8 text-center bg-jaspe-card rounded-2xl border border-jaspe-border shadow-sm">
          <p className="text-xs text-zinc-500">Nenhuma anotação nesta categoria.</p>
        </div>
      ) : (
        <>
          {/* MODO 1: DETALHADO / COMPLETO (Texto integral expandido) */}
          {viewMode === 'detailed' && (
            <div className="space-y-3 flex flex-col">
              {filteredNotes.map((note) => {
                const glowClass =
                  note.category === 'Trabalho'
                    ? 'glow-trab'
                    : note.category === 'Pessoal'
                    ? 'glow-pess'
                    : 'glow-ideia';

                return (
                  <div
                    key={note.id}
                    onClick={() => {
                      playSynthSound('click');
                      onOpenEditor(note.id);
                    }}
                    className={`p-4 rounded-2xl border relative cursor-pointer active:scale-98 transition-all duration-200 shadow-sm hover:border-orange-500/40 text-left space-y-3 ${isLightCard(note) ? '' : 'bg-jaspe-card'} ${glowClass}`}
                    style={{
                      backgroundColor: cardBg(note),
                      borderColor: cardBorder(note),
                      borderLeft:
                        cardAccent(note)
                          ? `4px solid ${cardAccent(note)}`
                          : undefined
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Folder className="w-4 h-4 text-orange-500 shrink-0" />
                        <h4 className={`font-black text-sm truncate ${isLightCard(note) ? 'text-neutral-900' : 'text-zinc-100'}`}>
                          {note.title || 'Sem Título'}
                        </h4>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`border px-2 py-0.5 rounded-md font-bold uppercase text-[9px] tracking-wider ${isLightCard(note) ? 'bg-orange-700/10 text-orange-800 border-orange-700/30' : 'bg-orange-500/10 text-orange-400 border-orange-500/20'}`}>
                          {note.category}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onTogglePin(note.id);
                          }}
                          className="p-1 text-zinc-500 hover:text-amber-400 shrink-0"
                          aria-label="Fixar anotação"
                        >
                          <Pin
                            className={`w-3.5 h-3.5 ${
                              note.pinned
                                ? 'text-amber-400 fill-amber-400'
                                : 'text-zinc-500'
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Conteúdo Completo / Integral */}
                    <div className={`text-xs leading-relaxed font-sans whitespace-pre-line p-3 rounded-xl border ${isLightCard(note) ? 'text-neutral-700 bg-black/5 border-black/10' : 'text-zinc-300 bg-black/15 border-white/5'}`}>
                      {note.body
                        ? note.body.replace(/<[^>]*>/g, '')
                        : 'Sem conteúdo...'}
                    </div>

                    <div className={`flex items-center justify-between text-[9px] pt-1 border-t ${isLightCard(note) ? 'text-neutral-600 border-black/10' : 'text-zinc-500 border-white/5'}`}>
                      <span>Atualizado em: <strong className={isLightCard(note) ? 'text-neutral-800' : 'text-zinc-400'}>{note.date}</strong></span>
                      <span className="text-orange-400 font-bold hover:underline">Abrir editor →</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* MODO 2: BLOCO COMPACTADO (Mini-Cards em grade densa) */}
          {viewMode === 'compact' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {filteredNotes.map((note) => (
                <div
                  key={note.id}
                  onClick={() => {
                    playSynthSound('click');
                    onOpenEditor(note.id);
                  }}
                  className="p-2.5 rounded-xl border bg-jaspe-card relative cursor-pointer active:scale-98 transition-all flex flex-col justify-between shadow-sm hover:border-orange-500/40 text-left min-h-[85px]"
                  style={{
                    backgroundColor: cardBg(note),
                    borderLeft:
                      cardAccent(note)
                        ? `3px solid ${cardAccent(note)}`
                        : undefined
                  }}
                >
                  <div>
                    <div className="flex items-start justify-between gap-1">
                      <h5 className={`font-extrabold text-[11px] truncate flex-1 ${isLightCard(note) ? 'text-neutral-900' : 'text-zinc-100'}`}>
                        {note.title || 'Sem Título'}
                      </h5>
                      {note.pinned && (
                        <Pin className="w-2.5 h-2.5 text-amber-400 fill-amber-400 shrink-0" />
                      )}
                    </div>
                    <span className={`text-[8px] px-1 py-0.2 rounded font-bold uppercase tracking-wider inline-block mt-1 ${isLightCard(note) ? 'bg-orange-700/10 text-orange-800' : 'bg-orange-500/10 text-orange-400'}`}>
                      {note.category}
                    </span>
                  </div>

                  <span className={`text-[8px] mt-2 block ${isLightCard(note) ? 'text-neutral-600' : 'text-zinc-500'}`}>{note.date}</span>
                </div>
              ))}
            </div>
          )}

          {/* MODO 3: GRADE TRADICIONAL (2 Colunas) */}
          {viewMode === 'grid' && (
            <div className="grid grid-cols-2 gap-2.5">
              {filteredNotes.map((note) => {
                const glowClass =
                  note.category === 'Trabalho'
                    ? 'glow-trab'
                    : note.category === 'Pessoal'
                    ? 'glow-pess'
                    : 'glow-ideia';

                return (
                  <div
                    key={note.id}
                    onClick={() => {
                      playSynthSound('click');
                      onOpenEditor(note.id);
                    }}
                    className={`p-3.5 rounded-2xl border relative cursor-pointer active:scale-98 transition-all duration-200 flex flex-col justify-between shadow-sm hover:border-orange-500/40 ${isLightCard(note) ? '' : 'bg-jaspe-card'} ${glowClass}`}
                    style={{
                      backgroundColor: cardBg(note),
                      borderColor: cardBorder(note),
                      borderLeft:
                        cardAccent(note)
                          ? `4px solid ${cardAccent(note)}`
                          : undefined
                    }}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1">
                        <h5 className={`font-extrabold text-xs truncate flex-1 ${isLightCard(note) ? 'text-neutral-900' : 'text-zinc-100'}`}>
                          {note.title || 'Sem Título'}
                        </h5>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onTogglePin(note.id);
                          }}
                          className="p-1 -mr-1 text-zinc-500 hover:text-amber-400 shrink-0"
                          aria-label="Fixar anotação"
                        >
                          <Pin
                            className={`w-3.5 h-3.5 ${
                              note.pinned
                                ? 'text-amber-400 fill-amber-400'
                                : 'text-zinc-500'
                            }`}
                          />
                        </button>
                      </div>
                      <p className={`text-[10px] mt-1.5 line-clamp-2 leading-relaxed ${isLightCard(note) ? 'text-neutral-600' : 'text-zinc-400'}`}>
                        {note.body
                          ? note.body.replace(/<[^>]*>/g, '')
                          : 'Sem conteúdo...'}
                      </p>
                    </div>

                    <div className="flex items-center justify-between mt-3 text-[8px] font-bold border-t border-white/5 pt-2">
                      <span className={`px-1.5 py-0.5 rounded uppercase tracking-wider truncate max-w-[70px] ${isLightCard(note) ? 'bg-orange-700/10 text-orange-800' : 'bg-orange-500/10 text-orange-400'}`}>
                        {note.category}
                      </span>
                      <span className={`shrink-0 ${isLightCard(note) ? 'text-neutral-600' : 'text-zinc-500'}`}>{note.date}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* MODO 4: LISTA COMPACTA */}
          {viewMode === 'list' && (
            <div className="space-y-2 flex flex-col">
              {filteredNotes.map((note) => (
                <div
                  key={note.id}
                  onClick={() => {
                    playSynthSound('click');
                    onOpenEditor(note.id);
                  }}
                  className="p-3 rounded-xl border bg-jaspe-card flex items-center justify-between gap-3 hover:border-orange-500/40 cursor-pointer active:scale-98 transition-all shadow-sm"
                  style={{
                    backgroundColor: cardBg(note),
                    borderColor: cardBorder(note),
                    borderLeft:
                      cardAccent(note)
                        ? `4px solid ${cardAccent(note)}`
                        : undefined
                  }}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <Folder className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                    <div className="min-w-0 truncate">
                      <h5 className={`font-extrabold text-xs truncate ${isLightCard(note) ? 'text-neutral-900' : 'text-zinc-100'}`}>
                        {note.title || 'Sem Título'}
                      </h5>
                      <div className="flex items-center gap-2 text-[9px] text-zinc-400">
                        <span className={`px-1.5 py-0.2 rounded font-bold uppercase tracking-wider text-[8px] ${isLightCard(note) ? 'bg-orange-700/10 text-orange-800' : 'bg-orange-500/10 text-orange-400'}`}>
                          {note.category}
                        </span>
                        <span className={`truncate max-w-[140px] ${isLightCard(note) ? 'text-neutral-600' : 'text-zinc-500'}`}>
                          {note.body
                            ? note.body.replace(/<[^>]*>/g, '')
                            : 'Sem conteúdo...'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[9px] ${isLightCard(note) ? 'text-neutral-600' : 'text-zinc-500'}`}>{note.date}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onTogglePin(note.id);
                      }}
                      className="p-1 text-zinc-500 hover:text-amber-400"
                      aria-label="Fixar anotação"
                    >
                      <Pin
                        className={`w-3.5 h-3.5 ${
                          note.pinned
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-zinc-500'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Menu de Categorias Slide-out Direito (Drawer Suspenso com Setinha) */}
      {isCategoryDrawerOpen && (
        <div
          onClick={() => {
            setIsCategoryDrawerOpen(false);
            setIsCreatingCategory(false);
          }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
        />
      )}
      <aside
        className={`absolute inset-y-0 right-0 w-72 bg-jaspe-sidebarBg border-l border-jaspe-border py-6 px-4 z-50 transition-transform duration-300 ease-out flex flex-col justify-between shadow-2xl ${
          isCategoryDrawerOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none'
        }`}
      >
        <div>
          <div className="flex items-center justify-between mb-5 border-b border-jaspe-border pb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-100 flex items-center gap-1.5">
              <Folder className="w-4 h-4 text-orange-400" /> Categorias & Pastas
            </h4>
            <button
              onClick={() => {
                setIsCategoryDrawerOpen(false);
                setIsCreatingCategory(false);
              }}
              className="p-1 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-white/10 transition-all"
              aria-label="Fechar gaveta"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Lista de Categorias com Lixeirinha */}
          <div className="space-y-1.5 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
            {categories.map((folder) => {
              const count =
                folder === 'Todas'
                  ? safeNotes.length
                  : safeNotes.filter((n) => n && n.category === folder).length;
              const isSelected = activeFolder === folder;

              return (
                <div
                  key={folder}
                  className="flex items-center gap-1 w-full group"
                >
                  <button
                    onClick={() => handleSelectFolder(folder)}
                    className={`flex-1 flex items-center justify-between py-2.5 px-3 rounded-xl text-xs text-left font-semibold transition-all ${
                      isSelected
                        ? 'category-active-item'
                        : 'category-idle-item'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 truncate">
                      <Folder className={`w-4 h-4 shrink-0 ${isSelected ? 'text-orange-500' : 'text-zinc-400'}`} />
                      <span className={`truncate font-bold ${isSelected ? 'text-orange-400' : 'text-zinc-100'}`}>
                        {folder === 'Todas' ? 'Todas as Notas' : folder}
                      </span>
                    </span>
                    <span className={`category-badge-count text-[9px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${
                      isSelected ? 'bg-orange-500/20 text-orange-300' : 'bg-white/10 text-zinc-200'
                    }`}>
                      {count}
                    </span>
                  </button>

                  {/* Lixeira ao lado da categoria para exclusão */}
                  {folder !== 'Todas' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCategory(folder);
                      }}
                      className="category-trash-btn p-2 rounded-xl text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0"
                      title={`Excluir categoria "${folder}"`}
                      aria-label={`Excluir categoria ${folder}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Rodapé da Gaveta: Criar Nova Categoria */}
        <div className="border-t border-jaspe-border pt-4">
          {isCreatingCategory ? (
            <div className="space-y-2 bg-black/20 dark:bg-black/20 p-2.5 rounded-xl border border-jaspe-border">
              <input
                type="text"
                autoFocus
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirmCreateCategory();
                  if (e.key === 'Escape') setIsCreatingCategory(false);
                }}
                placeholder="Nome da categoria..."
                className="w-full text-xs p-2 rounded-lg bg-jaspe-card border border-jaspe-border text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-orange-500/50"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleConfirmCreateCategory}
                  className="flex-1 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all"
                >
                  <Check className="w-3.5 h-3.5" /> Salvar
                </button>
                <button
                  onClick={() => {
                    setIsCreatingCategory(false);
                    setNewCategoryName('');
                  }}
                  className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-bold transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => {
                playSynthSound('click');
                setIsCreatingCategory(true);
              }}
              className="w-full py-2.5 bg-orange-600/10 text-orange-400 border border-orange-500/25 hover:bg-orange-600 hover:text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-sm"
            >
              <PlusCircle className="w-4 h-4" /> Criar Nova Categoria
            </button>
          )}
        </div>
      </aside>
    </section>
  );
}
