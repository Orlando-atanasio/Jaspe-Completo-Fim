import { Notebook, Wallet, ShieldAlert, Users } from 'lucide-react';
import { TabType } from '../types';

interface FooterNavProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
}

export default function FooterNav({ currentTab, onSelectTab }: FooterNavProps) {
  return (
    <footer className="h-16 bg-neutral-950 border-t border-jaspe-border flex items-center justify-around px-2 z-20">
      <button
        onClick={() => onSelectTab('anotacoes')}
        className={`flex flex-col items-center gap-1 transition-all ${
          currentTab === 'anotacoes'
            ? 'text-jaspe-accent font-bold'
            : 'text-zinc-500 hover:text-zinc-200'
        }`}
      >
        <Notebook className="w-5 h-5" />
        <span className="text-[9px] font-bold">Anotações</span>
      </button>

      <button
        onClick={() => onSelectTab('carteira')}
        className={`flex flex-col items-center gap-1 transition-all ${
          currentTab === 'carteira'
            ? 'text-jaspe-accent font-bold'
            : 'text-zinc-500 hover:text-zinc-200'
        }`}
      >
        <Wallet className="w-5 h-5" />
        <span className="text-[9px] font-bold">Carteira</span>
      </button>

      <button
        onClick={() => onSelectTab('cofre')}
        className={`flex flex-col items-center gap-1 transition-all ${
          currentTab === 'cofre'
            ? 'text-jaspe-accent font-bold'
            : 'text-zinc-500 hover:text-zinc-200'
        }`}
      >
        <ShieldAlert className="w-5 h-5" />
        <span className="text-[9px] font-bold">Cofre</span>
      </button>

      <button
        onClick={() => onSelectTab('contatos')}
        className={`flex flex-col items-center gap-1 transition-all ${
          currentTab === 'contatos'
            ? 'text-jaspe-accent font-bold'
            : 'text-zinc-500 hover:text-zinc-200'
        }`}
      >
        <Users className="w-5 h-5" />
        <span className="text-[9px] font-bold">Contatos</span>
      </button>
    </footer>
  );
}

