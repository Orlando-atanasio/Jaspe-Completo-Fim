import React from 'react';
import {
  LayoutDashboard,
  Notebook,
  Users,
  ShieldAlert,
  Wallet,
  CheckSquare,
  FolderOpen,
  Trash2,
  Printer,
  Sun,
  Moon,
  HardDrive,
  Edit3
} from 'lucide-react';
import { TabType, UserProfile } from '../types';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTab: (tab: TabType) => void;
  currentTab: TabType;
  pinnedNotesCount: number;
  contactsCount: number;
  isCofreUnlocked: boolean;
  assetsCount: number;
  documentsCount?: number;
  pendingTasksCount: number;
  isLightTheme: boolean;
  onToggleTheme: () => void;
  onOpenReport: () => void;
  onOpenBackup: () => void;
  onOpenTrash: () => void;
  trashCount: number;
  onOpenProfile: () => void;
  profile: UserProfile;
}

export default function Drawer({
  isOpen,
  onClose,
  onSelectTab,
  currentTab,
  pinnedNotesCount,
  contactsCount,
  isCofreUnlocked,
  assetsCount,
  documentsCount = 0,
  pendingTasksCount,
  isLightTheme,
  onToggleTheme,
  onOpenReport,
  onOpenBackup,
  onOpenTrash,
  trashCount,
  onOpenProfile,
  profile
}: DrawerProps) {
  return (
    <>
      {/* Overlay ultra sutil para permitir visualização máxima dos cards de trás */}
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/15 z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* 
        GAVETA LATERAL TRANSLÚCIDA (90% DE TRANSPARÊNCIA) 
        Permite enxergar claramente os cards e conteúdo da tela por trás da gaveta.
      */}
      <aside
        className={`absolute inset-y-0 left-0 w-76 sm:w-80 drawer-translucent border-r border-white/10 flex flex-col justify-between py-5 z-50 transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          backgroundColor: isLightTheme
            ? 'rgba(250, 246, 240, 0.20)'
            : 'rgba(26, 19, 17, 0.12)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)'
        }}
      >
        <div className="overflow-y-auto flex-1 min-h-0">
          {/* Header do Drawer */}
          <div className="flex items-center gap-3 px-6 mb-5">
            <img
              src="/logo.svg"
              alt="Jaspe"
              className="w-10 h-10 rounded-xl shadow-lg object-cover"
            />
            <div className="flex flex-col">
              <span className="font-extrabold tracking-wider text-sm uppercase text-zinc-100 drop-shadow-sm">
                Jaspe
              </span>
              <span className="text-[10px] text-zinc-400 font-medium">
                Painel Executivo & JaspeNote
              </span>
            </div>
          </div>

          {/* Seções do Drawer */}
          <div className="space-y-5 px-3">
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 px-4 mb-2.5">
                Módulos Principais
              </h4>
              <nav className="space-y-1.5">
                <button
                  onClick={() => { onClose(); onSelectTab('dashboard'); }}
                  className={`w-full flex items-center justify-between py-3.5 px-4 rounded-2xl text-[13px] font-semibold transition-all ${
                    currentTab === 'dashboard'
                      ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                      : 'text-zinc-200 hover:bg-white/10'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <LayoutDashboard className="w-5 h-5 text-zinc-400" /> Visão Geral
                  </span>
                </button>

                <button
                  onClick={() => { onClose(); onSelectTab('anotacoes'); }}
                  className={`w-full flex items-center justify-between py-3.5 px-4 rounded-2xl text-[13px] font-semibold transition-all ${
                    currentTab === 'anotacoes'
                      ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                      : 'text-zinc-200 hover:bg-white/10'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Notebook className="w-5 h-5 text-zinc-400" /> Anotações
                  </span>
                  <span className="text-[9px] bg-black/30 backdrop-blur-md px-2 py-0.5 rounded-full text-zinc-300 font-bold border border-white/10">
                    {pinnedNotesCount} fixadas
                  </span>
                </button>

                <button
                  onClick={() => { onClose(); onSelectTab('contatos'); }}
                  className={`w-full flex items-center justify-between py-3.5 px-4 rounded-2xl text-[13px] font-semibold transition-all ${
                    currentTab === 'contatos'
                      ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                      : 'text-zinc-200 hover:bg-white/10'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Users className="w-5 h-5 text-zinc-400" /> E-mails & Contatos
                  </span>
                  <span className="text-[9px] bg-black/30 backdrop-blur-md px-2 py-0.5 rounded-full text-zinc-300 font-bold border border-white/10">
                    {contactsCount}
                  </span>
                </button>

                <button
                  onClick={() => { onClose(); onSelectTab('cofre'); }}
                  className={`w-full flex items-center justify-between py-3.5 px-4 rounded-2xl text-[13px] font-semibold transition-all ${
                    currentTab === 'cofre'
                      ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                      : 'text-zinc-200 hover:bg-white/10'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <ShieldAlert className="w-5 h-5 text-zinc-400" /> Cofres e Senhas
                  </span>
                  <span
                    className={`text-[9px] px-2 py-0.5 rounded-full border font-bold ${
                      isCofreUnlocked
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                    }`}
                  >
                    {isCofreUnlocked ? 'Desbloqueado' : 'Bloqueado'}
                  </span>
                </button>

                <button
                  onClick={() => { onClose(); onSelectTab('carteira'); }}
                  className={`w-full flex items-center justify-between py-3.5 px-4 rounded-2xl text-[13px] font-semibold transition-all ${
                    currentTab === 'carteira'
                      ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                      : 'text-zinc-200 hover:bg-white/10'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Wallet className="w-5 h-5 text-zinc-400" /> Ativos e Carteira
                  </span>
                  <span className="text-[9px] bg-black/30 backdrop-blur-md px-2 py-0.5 rounded-full text-zinc-300 font-bold border border-white/10">
                    {assetsCount}
                  </span>
                </button>

                <button
                  onClick={() => { onClose(); onSelectTab('tarefas'); }}
                  className={`w-full flex items-center justify-between py-3.5 px-4 rounded-2xl text-[13px] font-semibold transition-all ${
                    currentTab === 'tarefas'
                      ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                      : 'text-zinc-200 hover:bg-white/10'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <CheckSquare className="w-5 h-5 text-zinc-400" /> Tarefas e Trabalhos
                  </span>
                  <span className="text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                    {pendingTasksCount}
                  </span>
                </button>

                <button
                  onClick={() => { onClose(); onSelectTab('office'); }}
                  className={`w-full flex items-center justify-between py-3.5 px-4 rounded-2xl text-[13px] font-semibold transition-all ${
                    currentTab === 'office'
                      ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                      : 'text-zinc-200 hover:bg-white/10'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <FolderOpen className="w-5 h-5 text-zinc-400" /> Documentos
                  </span>
                  <span className="text-[9px] bg-black/30 backdrop-blur-md px-2 py-0.5 rounded-full text-zinc-300 font-bold border border-white/10">
                    {documentsCount}
                  </span>
                </button>
              </nav>
            </div>

            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 px-4 mb-2.5">
                Ferramentas
              </h4>
              <nav className="space-y-1.5">
                <button
                  onClick={onOpenReport}
                  className="w-full flex items-center gap-3 py-3 px-4 rounded-2xl text-zinc-300 hover:text-white hover:bg-white/10 transition-all text-[13px] font-medium"
                >
                  <Printer className="w-5 h-5 text-zinc-400" /> Imprimir Relatório
                </button>
                <button
                  onClick={onToggleTheme}
                  className="w-full flex items-center justify-between py-3 px-4 rounded-2xl text-zinc-300 hover:text-white hover:bg-white/10 transition-all text-[13px] font-medium"
                >
                  <span className="flex items-center gap-3">
                    {isLightTheme ? (
                      <Moon className="w-5 h-5 text-zinc-400" />
                    ) : (
                      <Sun className="w-5 h-5 text-zinc-400" />
                    )}
                    {isLightTheme ? 'Modo Escuro' : 'Modo Claro'}
                  </span>
                  <span className="text-[9px] bg-black/30 px-2.5 py-0.5 rounded-full text-zinc-300 border border-white/10 font-bold">
                    {isLightTheme ? 'Claro' : 'Escuro'}
                  </span>
                </button>
                <button
                  onClick={onOpenBackup}
                  className="w-full flex items-center gap-3 py-3 px-4 rounded-2xl text-zinc-300 hover:text-white hover:bg-white/10 transition-all text-[13px] font-medium"
                >
                  <HardDrive className="w-5 h-5 text-zinc-400" /> Central de Backup
                </button>
                <button
                  onClick={onOpenTrash}
                  className="w-full flex items-center justify-between py-3 px-4 rounded-2xl text-zinc-300 hover:text-white hover:bg-white/10 transition-all text-[13px] font-medium"
                >
                  <span className="flex items-center gap-3">
                    <Trash2 className="w-5 h-5 text-zinc-400" /> Lixeira
                  </span>
                  <span className="text-[9px] bg-black/30 backdrop-blur-md px-2 py-0.5 rounded-full text-zinc-300 font-bold border border-white/10">
                    {trashCount}
                  </span>
                </button>
              </nav>
              {/* Perfil — dentro da rolagem, abaixo da Lixeira, com o divisor */}
              <div className="border-t border-white/10 mt-4 pt-4 pb-1">
                <div className="flex items-center justify-between p-3 bg-black/30 backdrop-blur-md rounded-2xl border border-white/5">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <img
                      src={profile?.avatarUrl || "/logo.svg"}
                      alt={profile?.name || "Perfil"}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-xs font-bold text-zinc-100 truncate">
                        {profile?.name || "Usuário"}
                      </span>
                      <span className="text-[9px] text-zinc-400 truncate">
                        {profile?.email || ""}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={onOpenProfile}
                    className="p-2 hover:bg-white/10 rounded-xl text-zinc-400 hover:text-zinc-200 transition-all"
                    aria-label="Editar Perfil"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

      </aside>
    </>
  );
}
