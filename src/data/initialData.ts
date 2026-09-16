import { Note, Contact, Credential, Asset, Provento, Task, OfficeDocument, UserProfile } from '../types';

export const initialNotes: Note[] = [
  {
    id: 1,
    title: 'Planejamento Estratégico & Metas',
    body: 'Revisão dos objetivos trimestrais do Jaspe. Focar na consolidação da carteira e simplificação do fluxo diário.',
    date: '05/09/2026',
    category: 'Trabalho',
    pinned: true,
    color: '#FEF08A',
    paperStyle: 'ruled-paper'
  },
  {
    id: 2,
    title: 'Lista de Compras & Provisões',
    body: 'Comprar tintas de parede para reforma do escritório residencial.',
    date: '05/09/2026',
    category: 'Pessoal',
    pinned: true,
    color: '#BBF7D0',
    paperStyle: 'ruled-paper'
  },
  {
    id: 3,
    title: 'Ideias para Próxima Versão',
    body: 'Implementar atalhos rápidos de teclado adicionais e relatórios gerenciais consolidados em PDF nativo.',
    date: '05/09/2026',
    category: 'Ideias',
    pinned: false,
    color: '#BAE6FD',
    paperStyle: 'dots-paper'
  }
];

export const initialContacts: Contact[] = [
  {
    id: 1,
    name: 'Dr. Carlos Eduardo Menezes',
    email: 'carlos.menezes@consultoria.com',
    phone: '11987654321',
    category: 'Trabalho',
    company: 'Menezes & Associados',
    isFavorite: true
  },
  {
    id: 2,
    name: 'Mariana Albuquerque',
    email: 'mariana.albuquerque@gestao.com',
    phone: '21998765432',
    category: 'Finanças',
    company: 'Apex Investimentos',
    isFavorite: true
  },
  {
    id: 3,
    name: 'Eng. Roberto Silva',
    email: 'roberto.silva@arquitetura.eng.br',
    phone: '31988887777',
    category: 'Pessoal',
    company: 'Mendes Construtora',
    isFavorite: false
  }
];

export const initialTodos: Task[] = [
  {
    id: 1,
    text: 'Rebalancear Carteira de Investimentos',
    priority: 'Média',
    done: false,
    date: '05/09/2026 15:00',
    dateISO: '2026-09-05T15:00',
    category: 'Finanças',
    status: 'Em Andamento',
    type: 'Compra de Ativo',
    alarm: false,
    google: true
  },
  {
    id: 2,
    text: 'Revisar Documento de Estruturação do Jaspe',
    priority: 'Baixa',
    done: true,
    date: '02/09/2026 10:30',
    dateISO: '2026-09-02T10:30',
    category: 'Geral',
    status: 'Concluída',
    type: 'Tarefa',
    alarm: false,
    google: false
  },
  {
    id: 3,
    text: 'Reunião de Alinhamento de Metas',
    priority: 'Urgente',
    done: false,
    date: '06/09/2026 09:00',
    dateISO: '2026-09-06T09:00',
    category: 'Trabalho',
    status: 'Pendente',
    type: 'Reunião',
    alarm: true,
    google: true
  }
];

export const initialCredentials: Credential[] = [
  {
    id: 1,
    uuid: 'demo-cred-1',
    title: 'Conta Principal Google Workspace',
    username: 'orlando@jaspe.app',
    pass: '',
    category: 'Trabalho',
    strength: 'Fraca',
    url: 'https://accounts.google.com',
    notes: 'DEMO — defina a senha real após criar seu PIN. Nunca versionar senhas.'
  },
  {
    id: 2,
    uuid: 'demo-cred-2',
    title: 'Corretora de Valores (B3 / XP)',
    username: 'orlando.invest',
    pass: '',
    category: 'Finanças',
    strength: 'Fraca',
    url: 'https://www.xpi.com.br',
    notes: 'DEMO — defina a senha real após criar seu PIN.'
  }
];

export const initialAssets: Asset[] = [
  {
    id: 1,
    ticker: 'PETR4',
    name: 'Petróleo Brasileiro S.A.',
    cnpj: '33.000.167/0001-01',
    qty: 300,
    avgPrice: 32.40,
    currentPrice: 47.11,
    category: 'Ações'
  },
  {
    id: 2,
    ticker: 'MXRF11',
    name: '[TESTE] Maxi Renda FII',
    cnpj: '97.525.438/0001-14',
    qty: 500,
    avgPrice: 9.80,
    currentPrice: 10.15,
    category: 'FIIs'
  },
  {
    id: 3,
    ticker: 'WEGE3',
    name: '[TESTE] WEG S.A.',
    cnpj: '84.429.695/0001-11',
    qty: 100,
    avgPrice: 38.50,
    currentPrice: 48.12,
    category: 'Ações'
  },
  {
    id: 4,
    ticker: 'VALE3',
    name: '[TESTE] Vale S.A.',
    cnpj: '33.592.510/0001-54',
    qty: 10,
    avgPrice: 60.00,
    currentPrice: 60.00,
    category: 'Ações'
  },
  {
    id: 5,
    ticker: 'AAPL',
    name: '[TESTE] Apple Inc.',
    cnpj: '',
    qty: 5,
    avgPrice: 200.00,
    currentPrice: 200.00,
    category: 'Ações'
  },
  {
    id: 6,
    ticker: 'BTC',
    name: '[TESTE] Bitcoin',
    cnpj: '',
    qty: 0.01,
    avgPrice: 300000.00,
    currentPrice: 300000.00,
    category: 'Cripto'
  }
];

export const initialProventos: Provento[] = [
  { id: 1, ticker: 'WEGE3', company: 'WEG S.A.', type: 'Dividendo', date: '15/08/2026', amount: 25.00 },
  { id: 2, ticker: 'MXRF11', company: 'Maxi Renda FII', type: 'Rendimento', date: '14/08/2026', amount: 45.00 },
  { id: 3, ticker: 'PETR4', company: 'Petrobras S.A.', type: 'JCP', date: '29/08/2026', amount: 982.00 }
];

export const initialOfficeDocs: OfficeDocument[] = [
  {
    id: 3,
    uuid: 'demo-doc-3',
    title: 'Minuta de Acordo Operacional',
    type: 'DOCUMENTO',
    date: '01/09/2026',
    updatedAt: '2026-09-01T10:00:00.000Z',
    iconName: 'file-text',
    version: 1,
    content: 'MINUTA DE ACORDO OPERACIONAL\n\n1. OBJETO\nDescrever o objeto do acordo.\n\n2. PRAZOS\nDescrever prazos e marcos.\n\n3. RESPONSABILIDADES\nDescrever responsabilidades das partes.'
  }
];

export const initialProfile: UserProfile = {
  name: 'Orlando',
  email: 'orlando@jaspe.app',
  role: '',
  avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'
};
