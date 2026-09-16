import React, { useState, useEffect } from 'react';
import { User, X, Trash } from 'lucide-react';
import { Contact } from '../types';
import { playSynthSound } from '../utils/audio';
import { newId } from '../utils/ids';
import CategoryField from './CategoryField';
import { countCats } from '../utils/categories';

interface EditContactModalProps {
  contactId: number | null;
  contacts: Contact[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (contact: Partial<Contact> & { id?: number }) => void;
  onDelete: (id: number) => void;
}

export default function EditContactModal({
  contactId,
  contacts,
  isOpen,
  onClose,
  onSave,
  onDelete
}: EditContactModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [telegram, setTelegram] = useState('');
  const [company, setCompany] = useState('');
  const [category, setCategory] = useState<string>('Trabalho');
  const [localId, setLocalId] = useState<number | null>(null);
  // Hooks sempre antes de qualquer early return (regras dos Hooks)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLocalId(contactId);
    if (contactId != null) {
      const list = Array.isArray(contacts) ? contacts : [];
      const c = list.find((item) => item && item.id === contactId);
      if (c) {
        setName(c.name || '');
        setEmail(c.email || '');
        setPhone(c.phone || '');
        setTelegram(c.telegram || '');
        setCompany(c.company || '');
        setCategory(c.category || 'Trabalho');
      } else {
        // id inválido: limpa para não exibir/salvar dados de outro contato
        setName('');
        setEmail('');
        setPhone('');
        setTelegram('');
        setCompany('');
        setCategory('Trabalho');
      }
    } else {
      setLocalId(newId());
      setTelegram('');
      setName('');
      setEmail('');
      setPhone('');
      setCompany('');
      setCategory('Trabalho');
    }
    setErrorMessage(null);
    setIsConfirmingDelete(false);
  }, [contactId, isOpen]);

  if (!isOpen) return null;

  const handleBlurAutoSave = () => {
    // Só autosalva edição existente: em criação nova, blur não persiste
    // rascunho (evita contato fantasma ao fechar no X sem salvar)
    if (contactId == null) return;
    if (!name.trim()) return;
    onSave({
      id: localId ?? contactId ?? undefined,
      name: name.trim(),
      email,
      phone,
      telegram: telegram.trim().replace(/^@+/, ''),
      company: (company || '').trim(),
      category
    });
  };

  const handleSaveAndClose = () => {
    if (!name.trim()) {
      setErrorMessage('Por favor informe o nome do contato.');
      return;
    }
    onSave({
      id: localId ?? contactId ?? undefined,
      name: name.trim(),
      email,
      phone,
      telegram: telegram.trim().replace(/^@+/, ''),
      company: (company || '').trim(),
      category
    });
    onClose();
  };

  const handleDelete = () => {
    if (contactId != null) {
      if (!isConfirmingDelete) {
        setIsConfirmingDelete(true);
        return;
      }
      playSynthSound('click');
      onDelete(contactId);
      onClose();
    }
  };

  return (
    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-start justify-center p-3">
      <div className="w-full bg-[#1A1311] border border-jaspe-border rounded-[28px] p-6 max-h-[90%] overflow-y-auto space-y-6 text-left">
        <div className="flex items-center justify-between border-b border-jaspe-border pb-3">
          <h3 className="font-extrabold text-sm text-zinc-100 flex items-center gap-2">
            <User className="w-4 h-4 text-orange-400" /> Ficha do Contato
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
          <div className="space-y-1">
            <label className="text-[10px] text-zinc-400 font-bold uppercase">
              Nome Completo *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleBlurAutoSave}
              className="w-full bg-[#251C1A] border border-jaspe-border p-3 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-orange-500/50"
              placeholder="ex: Dr. Carlos Eduardo"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-zinc-400 font-bold uppercase">
              E-mail Principal
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={handleBlurAutoSave}
              className="w-full bg-[#251C1A] border border-jaspe-border p-3 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-orange-500/50"
              placeholder="ex: contato@exemplo.com"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-zinc-400 font-bold uppercase">
              Telefone
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onBlur={handleBlurAutoSave}
              className="w-full bg-[#251C1A] border border-jaspe-border p-3 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-orange-500/50"
              placeholder="ex: 11987654321 (DDD+número; BR aplica DDI 55 automaticamente)"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-zinc-400 font-bold uppercase">
              Telegram (@usuário)
            </label>
            <input
              type="text"
              value={telegram}
              onChange={(e) => setTelegram(e.target.value)}
              onBlur={handleBlurAutoSave}
              className="w-full bg-[#251C1A] border border-jaspe-border p-3 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-orange-500/50"
              placeholder="ex: @seuusuario (opcional — abre o chat direto)"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-zinc-400 font-bold uppercase">
              Empresa / Instituição
            </label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              onBlur={handleBlurAutoSave}
              className="w-full bg-[#251C1A] border border-jaspe-border p-3 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-orange-500/50"
              placeholder="ex: Menezes Consultoria"
            />
          </div>

                      <CategoryField
              label="Categoria"
              value={category}
              kind="geral"
              counts={countCats(contacts, (c) => c.category)}
              onChange={setCategory}
              onAfterChange={handleBlurAutoSave}
            />

          {errorMessage && (
            <p className="text-[11px] text-red-400 font-bold bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
              {errorMessage}
            </p>
          )}

          <div className="pt-4 flex items-center justify-between">
            {contactId != null ? (
              <button
                onClick={handleDelete}
                className="text-red-500 font-bold text-xs hover:underline flex items-center gap-1 active:scale-95 transition-all"
              >
                <Trash className="w-3.5 h-3.5" /> {isConfirmingDelete ? 'Confirmar exclusão?' : 'Remover'}
              </button>
            ) : (
              <div></div>
            )}
            <button
              onClick={handleSaveAndClose}
              className="py-3 px-6 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-lg active:scale-95 transition-all"
            >
              Salvar no CRM
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
