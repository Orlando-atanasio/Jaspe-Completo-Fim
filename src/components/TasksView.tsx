import React, { useState, useEffect } from 'react';
import {
  PlusCircle,
  Circle,
  CheckCircle2,
  Menu,
  LayoutGrid,
  AlignJustify,
  Bell,
  Calendar,
  Clock
} from 'lucide-react';
import { Task } from '../types';
import { playSynthSound } from '../utils/audio';

interface TasksViewProps {
  tasks: Task[];
  onOpenEditDrawer: (id: number | null) => void;
  onToggleTask: (id: number) => void;
  onMoveTaskStatus: (id: number, targetStatus: 'Pendente' | 'Em Andamento' | 'Concluída') => void;
}

type ViewMode = 'list' | 'compact' | 'detailed';

export default function TasksView({
  tasks,
  onOpenEditDrawer,
  onToggleTask,
  onMoveTaskStatus
}: TasksViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      const v = localStorage.getItem('jaspe_tasks_view');
      if (v === 'list' || v === 'compact' || v === 'detailed') return v as ViewMode;
    } catch {}
    return 'list';
  });

  useEffect(() => {
    try {
      localStorage.setItem('jaspe_tasks_view', viewMode);
    } catch {}
  }, [viewMode]);

  const getPriorityStyle = (prio?: string) => {
    return prio === 'Urgente'
      ? 'text-red-500 bg-red-500/10'
      : prio === 'Alta'
      ? 'text-orange-400 bg-orange-500/10'
      : prio === 'Média'
      ? 'text-amber-400 bg-amber-500/10'
      : 'text-emerald-400 bg-emerald-500/10';
  };

  return (
    <section className="p-4 space-y-4 text-left">
      <div className="flex items-center justify-between">
        {/* Controles dos Modos de Visualização */}
        <div className="flex bg-jaspe-card border border-jaspe-border p-1 rounded-xl gap-0.5">
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
            aria-label="Lista em Linhas"
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
            onOpenEditDrawer(null);
          }}
          className="py-2 px-3 bg-orange-500/10 border border-orange-500/20 text-orange-400 font-bold text-xs rounded-xl flex items-center gap-1 shadow-md active:scale-95 transition-all hover:bg-orange-500/20"
        >
          <PlusCircle className="w-4 h-4" /> Criar Tarefa
        </button>
      </div>

      {/* Container Principal de Tarefas com os 3 Modos */}
      {(Array.isArray(tasks) ? tasks : []).length === 0 ? (
        <div className="p-8 text-center bg-jaspe-card rounded-2xl border border-jaspe-border">
          <p className="text-xs text-zinc-500">Nenhuma tarefa agendada.</p>
        </div>
      ) : viewMode === 'list' ? (
        /* Modo 1: Lista Clássica em Linhas */
        <div className="space-y-2 flex flex-col text-left">
          {(Array.isArray(tasks) ? tasks : []).filter((t) => t && typeof t === 'object').map((task, ti) => (
            <div
              key={task.id ?? `task-${ti}`}
              onClick={() => onOpenEditDrawer(task.id)}
              className="p-3 bg-jaspe-card border border-jaspe-border rounded-xl flex items-center justify-between hover:border-orange-500/30 cursor-pointer active:scale-98 transition-all shadow-sm"
            >
              <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleTask(task.id);
                  }}
                  className="p-1 hover:bg-white/5 rounded shrink-0"
                  aria-label="Concluir"
                >
                  {task.done ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Circle className="w-4 h-4 text-zinc-500" />
                  )}
                </button>
                <div className="overflow-hidden min-w-0">
                  <p
                    className={`text-xs font-semibold truncate ${
                      task.done ? 'line-through text-zinc-500' : 'text-zinc-200'
                    }`}
                  >
                    {task.text || '(sem título)'}
                  </p>
                  <span className="text-[9px] text-zinc-400 block mt-0.5">
                    {task.date || 'Sem data'} • {task.type || 'Geral'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                <span
                  className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${getPriorityStyle(
                    task.priority
                  )}`}
                >
                  {task.priority}
                </span>
                <span className="text-[8px] bg-white/5 text-zinc-400 px-1.5 py-0.5 rounded font-bold uppercase">
                  {task.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : viewMode === 'compact' ? (
        /* Modo 2: Bloco Compactado (Mini-Cards em Grade de 2 Colunas) */
        <div className="grid grid-cols-2 gap-2">
          {(Array.isArray(tasks) ? tasks : []).filter((t) => t && typeof t === 'object').map((task, ti) => (
            <div
              key={task.id ?? `task-c-${ti}`}
              onClick={() => onOpenEditDrawer(task.id)}
              className="bg-jaspe-card border border-jaspe-border p-2.5 rounded-xl flex items-center justify-between shadow-sm hover:border-orange-500/30 transition-all cursor-pointer active:scale-98"
            >
              <div className="overflow-hidden min-w-0 pr-1">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleTask(task.id);
                    }}
                    className="shrink-0"
                  >
                    {task.done ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Circle className="w-3.5 h-3.5 text-zinc-500" />
                    )}
                  </button>
                  <h4
                    className={`font-extrabold text-[11px] truncate ${
                      task.done ? 'line-through text-zinc-500' : 'text-zinc-100'
                    }`}
                  >
                    {task.text || '(sem título)'}
                  </h4>
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span
                    className={`text-[8px] font-bold px-1 py-0.2 rounded ${getPriorityStyle(
                      task.priority
                    )}`}
                  >
                    {task.priority}
                  </span>
                  <span className="text-[8px] text-zinc-400 truncate">{task.date || 'Sem data'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Modo 3: Detalhado / Completo */
        <div className="space-y-3">
          {(Array.isArray(tasks) ? tasks : []).filter((t) => t && typeof t === 'object').map((task, ti) => (
            <div
              key={task.id ?? `task-d-${ti}`}
              onClick={() => onOpenEditDrawer(task.id)}
              className="bg-jaspe-card border border-jaspe-border p-4 rounded-2xl space-y-3 shadow-sm hover:border-orange-500/30 transition-all cursor-pointer text-left"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleTask(task.id);
                    }}
                    className="p-1 hover:bg-white/5 rounded shrink-0 mt-0.5"
                    aria-label="Concluir"
                  >
                    {task.done ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <Circle className="w-5 h-5 text-zinc-500" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <h4
                      className={`font-extrabold text-sm leading-snug ${
                        task.done ? 'line-through text-zinc-500' : 'text-zinc-100'
                      }`}
                    >
                      {task.text || '(sem título)'}
                    </h4>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-orange-400" /> {task.date || 'Sem data'}
                      </span>
                      <span>•</span>
                      <span>{task.type || 'Geral'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span
                    className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${getPriorityStyle(
                      task.priority
                    )}`}
                  >
                    {task.priority}
                  </span>
                  <span className="text-[8px] bg-white/5 text-zinc-400 px-1.5 py-0.5 rounded font-bold uppercase">
                    {task.status}
                  </span>
                </div>
              </div>

              {/* Detalhes de Integração e Alarmes */}
              <div className="bg-black/30 p-2.5 rounded-xl border border-white/5 flex items-center justify-between text-[10px]">
                <div className="flex items-center gap-3">
                  <span
                    className={`flex items-center gap-1 ${
                      task.alarm ? 'text-amber-400 font-semibold' : 'text-zinc-500'
                    }`}
                  >
                    <Bell className="w-3.5 h-3.5" />
                    {task.alarm ? 'Alarme Ativo' : 'Sem Alarme'}
                  </span>
                  <span
                    className={`flex items-center gap-1 ${
                      task.google ? 'text-blue-400 font-semibold' : 'text-zinc-500'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    {task.google ? 'Evento de agenda' : 'Local'}
                  </span>
                </div>
                <span className="text-orange-400 font-bold hover:underline">
                  Editar Detalhes →
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
