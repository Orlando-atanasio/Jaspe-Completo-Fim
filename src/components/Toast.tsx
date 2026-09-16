import { CheckCircle } from 'lucide-react';

interface ToastProps {
  message: string | null;
}

export default function Toast({ message }: ToastProps) {
  if (!message) return null;

  return (
    <div className="absolute top-16 left-4 right-4 z-50 transition-all duration-300 pointer-events-none">
      <div className="bg-[#251C1A] border border-jaspe-border p-3.5 rounded-2xl flex items-center gap-2.5 shadow-2xl text-left">
        <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
          <CheckCircle className="w-4.5 h-4.5" />
        </div>
        <span className="text-xs text-zinc-100 font-medium">
          {message}
        </span>
      </div>
    </div>
  );
}
