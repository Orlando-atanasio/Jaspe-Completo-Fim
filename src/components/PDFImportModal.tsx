import React, { useState, useEffect, useRef } from 'react';
import { FileText, X, UploadCloud, CheckCircle, Trash2, Plus, Edit2 } from 'lucide-react';
import { Asset } from '../types';
import { playSynthSound } from '../utils/audio';
import { parseBrokerageText } from '../utils/finance';
import type { ParsedTrade } from '../utils/finance';
import { newId, newUUID } from '../utils/ids';

import * as pdfjsLib from 'pdfjs-dist';
// Configura worker local p/ pdf.js (funciona offline e online)
if (typeof window !== 'undefined' && 'GlobalWorkerOptions' in pdfjsLib) {
  (pdfjsLib as any).GlobalWorkerOptions.workerSrc = '/pdf.worker.js';
}

interface EditableTradeItem {
  id: string;
  ticker: string;
  qty: number;
  price: number;
  category: string;
}

interface PDFImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApproveAsset: (asset: Asset) => void;
  onShowToast: (msg: string) => void;
}

const CATEGORY_OPTIONS = ['Ações', 'FIIs', 'ETFs', 'BDRs', 'Renda Fixa', 'Cripto'];

// Detecta automaticamente a classe do ativo por convenção B3
function detectAssetCategory(ticker: string): string {
  const sym = (ticker || '').toUpperCase().trim();
  if (sym.endsWith('11')) return 'FIIs';
  if (sym.endsWith('39') || sym.endsWith('34') || sym.endsWith('35')) return 'BDRs';
  if (/^(IVVB|BOVA|SMAL|HASH|XINA|GOLD|BBSD|DIVO|FIND|MATB|PIBB|SMAC|SPXI|TECK|USTK|WRLD)\d{1,2}$/.test(sym)) return 'ETFs';
  return 'Ações';
}

export default function PDFImportModal({
  isOpen,
  onClose,
  onApproveAsset,
  onShowToast
}: PDFImportModalProps) {
  const [step, setStep] = useState<'upload' | 'scanning' | 'review'>('upload');
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState('');
  const [items, setItems] = useState<EditableTradeItem[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Reabre sempre do zero
  useEffect(() => {
    if (isOpen) {
      setStep('upload');
      setProgress(0);
      setItems([]);
      setFileName('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Extrai texto de todas as páginas do PDF via PDF.js
  const extractPdfText = async (arrayBuffer: ArrayBuffer): Promise<string> => {
    let loadingTask: any = null;
    try {
      loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
      const pdfDoc = await loadingTask.promise;
      const numPages = pdfDoc.numPages;
      const pagesText: string[] = [];

      for (let i = 1; i <= numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const textContent = await page.getTextContent();
        const pageItems = textContent.items
          .map((item: any) => item.str || '')
          .join(' ');
        pagesText.push(pageItems);
      }

      const fullText = pagesText.join('\n');
      if (fullText.trim().length > 10) return fullText;
    } catch (e) {
      console.warn('[jaspe] pdfjs falhou, tentando fallback:', e);
    } finally {
      if (loadingTask) {
        try { await loadingTask.destroy(); } catch {}
      }
    }
    return '';
  };

  // Leitura com PDF.js + Fallback de texto puro
  const handleFile = async (f: File) => {
    playSynthSound('click');
    setFileName(f.name);
    setStep('scanning');
    setProgress(15);

    try {
      const buf = await f.arrayBuffer();
      setProgress(45);
      let text = '';

      if (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')) {
        text = await extractPdfText(buf);
      }

      if (!text || text.trim().length < 10) {
        try {
          const bin = new Uint8Array(buf);
          const dec = new TextDecoder('latin1');
          let s = '';
          const CHUNK = 65536;
          for (let i = 0; i < bin.length; i += CHUNK) {
            s += dec.decode(bin.slice(i, i + CHUNK), { stream: true });
          }
          s += dec.decode();
          const parens = Array.from(s.matchAll(/\(([\x20-\x7E\u00C0-\u00FF ]{2,120})\)/g)).map((m) => m[1]).join(' ');
          text = (parens.length > 40 ? parens : s.slice(0, 60000)).replace(/[^\x20-\x7E\u00C0-\u00FF\n\r\t.,\-\/0-9A-Za-z ]/g, ' ');
        } catch {
          text = await f.text().catch(() => '');
        }
      }

      setProgress(85);
      const parsed = parseBrokerageText(text);

      const tradeItems: EditableTradeItem[] = parsed.map((tr, idx) => ({
        id: `trade-${idx}-${Date.now()}`,
        ticker: tr.ticker,
        qty: tr.qty,
        price: tr.price,
        category: detectAssetCategory(tr.ticker)
      }));

      setItems(tradeItems);
      setProgress(100);

      if (tradeItems.length > 0) {
        onShowToast(`${tradeItems.length} ativo(s) detectado(s) na nota!`);
      } else {
        onShowToast('Nenhum ativo detectado automaticamente. Você pode adicionar manualmente.');
      }

      setTimeout(() => {
        setStep('review');
        playSynthSound('success');
      }, 250);
    } catch {
      setStep('upload');
      onShowToast('Falha ao ler o arquivo selecionado.');
    }
  };

  const handleStartOCR = () => {
    inputRef.current?.click();
  };

  const updateItem = (id: string, patch: Partial<EditableTradeItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const removeItem = (id: string) => {
    playSynthSound('click');
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const addNewItem = () => {
    playSynthSound('click');
    const newItem: EditableTradeItem = {
      id: `trade-new-${Date.now()}`,
      ticker: '',
      qty: 1,
      price: 0,
      category: 'Ações'
    };
    setItems((prev) => [...prev, newItem]);
  };

  // Importar todos de uma vez só
  const handleImportAll = () => {
    const validItems = items.filter((it) => it.ticker.trim() && it.qty > 0 && it.price > 0);

    if (validItems.length === 0) {
      onShowToast('Informe ao menos 1 ativo com Ticker, Quantidade e Preço válidos.');
      return;
    }

    // Consolida por ticker antes de salvar para garantir zero duplicatas na carteira
    const consolidatedMap = new Map<string, { ticker: string; totalQty: number; totalInvested: number; category: string }>();

    validItems.forEach((it) => {
      const sym = it.ticker.toUpperCase().trim();
      const q = Number(it.qty) || 0;
      const p = Number(it.price) || 0;
      if (!consolidatedMap.has(sym)) {
        consolidatedMap.set(sym, {
          ticker: sym,
          totalQty: q,
          totalInvested: q * p,
          category: it.category
        });
      } else {
        const cur = consolidatedMap.get(sym)!;
        cur.totalQty += q;
        cur.totalInvested += q * p;
      }
    });

    playSynthSound('success');
    let importedCount = 0;

    consolidatedMap.forEach((entry) => {
      const finalPrice = entry.totalQty > 0 ? Number((entry.totalInvested / entry.totalQty).toFixed(2)) : 0;
      const newAsset: Asset = {
        id: newId(),
        uuid: newUUID(),
        ticker: entry.ticker,
        name: `${entry.ticker} (via nota ${fileName || 'B3'})`,
        cnpj: '00.000.000/0001-00',
        qty: entry.totalQty,
        avgPrice: finalPrice,
        currentPrice: finalPrice,
        quoteSource: 'corretagem',
        category: entry.category
      };
      onApproveAsset(newAsset);
      importedCount++;
    });

    onShowToast(`Sucesso! ${importedCount} ativo(s) consolidados e adicionados à sua carteira.`);
    handleClose();
  };

  const handleClose = () => {
    playSynthSound('click');
    setStep('upload');
    setProgress(0);
    setItems([]);
    onClose();
  };

  const totalGeral = items.reduce((acc, it) => acc + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);

  return (
    <div className="absolute inset-0 bg-black/70 backdrop-blur-md z-40 flex items-center justify-center p-3">
      <div className="w-full max-w-lg bg-[#1A1311] border border-jaspe-border rounded-[24px] p-4 flex flex-col max-h-[92vh] text-left shadow-2xl overflow-hidden">
        
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-jaspe-border pb-3 mb-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-zinc-100">Importação de Nota B3</h3>
              <p className="text-[10px] text-zinc-400">
                {fileName ? fileName : 'Ações, FIIs, ETFs, BDRs direto da nota'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-zinc-500 hover:text-zinc-300 p-1 rounded-lg"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.txt,.csv,text/plain,application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = '';
          }}
        />

        {/* Etapa 1: Upload */}
        {step === 'upload' && (
          <div
            onClick={handleStartOCR}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) handleFile(f);
            }}
            onDragOver={(e) => e.preventDefault()}
            className="p-8 my-4 border-2 border-dashed border-jaspe-border rounded-2xl bg-black/20 text-center space-y-3 cursor-pointer hover:border-emerald-500/40 transition-all active:scale-98"
          >
            <div className="w-14 h-14 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto">
              <UploadCloud className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <strong className="text-sm text-zinc-100 block">
                Selecione ou Arraste a Nota de Corretagem
              </strong>
              <p className="text-xs text-zinc-400">
                Lê todos os ativos da nota: XP, Clear, Rico, BTG, Inter, NuInvest etc.
              </p>
            </div>
            <button
              type="button"
              className="mt-2 py-2 px-4 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl shadow transition-all pointer-events-none"
            >
              Escolher Arquivo PDF
            </button>
          </div>
        )}

        {/* Etapa 2: Carregando e processando */}
        {step === 'scanning' && (
          <div className="p-8 my-6 space-y-4 text-center">
            <div className="relative w-12 h-12 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-zinc-800"></div>
              <div className="absolute inset-0 rounded-full border-4 border-emerald-400 border-t-transparent animate-spin"></div>
            </div>
            <div className="space-y-1">
              <strong className="text-sm text-zinc-200 block">
                Processando Nota da Corretora...
              </strong>
              <p className="text-xs text-zinc-400">
                Mapeando Tickers, Quantidades, Preços e Classes automaticamente.
              </p>
            </div>
            <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-400 h-full rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Etapa 3: Formulário Único de Importação Direta */}
        {step === 'review' && (
          <div className="flex flex-col flex-1 min-h-0 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-300 font-bold">
                {items.length} {items.length === 1 ? 'ativo encontrado' : 'ativos encontrados'}
              </span>
              <span className="text-emerald-400 font-bold">
                Total da Nota: R$ {totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            {/* Lista dos ativos reconhecidos */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {items.length === 0 ? (
                <div className="p-6 text-center text-xs text-zinc-400 bg-white/5 rounded-xl border border-white/5">
                  Nenhum ativo detectado na nota. Clique em "+ Adicionar Ativo" abaixo para preencher.
                </div>
              ) : (
                items.map((it, idx) => (
                  <div
                    key={it.id}
                    className="p-3 bg-jaspe-card border border-jaspe-border rounded-xl space-y-2.5 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-orange-400">
                        Item #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeItem(it.id)}
                        className="text-zinc-500 hover:text-red-400 p-1 rounded transition-colors"
                        title="Remover ativo da importação"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {/* Ticker */}
                      <div className="space-y-1">
                        <label className="text-[9px] text-zinc-400 font-bold uppercase">Ticker</label>
                        <input
                          type="text"
                          value={it.ticker}
                          placeholder="ex: PETR4"
                          onChange={(e) => {
                            const newTick = e.target.value.toUpperCase();
                            updateItem(it.id, {
                              ticker: newTick,
                              category: detectAssetCategory(newTick)
                            });
                          }}
                          className="w-full bg-[#140E0C] border border-jaspe-border p-1.5 rounded-lg text-xs font-bold text-zinc-100 uppercase focus:outline-none focus:border-emerald-400"
                        />
                      </div>

                      {/* Quantidade */}
                      <div className="space-y-1">
                        <label className="text-[9px] text-zinc-400 font-bold uppercase">Qtd</label>
                        <input
                          type="number"
                          value={it.qty}
                          min={1}
                          onChange={(e) => updateItem(it.id, { qty: Number(e.target.value) })}
                          className="w-full bg-[#140E0C] border border-jaspe-border p-1.5 rounded-lg text-xs font-bold text-zinc-100 focus:outline-none focus:border-emerald-400"
                        />
                      </div>

                      {/* Preço Unitário */}
                      <div className="space-y-1">
                        <label className="text-[9px] text-zinc-400 font-bold uppercase">Preço (R$)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={it.price}
                          onChange={(e) => updateItem(it.id, { price: Number(e.target.value) })}
                          className="w-full bg-[#140E0C] border border-jaspe-border p-1.5 rounded-lg text-xs font-bold text-zinc-100 focus:outline-none focus:border-emerald-400"
                        />
                      </div>

                      {/* Classe / Categoria */}
                      <div className="space-y-1">
                        <label className="text-[9px] text-zinc-400 font-bold uppercase">Classe</label>
                        <select
                          value={it.category}
                          onChange={(e) => updateItem(it.id, { category: e.target.value })}
                          className="w-full bg-[#140E0C] border border-jaspe-border p-1.5 rounded-lg text-xs font-bold text-zinc-200 focus:outline-none focus:border-emerald-400"
                        >
                          {CATEGORY_OPTIONS.map((cat) => (
                            <option key={cat} value={cat} className="bg-[#1A1311] text-zinc-200">
                              {cat}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Botão de adicionar mais ativos manualmente caso queira */}
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={addNewItem}
                className="py-1.5 px-3 bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-bold rounded-xl border border-white/10 flex items-center gap-1.5 active:scale-95 transition-all"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar Ativo
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep('upload');
                  setItems([]);
                }}
                className="text-xs text-zinc-400 hover:text-zinc-200 underline"
              >
                Trocar Arquivo
              </button>
            </div>

            {/* Ações Finais: Importar Tudo */}
            <div className="flex gap-2 pt-2 border-t border-jaspe-border/50">
              <button
                type="button"
                onClick={handleClose}
                className="py-2.5 px-4 bg-zinc-800 text-zinc-300 font-bold text-xs rounded-xl active:scale-95 transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleImportAll}
                className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-lg flex items-center justify-center gap-1.5 active:scale-95 transition-all"
              >
                <CheckCircle className="w-4 h-4" /> Importar Tudo para a Carteira
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
