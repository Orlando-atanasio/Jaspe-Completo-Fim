import React, { useState, useEffect } from 'react';
import {
  Grid,
  Menu,
  LayoutGrid,
  AlignJustify,
  Send,
  UserPlus,
  Search,
  Star,
  Phone,
  Mail,
  MessageCircle,
  Building,
  User
} from 'lucide-react';
import { Contact } from '../types';
import { playSynthSound } from '../utils/audio';
import { cleanTgUser, openTelegramDirect, openTelegramShare, toWhatsAppDigits } from '../utils/share';

const openTelegramContact = (c: { telegram?: string; name?: string } | null | undefined) => {
  playSynthSound('click');
  const user = cleanTgUser(c?.telegram);
  const greeting = `Olá ${c?.name || ''}!`;
  if (user) openTelegramDirect(user, greeting);
  else openTelegramShare(greeting);
};

interface ContactsViewProps {
  contacts: Contact[];
  onOpenEditModal: (contactId: number | null) => void;
  onToggleFavorite: (id: number) => void;
  onOpenMessageModal: (channel?: 'whatsapp' | 'telegram') => void;
}

type ViewMode = 'grid' | 'list' | 'compact' | 'detailed';

export default function ContactsView({
  contacts,
  onOpenEditModal,
  onToggleFavorite,
  onOpenMessageModal
}: ContactsViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      const v = localStorage.getItem('jaspe_contacts_view');
      if (v === 'grid' || v === 'list' || v === 'compact' || v === 'detailed') return v as ViewMode;
    } catch {}
    return 'grid';
  });
  const [searchTerm, setSearchTerm] = useState<string>('');

  useEffect(() => {
    try {
      localStorage.setItem('jaspe_contacts_view', viewMode);
    } catch {}
  }, [viewMode]);

  const safeContacts = Array.isArray(contacts) ? contacts : [];
  const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const q = norm(searchTerm);
  const qDigits = (searchTerm || '').replace(/\D/g, '');
  const filteredContacts = safeContacts.filter(
    (c) =>
      !q ||
      norm(c?.name).includes(q) ||
      norm(c?.company).includes(q) ||
      norm(c?.email).includes(q) ||
      (qDigits !== '' && ((c?.phone || '').replace(/\D/g, '').includes(qDigits)))
  );

  return (
    <section className="p-4 space-y-4 text-left">
      {/* Filtros Multimodais de View */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
          Ficha de Contatos
        </h3>
        <div className="flex bg-jaspe-card border border-jaspe-border p-1 rounded-xl gap-0.5">
          <button
            onClick={() => {
              playSynthSound('click');
              setViewMode('grid');
            }}
            className={`p-1.5 rounded-lg transition-all ${
              viewMode === 'grid'
                ? 'bg-orange-600 text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title="Grade (2 colunas)"
            aria-label="Grade"
          >
            <Grid className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              playSynthSound('click');
              setViewMode('list');
            }}
            className={`p-1.5 rounded-lg transition-all ${
              viewMode === 'list'
                ? 'bg-orange-600 text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title="Lista em Linhas"
            aria-label="Lista"
          >
            <Menu className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              playSynthSound('click');
              setViewMode('compact');
            }}
            className={`p-1.5 rounded-lg transition-all ${
              viewMode === 'compact'
                ? 'bg-orange-600 text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title="Bloco Compactado"
            aria-label="Bloco Compactado"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              playSynthSound('click');
              setViewMode('detailed');
            }}
            className={`p-1.5 rounded-lg transition-all ${
              viewMode === 'detailed'
                ? 'bg-orange-600 text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title="Modo Detalhado"
            aria-label="Modo Detalhado"
          >
            <AlignJustify className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Ações e Barra de Busca */}
      <div className="flex items-center justify-between gap-1.5">
        <button
          onClick={() => {
            playSynthSound('click');
            onOpenMessageModal('whatsapp');
          }}
          className="flex-1 py-2.5 px-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-1 active:scale-95 transition-all hover:bg-emerald-500/30"
        >
          <MessageCircle className="w-4 h-4" /> WhatsApp
        </button>
        <button
          onClick={() => {
            playSynthSound('click');
            onOpenMessageModal('telegram');
          }}
          className="flex-1 py-2.5 px-1 bg-sky-500/20 text-sky-400 border border-sky-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-1 active:scale-95 transition-all hover:bg-sky-500/30"
        >
          <Send className="w-4 h-4" /> Telegram
        </button>
        <button
          onClick={() => {
            playSynthSound('click');
            onOpenEditModal(null);
          }}
          className="py-2.5 px-4 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all shadow-md"
        >
          <UserPlus className="w-4 h-4" /> Novo
        </button>
      </div>

      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar contato..."
          className="w-full bg-jaspe-card border border-jaspe-border p-3 pl-9 rounded-xl text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-orange-500/50"
        />
        <Search className="absolute left-3 top-3.5 w-4 h-4 text-zinc-500" />
      </div>

      {/* Lista de Contatos com 4 Modos de Visualização */}
      {filteredContacts.length === 0 ? (
        <div className="p-8 text-center bg-jaspe-card rounded-2xl border border-jaspe-border shadow-sm">
          <p className="text-xs text-zinc-500">Nenhum contato encontrado.</p>
        </div>
      ) : viewMode === 'grid' ? (
        /* Modo 1: Grade (2 Colunas) */
        <div className="grid grid-cols-2 gap-2.5">
          {filteredContacts.map((contact) => (
            <div
              key={contact.id}
              className="bg-jaspe-card border border-jaspe-border p-3.5 rounded-2xl flex flex-col justify-between space-y-2.5 shadow-sm hover:border-orange-500/40 transition-all cursor-pointer text-left active:scale-98"
              onClick={() => onOpenEditModal(contact.id)}
            >
              <div className="flex items-start justify-between gap-1">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center font-bold text-orange-500 border border-orange-500/20 shrink-0 text-xs">
                    {(contact?.name || "?").charAt(0)}
                  </div>
                  <div className="overflow-hidden">
                    <h4 className="font-extrabold text-xs text-zinc-100 truncate">
                      {(contact?.name || 'Sem nome')}
                    </h4>
                    <span className="text-[9px] text-zinc-400 truncate block">
                      {contact.company || contact.category}
                    </span>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(contact.id);
                  }}
                  className="p-1 text-zinc-500 hover:text-amber-400 shrink-0"
                  aria-label="Favoritar Contato"
                >
                  <Star
                    className={`w-3.5 h-3.5 ${
                      contact.isFavorite
                        ? 'text-amber-400 fill-amber-400'
                        : 'text-zinc-600'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between border-t border-white/5 pt-2 text-[9px]">
                <span className="text-orange-400 bg-orange-500/10 px-1.5 py-0.2 rounded font-bold uppercase text-[8px] truncate max-w-[70px]">
                  {contact.category}
                </span>
                <div
                  className="flex items-center gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <a
                    href={(contact?.phone || '').trim() ? `tel:${contact.phone}` : undefined}
                    className="p-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white transition-all active:scale-90"
                    title="Ligar"
                  >
                    <Phone className="w-3 h-3" />
                  </a>
                  <a
                    href={(contact?.email || '').trim() ? `mailto:${contact.email}` : undefined}
                    className="p-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white transition-all active:scale-90"
                    title="Enviar E-mail"
                  >
                    <Mail className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : viewMode === 'list' ? (
        /* Modo 2: Lista Clássica em Linhas */
        <div className="space-y-2 flex flex-col">
          {filteredContacts.map((contact) => (
            <div
              key={contact.id}
              className="bg-jaspe-card border border-jaspe-border p-3 rounded-xl flex items-center justify-between shadow-sm hover:border-orange-500/40 transition-all cursor-pointer text-left active:scale-98"
              onClick={() => onOpenEditModal(contact.id)}
            >
              <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0">
                <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center font-bold text-orange-500 border border-orange-500/20 shrink-0 text-xs">
                  {(contact?.name || "?").charAt(0)}
                </div>
                <div className="overflow-hidden min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-extrabold text-xs text-zinc-100 truncate">
                      {(contact?.name || 'Sem nome')}
                    </h4>
                    <span className="text-[8px] bg-orange-500/10 text-orange-400 px-1.5 py-0.2 rounded font-bold uppercase shrink-0">
                      {contact.category}
                    </span>
                  </div>
                  <span className="text-[9px] text-zinc-400 truncate block">
                    {contact.company ? `${contact.company} • ` : ''}{contact.phone}
                  </span>
                </div>
              </div>

              <div
                className="flex items-center gap-1.5 shrink-0 ml-2"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(contact.id);
                  }}
                  className="p-1.5 text-zinc-500 hover:text-amber-400"
                  aria-label="Favoritar Contato"
                >
                  <Star
                    className={`w-3.5 h-3.5 ${
                      contact.isFavorite
                        ? 'text-amber-400 fill-amber-400'
                        : 'text-zinc-600'
                    }`}
                  />
                </button>
                <a
                  href={(contact?.phone || '').trim() ? `tel:${contact.phone}` : undefined}
                  className="p-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white transition-all active:scale-90"
                  title="Ligar"
                >
                  <Phone className="w-3.5 h-3.5" />
                </a>
                <a
                  href={(contact?.email || '').trim() ? `mailto:${contact.email}` : undefined}
                  className="p-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white transition-all active:scale-90"
                  title="Enviar E-mail"
                >
                  <Mail className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ))}
        </div>
      ) : viewMode === 'compact' ? (
        /* Modo 3: Bloco Compactado (Mini-Cards Densos) */
        <div className="grid grid-cols-2 gap-2">
          {filteredContacts.map((contact) => (
            <div
              key={contact.id}
              className="bg-jaspe-card border border-jaspe-border p-2.5 rounded-xl flex items-center justify-between shadow-sm hover:border-orange-500/40 transition-all cursor-pointer active:scale-98"
              onClick={() => onOpenEditModal(contact.id)}
            >
              <div className="flex items-center gap-2 overflow-hidden min-w-0 pr-1">
                <div className="w-6 h-6 rounded-full bg-orange-500/15 flex items-center justify-center font-bold text-orange-400 text-[10px] shrink-0">
                  {(contact?.name || "?").charAt(0)}
                </div>
                <div className="overflow-hidden min-w-0">
                  <h4 className="font-extrabold text-[11px] text-zinc-100 truncate">
                    {(contact?.name || 'Sem nome')}
                  </h4>
                  <span className="text-[9px] text-zinc-400 block truncate">
                    {contact.company || contact.category}
                  </span>
                </div>
              </div>

              <div
                className="flex items-center gap-1 shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <a
                  href={(contact?.phone || '').trim() ? `tel:${contact.phone}` : undefined}
                  className="p-1 rounded bg-zinc-800/80 text-zinc-400 hover:text-white transition-all"
                  title="Ligar"
                >
                  <Phone className="w-3 h-3" />
                </a>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Modo 4: Detalhado / Ficha Completa */
        <div className="space-y-3">
          {filteredContacts.map((contact) => (
            <div
              key={contact.id}
              className="bg-jaspe-card border border-jaspe-border p-4 rounded-2xl space-y-3 shadow-sm hover:border-orange-500/40 transition-all cursor-pointer text-left"
              onClick={() => onOpenEditModal(contact.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center font-black text-orange-400 text-lg shrink-0">
                    {(contact?.name || "?").charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-sm text-zinc-100">{(contact?.name || 'Sem nome')}</h4>
                      <span className="text-[9px] bg-orange-500/15 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-full font-bold uppercase">
                        {contact.category}
                      </span>
                    </div>
                    <span className="text-xs text-zinc-400 flex items-center gap-1 mt-0.5">
                      <Building className="w-3.5 h-3.5 text-zinc-500" />
                      {contact.company || 'Empresa Geral'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(contact.id);
                  }}
                  className="p-1 text-zinc-500 hover:text-amber-400"
                  aria-label="Favoritar"
                >
                  <Star
                    className={`w-4 h-4 ${
                      contact.isFavorite
                        ? 'text-amber-400 fill-amber-400'
                        : 'text-zinc-600'
                    }`}
                  />
                </button>
              </div>

              {/* Informações detalhadas */}
              <div className="bg-black/30 p-3 rounded-xl border border-white/5 grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-zinc-500 text-[10px] block">Telefone / Celular:</span>
                  <span className="text-zinc-200 font-mono font-medium">{contact.phone}</span>
                </div>
                <div>
                  <span className="text-zinc-500 text-[10px] block">E-mail:</span>
                  <span className="text-zinc-200 font-mono font-medium truncate block">
                    {contact.email}
                  </span>
                </div>
                {contact.telegram ? (
                  <div className="col-span-2">
                    <span className="text-zinc-500 text-[10px] block">Telegram:</span>
                    <span className="text-sky-300 font-mono font-medium">@{cleanTgUser(contact.telegram)}</span>
                  </div>
                ) : null}
              </div>

              {/* Ações de Comunicação */}
              <div
                className="flex items-center justify-between pt-1"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <a
                    href={(contact?.phone || '').trim() ? `tel:${contact.phone}` : undefined}
                    className="py-1.5 px-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                  >
                    <Phone className="w-3.5 h-3.5" /> Ligar
                  </a>
                  <a
                    href={(contact?.email || '').trim() ? `mailto:${contact.email}` : undefined}
                    className="py-1.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95"
                  >
                    <Mail className="w-3.5 h-3.5" /> E-mail
                  </a>
                  {(contact?.phone || '').replace(/\D/g, '') ? (
                    <a
                      href={`https://wa.me/${toWhatsAppDigits(contact?.phone)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="py-1.5 px-3 rounded-xl bg-emerald-600/20 border border-emerald-500/30 hover:bg-emerald-600/30 text-emerald-400 font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95"
                    >
                      <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                    </a>
                  ) : (
                    <span
                      title="Contato sem telefone"
                      className="py-1.5 px-3 rounded-xl bg-zinc-800/50 text-zinc-600 font-bold text-xs flex items-center gap-1.5 cursor-not-allowed"
                    >
                      <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                    </span>
                  )}
                  <button
                    onClick={() => openTelegramContact(contact)}
                    className="py-1.5 px-3 rounded-xl bg-sky-500/20 border border-sky-500/30 hover:bg-sky-500/30 text-sky-400 font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95"
                    title="Abrir no Telegram instalado"
                  >
                    <Send className="w-3.5 h-3.5" /> Telegram
                  </button>
                </div>

                <span className="text-[10px] text-orange-400 font-bold hover:underline">
                  Editar Ficha →
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
