import React, { useState, useEffect } from 'react';
import { X, ArrowUpRight, RefreshCw, Trash, Eye, EyeOff } from 'lucide-react';
import { Credential } from '../types';
import { playSynthSound } from '../utils/audio';
import { generateStrongPassword, passwordStrength } from '../utils/crypto';
import { newId } from '../utils/ids';
import CategoryField from './CategoryField';
import { countCats } from '../utils/categories';

interface EditCredentialModalProps {
  credentialId: number | null;
  credentials: Credential[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (cred: Partial<Credential> & { id?: number }) => void;
  onDelete: (id: number) => void;
  onShowToast: (msg: string) => void;
}

export default function EditCredentialModal({
  credentialId,
  credentials,
  isOpen,
  onClose,
  onSave,
  onDelete,
  onShowToast
}: EditCredentialModalProps) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string>('Trabalho');
  const [username, setUsername] = useState('');
  const [url, setUrl] = useState('');
  const [pass, setPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [passLength, setPassLength] = useState(16);
  const [notes, setNotes] = useState('');
  const [localId, setLocalId] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLocalId(credentialId);
    if (credentialId != null) {
      const list = Array.isArray(credentials) ? credentials : [];
      const c = list.find((item) => item && item.id === credentialId);
      if (c) {
        setTitle(c.title || "");
        setCategory(c.category || 'Trabalho');
        setUsername(c.username || "");
        setUrl(c.url || "");
        setPass(c.pass || "");
        setNotes(c.notes || '');
      } else {
        // id inválido: limpa para não exibir/salvar dados de outra credencial
        setTitle('');
        setCategory('Trabalho');
        setUsername('');
        setUrl('');
        setPass('');
        setNotes('');
      }
    } else {
      setLocalId(newId());
      setTitle('');
      setCategory('Trabalho');
      setUsername('');
      setUrl('');
      setPass('');
      setPassLength(16);
      setNotes('');
    }
  }, [credentialId, isOpen]);

  if (!isOpen) return null;

  const handleGenerateStrongPassword = () => {
    playSynthSound('click');
    setPass(generateStrongPassword(passLength));
  };

  const redirectUrl = () => {
    playSynthSound('click');
    if (!url.trim()) {
      onShowToast('Nenhuma URL configurada!');
      return;
    }
    const targetUrl = url.startsWith('http') ? url : `https://${url}`;
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  const handleBlurAutoSave = () => {
    // Só autosalva edição existente: em criação nova, blur não persiste
    // rascunho (evita credencial fantasma ao fechar no X sem salvar)
    if (credentialId == null) return;
    if (!title.trim()) return;
    if (!pass.trim()) return; // nunca salva 123456 / vazio em blur
    onSave({
      id: localId ?? credentialId ?? undefined,
      title: title.trim(),
      category,
      username,
      url,
      pass,
      strength: passwordStrength(pass),
      notes,
      updatedAt: new Date().toISOString()
    });
  };

  const handleSaveAndClose = () => {
    if (!title.trim()) {
      onShowToast('Por favor insira um título para a credencial.');
      return;
    }
    if (!pass.trim() || pass.length < 4) {
      onShowToast('Defina uma senha com ao menos 4 caracteres (ou gere uma forte).');
      return;
    }
    onSave({
      id: localId ?? credentialId ?? undefined,
      title: title.trim(),
      category,
      username,
      url,
      pass,
      strength: passwordStrength(pass),
      notes,
      updatedAt: new Date().toISOString()
    });
    onShowToast('Credencial salva com sucesso no cofre!');
    onClose();
  };

  const handleDelete = () => {
    if (credentialId != null) {
      playSynthSound('click');
      onDelete(credentialId);
      onShowToast('Credencial removida do cofre!');
      onClose();
    }
  };

  return (
    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-start justify-center p-3">
      <div className="w-full bg-[#1A1311] border border-jaspe-border rounded-[28px] p-6 max-h-[90%] overflow-y-auto space-y-5 text-left">
        <div className="flex items-center justify-between pb-2 border-b border-jaspe-border">
          <h3 className="font-extrabold text-sm text-zinc-100">
            {credentialId ? 'Editar Credencial' : 'Nova Credencial'}
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
                Título / Serviço *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleBlurAutoSave}
                placeholder="ex: Google Workspace"
                className="w-full bg-[#251C1A] border border-jaspe-border p-3 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-orange-500/50"
              />
            </div>
            <CategoryField
              expand
              label="Categoria"
              value={category}
              kind="geral"
              counts={countCats(credentials, (c) => c.category)}
              onChange={setCategory}
              onAfterChange={handleBlurAutoSave}
              onToast={onShowToast}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-zinc-400 font-bold uppercase">
              Usuário / E-mail de Login
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onBlur={handleBlurAutoSave}
              placeholder="ex: usuario@dominio.com"
              className="w-full bg-[#251C1A] border border-jaspe-border p-3 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-orange-500/50"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-zinc-400 font-bold uppercase">
              URL / Link de Acesso
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onBlur={handleBlurAutoSave}
                placeholder="https://accounts.google.com"
                className="flex-1 bg-[#251C1A] border border-jaspe-border p-3 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-orange-500/50"
              />
              <button
                type="button"
                onClick={redirectUrl}
                className="p-3 bg-zinc-800 rounded-xl text-zinc-300 hover:bg-zinc-700 active:scale-95 transition-all"
                title="Abrir URL"
              >
                <ArrowUpRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Caixa da Senha com Gerador e Slider */}
          <div className="bg-[#251C1A] p-4 rounded-2xl border border-jaspe-border space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] text-zinc-400 font-bold uppercase">
                Senha / Segredo *
              </label>
              <button
                type="button"
                onClick={handleGenerateStrongPassword}
                className="text-[10px] text-orange-400 hover:text-orange-300 font-bold flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> Gerar Nova (CSPRNG)
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type={showPass ? 'text' : 'password'}
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                onBlur={handleBlurAutoSave}
                className="flex-1 bg-[#1A1311] border border-jaspe-border p-3 rounded-xl text-xs font-mono text-zinc-100 focus:outline-none focus:border-orange-500/50"
                placeholder="Digite ou gere a senha..."
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="p-3 bg-zinc-800 rounded-xl text-zinc-300 hover:bg-zinc-700"
                title={showPass ? 'Ocultar' : 'Revelar'}
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="text-[10px] text-zinc-400">
              Força: <strong className="text-zinc-200">{pass ? passwordStrength(pass) : '—'}</strong>
            </div>
            <div className="flex items-center justify-between gap-4 text-[10px] text-zinc-400">
              <span>
                Comprimento: <strong className="text-zinc-200">{passLength}</strong>
              </span>
              <input
                type="range"
                min="8"
                max="32"
                value={passLength}
                onChange={(e) => setPassLength(Number(e.target.value))}
                className="flex-1 accent-orange-600 cursor-pointer"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-zinc-400 font-bold uppercase">
              Anotações de Segurança
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={handleBlurAutoSave}
              placeholder="Observações ou perguntas de segurança..."
              className="w-full h-16 bg-[#251C1A] border border-jaspe-border p-3 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-orange-500/50 resize-none"
            ></textarea>
          </div>

          <div className="flex items-center justify-between pt-2">
            {credentialId ? (
              <button
                onClick={handleDelete}
                className="text-red-500 font-bold text-xs hover:underline flex items-center gap-1 active:scale-95 transition-all"
              >
                <Trash className="w-3.5 h-3.5" /> Excluir
              </button>
            ) : (
              <button
                onClick={onClose}
                className="text-zinc-500 hover:text-zinc-300 text-xs font-bold"
              >
                Cancelar
              </button>
            )}
            <button
              onClick={handleSaveAndClose}
              className="py-3 px-6 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-lg active:scale-95 transition-all"
            >
              Salvar no Cofre
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
