import { useState, useEffect } from 'react';
import { Signal, Wifi, Battery } from 'lucide-react';

export default function StatusBar() {
  const [time, setTime] = useState('14:32');
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      setTime(`${hh}:${mm}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full h-11 bg-jaspe-bg flex items-center justify-between px-7 pt-1 z-30 text-xs text-zinc-300 font-medium select-none relative">
      <span>{time}</span>
      {/* Notch / Câmera Frontal */}
      <div className="w-28 h-4.5 bg-black rounded-full absolute left-1/2 transform -translate-x-1/2 top-3"></div>
      <div className="flex items-center gap-1.5">
        <Signal className="w-3.5 h-3.5" />
        <Wifi className={`w-3.5 h-3.5 ${online ? '' : 'text-red-400'}`} />
        <Battery className="w-4 h-4" />
      </div>
    </div>
  );
}
