import React, { useState } from 'react';
import {
  Plus,
  FileText,
  CheckSquare,
  TrendingUp,
  UserPlus,
  Lock
} from 'lucide-react';
import { playSynthSound } from '../utils/audio';

interface FABRadialProps {
  onAction: (action: string) => void;
}

// Leque curvo: cada item é UMA cápsula colorida (ícone + texto fundidos).
// Degraus de 64px na vertical (cápsula tem ~40px) = nunca se tocam; o
// deslocamento lateral desenha o arco. Ordem da base p/ o topo.
const ITEMS = [
  { key: 'Criar Documento', label: 'Novo documento', icon: FileText, bg: 'bg-[#EA580C] hover:bg-orange-600', pos: { bottom: '0px', right: '8px' } },
  { key: 'Nova Tarefa', label: 'Agendar tarefa', icon: CheckSquare, bg: 'bg-[#DB2777] hover:bg-pink-600', pos: { bottom: '64px', right: '48px' } },
  { key: 'Adicionar Ativo', label: 'Adicionar ativo', icon: TrendingUp, bg: 'bg-[#06B6D4] hover:bg-cyan-600', pos: { bottom: '128px', right: '88px' } },
  { key: 'Novo Contato', label: 'Adicionar contato', icon: UserPlus, bg: 'bg-[#10B981] hover:bg-emerald-600', pos: { bottom: '192px', right: '104px' } },
  { key: 'Nova Senha', label: 'Cofre e senhas', icon: Lock, bg: 'bg-[#EA580C] hover:bg-orange-600', pos: { bottom: '256px', right: '96px' } },
] as const;

export default function FABRadial({ onAction }: FABRadialProps) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleOpen = () => {
    playSynthSound('clickEcho');
    setIsOpen(!isOpen);
  };

  const handleAction = (actionName: string) => {
    playSynthSound('click');
    setIsOpen(false);
    onAction(actionName);
  };

  return (
    <div className="absolute bottom-28 right-4 z-30 flex flex-col items-end pointer-events-none">
      {/* Arco de cápsulas com entrada em cascata (da base p/ o topo) */}
      <div
        className={`relative w-64 h-[300px] mb-2 transition-all duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {ITEMS.map((it, i) => {
          const Icon = it.icon;
          // pointer-events SÓ com menu aberto: invisível nunca intercepta toque
          return (
            <button
              key={it.key}
              onClick={() => handleAction(it.key)}
              className={`absolute flex items-center gap-2 pl-3 pr-4 py-2.5 rounded-full text-white shadow-xl transition-all duration-200 active:scale-95 ${it.bg} ${
                isOpen ? 'opacity-100 translate-x-0 pointer-events-auto' : 'opacity-0 translate-x-6 pointer-events-none'
              }`}
              style={{ ...it.pos, transitionDelay: isOpen ? `${(ITEMS.length - 1 - i) * 45}ms` : '0ms' }}
              title={it.label}
              aria-label={it.label}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="text-[10px] font-bold whitespace-nowrap">{it.label}</span>
            </button>
          );
        })}
      </div>

      {/* Botão Base do FAB */}
      <button
        onClick={toggleOpen}
        className="p-4 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-xl shadow-orange-950/40 active:scale-90 transition-transform duration-200 pointer-events-auto z-40"
        aria-label="Ações Rápidas"
      >
        <Plus
          className={`w-6 h-6 transition-transform duration-200 ${
            isOpen ? 'rotate-45' : 'rotate-0'
          }`}
        />
      </button>
    </div>
  );
}
