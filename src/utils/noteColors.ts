export interface NoteColorTheme {
  swatch: string;
  name: string;
  headerBg: string;
  bodyBg: string;
  lineColor: string;
  headerFg: string;
  bodyFg: string;
  border: string;
  isDark: boolean;
}

export const NOTE_PALETTES: NoteColorTheme[] = [
  {
    swatch: '#F9F089',
    name: 'Amarelo Canário',
    headerBg: '#FDE352',
    bodyBg: '#FFF9C5',
    lineColor: 'rgba(180, 140, 40, 0.20)',
    headerFg: '#1C1917',
    bodyFg: '#1C1917',
    border: '#FACC15',
    isDark: false,
  },
  {
    swatch: '#FBDEC0',
    name: 'Pêssego Quente',
    headerBg: '#FDBA74',
    bodyBg: '#FFF5EB',
    lineColor: 'rgba(217, 119, 6, 0.18)',
    headerFg: '#1C1917',
    bodyFg: '#1C1917',
    border: '#FB923C',
    isDark: false,
  },
  {
    swatch: '#C8F9D9',
    name: 'Verde Menta',
    headerBg: '#86EFAC',
    bodyBg: '#F0FDF4',
    lineColor: 'rgba(22, 163, 74, 0.18)',
    headerFg: '#14532D',
    bodyFg: '#14532D',
    border: '#4ADE80',
    isDark: false,
  },
  {
    swatch: '#CBEBFA',
    name: 'Azul Céu',
    headerBg: '#7DD3FC',
    bodyBg: '#F0F9FF',
    lineColor: 'rgba(2, 132, 199, 0.18)',
    headerFg: '#0C4A6E',
    bodyFg: '#0C4A6E',
    border: '#38BDF8',
    isDark: false,
  },
  {
    swatch: '#EDDEFB',
    name: 'Lavanda',
    headerBg: '#D8B4FE',
    bodyBg: '#FAF5FF',
    lineColor: 'rgba(147, 51, 234, 0.18)',
    headerFg: '#581C87',
    bodyFg: '#581C87',
    border: '#C084FC',
    isDark: false,
  },
  {
    swatch: '#FADAF1',
    name: 'Rosa Quartzo',
    headerBg: '#F9A8D4',
    bodyBg: '#FDF2F8',
    lineColor: 'rgba(219, 39, 119, 0.18)',
    headerFg: '#831843',
    bodyFg: '#831843',
    border: '#F472B6',
    isDark: false,
  },
  {
    swatch: '#FED7AA',
    name: 'Damasco',
    headerBg: '#FDBA74',
    bodyBg: '#FFF7ED',
    lineColor: 'rgba(234, 88, 12, 0.18)',
    headerFg: '#1C1917',
    bodyFg: '#1C1917',
    border: '#FB923C',
    isDark: false,
  },
  {
    swatch: '#D9F99D',
    name: 'Limão Suave',
    headerBg: '#BEF264',
    bodyBg: '#F7FEE7',
    lineColor: 'rgba(101, 163, 13, 0.18)',
    headerFg: '#365314',
    bodyFg: '#365314',
    border: '#A3E635',
    isDark: false,
  },
  {
    swatch: '#F7F7F5',
    name: 'Branco Neve',
    headerBg: '#F4F4F5',
    bodyBg: '#FFFFFF',
    lineColor: 'rgba(0, 0, 0, 0.08)',
    headerFg: '#18181B',
    bodyFg: '#18181B',
    border: '#E4E4E7',
    isDark: false,
  },
  {
    swatch: '#251C1A',
    name: 'Cacau Original',
    headerBg: '#1A1311',
    bodyBg: '#251C1A',
    lineColor: 'rgba(234, 88, 12, 0.08)',
    headerFg: '#FAFAFA',
    bodyFg: '#FAFAFA',
    border: '#352824',
    isDark: true,
  },
];

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.replace('#', '');
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    return { r, g, b };
  }
  if (h.length === 6) {
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }
  return null;
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
  return '#' + toHex(r) + toHex(g) + toHex(b);
}

export function lightenHex(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return rgbToHex(rgb.r + (255 - rgb.r) * amount, rgb.g + (255 - rgb.g) * amount, rgb.b + (255 - rgb.b) * amount);
}

export function darkenHex(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return rgbToHex(rgb.r * (1 - amount), rgb.g * (1 - amount), rgb.b * (1 - amount));
}

export function textOnBg(hex: string): { header: string; body: string } {
  const rgb = hexToRgb(hex);
  if (!rgb) return { header: '#fafafa', body: '#18181b' };
  const lum = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return lum < 0.45
    ? { header: '#fafafa', body: '#e4e4e7' }
    : { header: '#18181b', body: '#18181b' };
}

export function getNoteTheme(hex?: string): NoteColorTheme {
  const defaultTheme = NOTE_PALETTES[0];
  if (!hex) return defaultTheme;

  const upper = hex.trim().toUpperCase();

  const aliases: Record<string, string> = {
    '#FEF08A': '#F9F089',
    '#FEF3C7': '#F9F089',
    '#FFF9C5': '#F9F089',
    '#BBF7D0': '#C8F9D9',
    '#BAE6FD': '#CBEBFA',
    '#E9D5FF': '#EDDEFB',
    '#FBCFE8': '#FADAF1',
    '#FECACA': '#FADAF1',
    '#FFEDD5': '#FBDEC0',
  };

  const targetSwatch = aliases[upper] || upper;
  const match = NOTE_PALETTES.find((p) => p.swatch.toUpperCase() === targetSwatch);
  if (match) return match;

  const rgb = hexToRgb(hex);
  const isDark = rgb ? (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255 < 0.45 : true;

  if (isDark) {
    return {
      swatch: hex,
      name: 'Personalizado Escuro',
      headerBg: hex,
      bodyBg: hex,
      lineColor: 'rgba(255, 255, 255, 0.08)',
      headerFg: '#FAFAFA',
      bodyFg: '#FAFAFA',
      border: '#352824',
      isDark: true,
    };
  }

  return {
    swatch: hex,
    name: 'Personalizado Claro',
    headerBg: hex,
    bodyBg: lightenHex(hex, 0.15),
    lineColor: 'rgba(0, 0, 0, 0.10)',
    headerFg: '#18181B',
    bodyFg: '#18181B',
    border: hex,
    isDark: false,
  };
}
