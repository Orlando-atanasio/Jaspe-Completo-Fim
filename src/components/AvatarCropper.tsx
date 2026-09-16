import { useEffect, useRef, useState } from 'react';
import { X, Camera, Move, ZoomIn, ZoomOut, RotateCw, Undo2, Check, Crosshair } from 'lucide-react';
import { playSynthSound } from '../utils/audio';

interface AvatarCropperProps {
  src: string;
  onCancel: () => void;
  onDone: (dataUrl: string) => void;
  onToast: (msg: string) => void;
}

const PREVIEW = 240;
const OUTPUT = 512;
const MAX_SRC = 1280;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('img'));
    img.src = src;
  });
}

// Gira a origem p/ espaço alinhado aos eixos (prévia e recorte usam o mesmo)
function rotatedCanvas(img: HTMLImageElement, rot: number): HTMLCanvasElement | null {
  const swapped = (rot % 180) !== 0;
  const rc = document.createElement('canvas');
  rc.width = swapped ? img.naturalHeight : img.naturalWidth;
  rc.height = swapped ? img.naturalWidth : img.naturalHeight;
  const rctx = rc.getContext('2d');
  if (!rctx) return null;
  rctx.translate(rc.width / 2, rc.height / 2);
  rctx.rotate((rot * Math.PI) / 180);
  rctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  return rc;
}

export default function AvatarCropper({ src, onCancel, onDone, onToast }: AvatarCropperProps) {
  const [base, setBase] = useState<HTMLImageElement | null>(null);
  const [rotSrc, setRotSrc] = useState<string>(src);
  const [rotW, setRotW] = useState(1);
  const [rotH, setRotH] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [rot, setRot] = useState(0);
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const warnedPreview = useRef(false);

  // Carrega + reduz p/ no máximo 1280px (protege memória no celular)
  useEffect(() => {
    warnedPreview.current = false;
    let alive = true;
    loadImage(src)
      .then(async (im) => {
        const m = Math.max(im.naturalWidth, im.naturalHeight);
        if (m > MAX_SRC) {
          const k = MAX_SRC / m;
          const cv = document.createElement('canvas');
          cv.width = Math.round(im.naturalWidth * k);
          cv.height = Math.round(im.naturalHeight * k);
          cv.getContext('2d')?.drawImage(im, 0, 0, cv.width, cv.height);
          const data = cv.toDataURL('image/jpeg', 0.9);
          if (!data || data.length < 100) throw new Error('encode');
          const small = await loadImage(data);
          if (alive) setBase(small);
        } else if (alive) setBase(im);
      })
      .catch(() => { if (alive) { onToast('Não foi possível ler a imagem.'); onCancel(); } });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // Prévia sempre no espaço girado (exata, sem distorção de CSS).
  // toDataURL pode lançar no WebView (memória/taint) — sem try/catch aqui a
  // exceção escapa do effect e derruba a aba no ErrorBoundary.
  useEffect(() => {
    if (!base) return;
    const rc = rotatedCanvas(base, rot);
    if (!rc) return;
    try {
      setRotSrc(rc.toDataURL('image/jpeg', 0.88));
      setRotW(rc.width);
      setRotH(rc.height);
    } catch {
      if (!warnedPreview.current) {
        warnedPreview.current = true;
        onToast('Prévia indisponível neste aparelho — o enquadramento ainda pode funcionar.');
      }
    }
  }, [base, rot]);

  const s0 = Math.max(PREVIEW / rotW, PREVIEW / rotH);
  const dw = rotW * s0 * zoom;
  const dh = rotH * s0 * zoom;
  const clamp = (x: number, y: number) => ({
    x: Math.max(-Math.max(0, (dw - PREVIEW) / 2), Math.min(Math.max(0, (dw - PREVIEW) / 2), x)),
    y: Math.max(-Math.max(0, (dh - PREVIEW) / 2), Math.min(Math.max(0, (dh - PREVIEW) / 2), y))
  });
  const c = clamp(pos.x, pos.y);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    setPos(clamp(drag.current.ox + (e.clientX - drag.current.sx), drag.current.oy + (e.clientY - drag.current.sy)));
  };
  const onPointerUp = () => { drag.current = null; };

  const centralize = () => { playSynthSound('click'); setPos({ x: 0, y: 0 }); };
  const rotate = () => { playSynthSound('click'); setRot((r) => (r + 90) % 360); setPos({ x: 0, y: 0 }); };
  const resetAll = () => { playSynthSound('click'); setZoom(1); setPos({ x: 0, y: 0 }); setRot(0); };

  const conclude = () => {
    if (!base) return;
    playSynthSound('success');
    try {
      const rc = rotatedCanvas(base, rot);
      if (!rc) throw new Error('ctx');
      const k = s0 * zoom;
      const L = (PREVIEW - rotW * k) / 2 + c.x;
      const T = (PREVIEW - rotH * k) / 2 + c.y;
      const sx = Math.max(0, -L / k);
      const sy = Math.max(0, -T / k);
      const sw = Math.min(rotW - sx, PREVIEW / k);
      const sh = Math.min(rotH - sy, PREVIEW / k);
      const out = document.createElement('canvas');
      out.width = OUTPUT; out.height = OUTPUT;
      const octx = out.getContext('2d');
      if (!octx) throw new Error('ctx');
      octx.drawImage(rc, sx, sy, sw, sh, 0, 0, OUTPUT, OUTPUT);
      onDone(out.toDataURL('image/jpeg', 0.92));
    } catch {
      onToast('Falha ao enquadrar.');
    }
  };

  return (
    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-start justify-center p-3 overflow-y-auto">
      <div className="w-full bg-[#101418] border border-white/10 rounded-[28px] p-6 max-h-[94%] overflow-y-auto space-y-5 text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center shrink-0">
              <Camera className="w-6 h-6 text-white" />
            </span>
            <div>
              <h3 className="font-extrabold text-base text-zinc-100">Enquadrar Foto do Avatar</h3>
              <p className="text-[11px] text-zinc-400">Arraste para mover e use o zoom para enquadrar perfeitamente</p>
            </div>
          </div>
          <button onClick={onCancel} className="text-zinc-500 hover:text-zinc-300 p-1" aria-label="Fechar">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex justify-center">
          <div
            className="rounded-full overflow-hidden border-2 border-dashed border-white/25 relative bg-black/40"
            style={{ width: PREVIEW, height: PREVIEW, touchAction: 'none', cursor: 'grab' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {base && (
              <img
                src={rotSrc}
                alt="Prévia"
                draggable={false}
                className="absolute max-w-none select-none"
                style={{
                  width: dw, height: dh,
                  left: (PREVIEW - dw) / 2 + c.x,
                  top: (PREVIEW - dh) / 2 + c.y
                }}
              />
            )}
          </div>
        </div>

        <div className="flex justify-center">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-zinc-300 bg-white/10 px-4 py-2 rounded-full">
            <Move className="w-3.5 h-3.5" /> Arraste para reposicionar em qualquer direção
          </span>
        </div>

        <div className="flex items-center gap-2">
          <ZoomOut className="w-5 h-5 text-zinc-500 shrink-0" />
          <input
            type="range" min={1} max={3} step={0.1} value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-amber-500 cursor-pointer"
            aria-label="Zoom"
          />
          <ZoomIn className="w-5 h-5 text-zinc-500 shrink-0" />
          <span className="text-xs text-zinc-300 font-bold w-10 text-right">{zoom.toFixed(1)}x</span>
        </div>

        <div className="flex gap-2 justify-center flex-wrap">
          <button onClick={centralize} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/10 text-zinc-200 text-xs font-bold active:scale-95 transition-all">
            <Crosshair className="w-4 h-4" /> Centralizar
          </button>
          <button onClick={rotate} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/10 text-zinc-200 text-xs font-bold active:scale-95 transition-all">
            <RotateCw className="w-4 h-4" /> Girar 90°
          </button>
          <button onClick={resetAll} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/10 text-zinc-200 text-xs font-bold active:scale-95 transition-all">
            <Undo2 className="w-4 h-4" /> Redefinir
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 pt-4 border-t border-white/10">
          <button onClick={onCancel} className="text-zinc-400 hover:text-zinc-200 text-sm font-medium px-2 py-3">
            Cancelar
          </button>
          <button
            onClick={conclude}
            className="flex-1 py-3.5 rounded-2xl bg-amber-500 hover:brightness-110 text-black text-sm font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 active:scale-95 transition-all"
          >
            <Check className="w-5 h-5" /> Concluir Enquadramento
          </button>
        </div>
      </div>
    </div>
  );
}
