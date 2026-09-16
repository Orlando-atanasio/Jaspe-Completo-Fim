import React, { useState, useEffect } from 'react';
import { X, Trash } from 'lucide-react';
import { Asset } from '../types';
import { playSynthSound } from '../utils/audio';
import { newId } from '../utils/ids';
import CategoryField from './CategoryField';
import { countCats } from '../utils/categories';

interface EditAssetModalProps {
  assetId: number | null;
  assets: Asset[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (asset: Partial<Asset> & { id?: number }) => void;
  onDelete: (id: number) => void;
}

export default function EditAssetModal({
  assetId,
  assets,
  isOpen,
  onClose,
  onSave,
  onDelete
}: EditAssetModalProps) {
  const [ticker, setTicker] = useState('');
  const [category, setCategory] = useState<string>('Ações');
  const [name, setName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [qty, setQty] = useState(0);
  const [avgPrice, setAvgPrice] = useState(0);
  const [localId, setLocalId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLocalId(assetId);
    if (assetId != null) {
      const list = Array.isArray(assets) ? assets : [];
      const a = list.find((item) => item && item.id === assetId);
      if (a) {
        setTicker(a.ticker || "");
        setCategory(a.category || 'Ações');
        setName(a.name || "");
        setCnpj(a.cnpj || "");
        setQty(Number(a.qty) || 0);
        setAvgPrice(Number(a.avgPrice) || 0);
      } else {
        // id inválido: limpa para não exibir/salvar dados de outro ativo
        setTicker('');
        setCategory('Ações');
        setName('');
        setCnpj('');
        setQty(0);
        setAvgPrice(0);
      }
    } else {
      setLocalId(newId());
      setTicker('');
      setCategory('Ações');
      setName('');
      setCnpj('');
      setQty(100);
      setAvgPrice(30.0);
    }
  }, [assetId, isOpen]);

  if (!isOpen) return null;

  // Preserva a cotação sincronizada ao editar (nunca zera p/ preço médio)
  const keptPrice = () => {
    if (assetId == null) return Number(avgPrice) || 0;
    const list = Array.isArray(assets) ? assets : [];
    const cur = list.find((item) => item && item.id === assetId)?.currentPrice;
    return Number(cur) > 0 ? Number(cur) : Number(avgPrice) || 0;
  };

  const handleBlurAutoSave = () => {
    // Mesma validação do salvar explícito + só em edição existente:
    // evita ativo fantasma/incompleto ao tabular ou fechar no X
    if (assetId == null) return;
    if (!ticker.trim()) return;
    if (!(Number(qty) > 0)) return;
    onSave({
      id: localId ?? assetId ?? undefined,
      ticker: ticker.toUpperCase().trim(),
      category,
      name: name.trim() || '(sem nome)',
      cnpj: cnpj.trim() || '',
      qty: Number(qty) || 0,
      avgPrice: Number(avgPrice) || 0,
      currentPrice: keptPrice()
    });
  };

  const handleSaveAndClose = () => {
    if (!ticker.trim()) { setErrorMessage('Informe o ticker do ativo.'); return; }
    if (!(Number(qty) > 0)) { setErrorMessage('Quantidade deve ser maior que zero.'); return; }
    if (!(Number(avgPrice) >= 0)) { setErrorMessage('Preço médio inválido.'); return; }
    setErrorMessage(null);
    onSave({
      id: localId ?? assetId ?? undefined,
      ticker: ticker.toUpperCase().trim(),
      category,
      name: name.trim() || '(sem nome)',
      cnpj: cnpj.trim() || '',
      qty: Number(qty) || 0,
      avgPrice: Number(avgPrice) || 0,
      currentPrice: keptPrice()
    });
    onClose();
  };

  const handleDelete = () => {
    if (assetId != null) {
      playSynthSound('click');
      onDelete(assetId);
      onClose();
    }
  };

  return (
    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-start justify-center p-3">
      <div className="w-full bg-[#1A1311] border border-jaspe-border rounded-[28px] p-6 max-h-[90%] overflow-y-auto space-y-6 text-left">
        <div className="flex items-center justify-between border-b border-jaspe-border pb-3">
          <h3 className="font-extrabold text-sm text-zinc-100">
            {assetId ? 'Editar Ativo' : 'Novo Ativo'}
          </h3>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] text-zinc-400 font-bold uppercase">
                Ticker (Código B3) *
              </label>
              <input
                type="text"
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                onBlur={handleBlurAutoSave}
                placeholder="ex: PETR4"
                className="w-full bg-[#251C1A] border border-jaspe-border p-3 rounded-xl text-xs text-zinc-100 uppercase font-bold focus:outline-none focus:border-orange-500/50"
              />
            </div>
            <CategoryField
              expand
              label="Classe do Ativo"
              value={category}
              kind="ativo"
              counts={countCats(assets, (a) => a.category)}
              onChange={setCategory}
              onAfterChange={handleBlurAutoSave}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-zinc-400 font-bold uppercase">
              Razão Social / Nome Comercial
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleBlurAutoSave}
              placeholder="ex: Petróleo Brasileiro S.A."
              className="w-full bg-[#251C1A] border border-jaspe-border p-3 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-orange-500/50"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-zinc-400 font-bold uppercase">
              CNPJ do Emissor
            </label>
            <input
              type="text"
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              onBlur={handleBlurAutoSave}
              placeholder="00.000.000/0001-00"
              className="w-full bg-[#251C1A] border border-jaspe-border p-3 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-orange-500/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] text-zinc-400 font-bold uppercase">
                Quantidade
              </label>
              <input
                type="number"
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
                onFocus={(e) => e.target.select()}
                onBlur={handleBlurAutoSave}
                className="w-full bg-[#251C1A] border border-jaspe-border p-3 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-orange-500/50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-zinc-400 font-bold uppercase">
                Preço Médio (R$)
              </label>
              <input
                type="number"
                step="0.01"
                value={avgPrice}
                onChange={(e) => setAvgPrice(Number(e.target.value))}
                onFocus={(e) => e.target.select()}
                onBlur={handleBlurAutoSave}
                className="w-full bg-[#251C1A] border border-jaspe-border p-3 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-orange-500/50"
              />
            </div>
          </div>

          {errorMessage && (
            <p className="text-[11px] text-red-400 font-bold bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
              {errorMessage}
            </p>
          )}

          <div className="pt-4 flex items-center justify-between">
            {assetId ? (
              <button
                onClick={handleDelete}
                className="text-red-500 font-bold text-xs hover:underline flex items-center gap-1 active:scale-95 transition-all"
              >
                <Trash className="w-3.5 h-3.5" /> Excluir
              </button>
            ) : (
              <div></div>
            )}
            <button
              onClick={handleSaveAndClose}
              className="py-3 px-6 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-lg active:scale-95 transition-all"
            >
              Salvar Ativo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
