export type TabType = 'dashboard' | 'anotacoes' | 'contatos' | 'cofre' | 'carteira' | 'tarefas' | 'office';

export interface Note {
  id: number;
  uuid?: string;
  hash?: string;
  title: string;
  body: string;
  date: string;
  updatedAt?: string;
  category: string;
  pinned: boolean;
  color?: string;
  paperStyle?: string;
  checklist?: { id: string; text: string; done: boolean }[];
  attachments?: string[];
  deletedAt?: string | null;
}

export interface Contact {
  id: number;
  uuid?: string;
  name: string;
  email: string;
  phone: string;
  category: 'Trabalho' | 'Finanças' | 'Pessoal' | string;
  company: string;
  isFavorite: boolean;
  telegram?: string;
}

export interface Credential {
  id: number;
  uuid?: string;
  title: string;
  username: string;
  pass: string;
  category: 'Trabalho' | 'Finanças' | 'Pessoal' | string;
  strength?: string;
  url?: string;
  notes?: string;
  updatedAt?: string;
}

export interface Asset {
  id: number;
  uuid?: string;
  hash?: string;
  ticker: string;
  name: string;
  cnpj: string;
  qty: number;
  avgPrice: number;
  currentPrice: number;
  lastQuoteAt?: string;
  quoteSource?: string;
  category: 'Ações' | 'FIIs' | 'Renda Fixa' | 'Cripto' | string;
}

export interface Provento {
  id: number;
  uuid?: string;
  ticker: string;
  company: string;
  type: 'Dividendo' | 'Rendimento' | 'JCP' | string;
  date: string;
  amount: number;
}

export interface Task {
  id: number;
  uuid?: string;
  text: string;
  priority: 'Baixa' | 'Média' | 'Alta' | 'Urgente';
  done: boolean;
  date: string;
  dateISO?: string;
  category: string;
  status: 'Pendente' | 'Em Andamento' | 'Concluída';
  type: 'Tarefa' | 'Reunião' | 'Compra de Ativo' | 'Provento' | string;
  alarm?: boolean;
  google?: boolean;
  /** Minutos ANTES do prazo em que o alarme deve disparar. 0 = na hora. Ausente = 0 (compatível com tarefas antigas). */
  remindBeforeMin?: number;
  /** Repetir o aviso a cada X minutos até concluir/parar. 0/ausente = toca uma vez. */
  repeatEveryMin?: number;
}

export interface OfficeDocument {
  id: number;
  uuid?: string;
  hash?: string;
  title: string;
  type: 'APRESENTAÇÃO' | 'PLANILHA' | 'DOCUMENTO';
  date: string;
  updatedAt?: string;
  iconName: string;
  author?: string;
  tags?: string[];
  sizeBytes?: number;
  version?: number;
  linkedIds?: number[];
  deletedAt?: string | null;
  content?: string;
}

export interface UserProfile {
  name: string;
  email: string;
  avatarUrl: string;
  role?: string;
}
