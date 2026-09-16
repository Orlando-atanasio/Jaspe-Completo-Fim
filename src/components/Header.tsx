import { Menu, Search } from 'lucide-react';
import { TabType, UserProfile } from '../types';

interface HeaderProps {
  currentTab: TabType;
  onToggleDrawer: () => void;
  onOpenSearch: () => void;
  onOpenProfile: () => void;
  profile: UserProfile;
}

const titles: Record<TabType, string> = {
  dashboard: 'Visão Geral',
  anotacoes: 'JaspeNote',
  contatos: 'E-mails & Contatos',
  cofre: 'Cofre Forte',
  carteira: 'Carteira de Ativos',
  tarefas: 'Tarefas e Prazos',
  office: 'Office Studio'
};

export default function Header({
  currentTab,
  onToggleDrawer,
  onOpenSearch,
  onOpenProfile,
  profile
}: HeaderProps) {
  return (
    <header className="h-14 bg-jaspe-bg border-b border-jaspe-border flex items-center justify-between px-4 z-20">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleDrawer}
          className="p-2 hover:bg-white/5 rounded-xl text-zinc-300 active:scale-95 transition-all"
          aria-label="Abrir Menu Lateral"
        >
          <Menu className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2">
          <img
            src="/logo.svg"
            alt="Jaspe"
            className="w-6 h-6 rounded-md shadow-sm object-cover"
          />
          <span className="font-bold text-zinc-100 text-sm tracking-wide">
            {titles[currentTab] || 'Jaspe'}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={onOpenSearch}
          className="p-2 hover:bg-white/5 rounded-xl text-zinc-300 active:scale-95 transition-all"
          aria-label="Buscar (Ctrl+K)"
        >
          <Search className="w-5 h-5" />
        </button>
        {/* Avatar Circular com Indicador Esmeralda */}
        <button
          onClick={onOpenProfile}
          className="relative p-0.5 rounded-full border border-orange-500/30 overflow-hidden active:scale-95 transition-all shadow-[0_0_10px_rgba(234,88,12,0.15)]"
          aria-label="Perfil do Usuário"
        >
          <img
            src={profile?.avatarUrl || "/logo.svg"}
            alt={profile?.name || "Perfil"}
            className="w-10 h-10 rounded-full object-cover"
          />
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#10B981] border-2 border-jaspe-bg rounded-full"></span>
        </button>
      </div>
    </header>
  );
}
