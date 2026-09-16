// JASPE — Finanças reais: cotações, CSV/Excel, Bola de Neve, parser de corretagem
// REQ-30/35/36/38 (motor determinístico mantido; só a camada de I/O fica real)
//
// Cadeia real de cotação:
//   1) Brapi — cobre B3. Sem token só libera 4 tickers de teste (PETR4,
//      MGLU3, VALE3, ITUB4); qualquer outro ativo B3 exige token configurado
//      pelo usuário na tela de Perfil (localStorage `jaspe_brapi_token`,
//      grátis em brapi.dev/dashboard). Sem token, o app ainda funciona —
//      só cai mais vezes pro passo 3.
//   2) CoinGecko — cripto em BRL, sem chave (rate-limit por IP, ok p/ uso pessoal)
//   3) Yahoo direto (Android nativo, via CapacitorHttp — bypassa CORS de
//      verdade) OU, no navegador/web, via proxy CORS público em cascata
//      (allorigins.win → cors.lol → codetabs.com), já que o Yahoo não expõe
//      Access-Control-Allow-Origin e é bloqueado direto por qualquer WebView/browser
//   4) cache local preservado — por último, throw (laudo exige preservar preço)

import { isNativePlatform } from './native';

export interface YahooResult { price: number; source: 'yahoo' | 'brapi' | 'coingecko' | 'cache' | 'simulado-offline'; asOf: string }

const BRAPI_TOKEN_KEY = 'jaspe_brapi_token';

// Token da Brapi configurável pelo usuário (tela de Perfil).
// Sem token, a Brapi só responde p/ 4 tickers de teste (PETR4, MGLU3, VALE3,
// ITUB4) — qualquer outro ativo B3 cai direto pro fallback via Yahoo/proxy,
// que é o elo mais frágil da cadeia. Guardar o token localmente (não em
// código) evita que ele "suma" numa atualização do app e permite ao próprio
// usuário trocar por um novo a qualquer momento, sem depender de nova build.
export function getBrapiToken(): string {
  try { return localStorage.getItem(BRAPI_TOKEN_KEY) || ''; } catch { return ''; }
}

export function setBrapiToken(token: string): void {
  try {
    const t = (token || '').trim();
    if (t) localStorage.setItem(BRAPI_TOKEN_KEY, t);
    else localStorage.removeItem(BRAPI_TOKEN_KEY);
  } catch {}
}

const brapiToken = (): string | null => {
  const t = getBrapiToken();
  return t || null;
};

function cacheKey(ticker: string): string {
  return `jaspe_lastquote_${ticker.trim().toUpperCase()}`;
}

function saveCache(ticker: string, price: number): void {
  try { localStorage.setItem(cacheKey(ticker), JSON.stringify({ price, asOf: new Date().toISOString() })); } catch {}
}

function readCache(ticker: string): YahooResult | null {
  try {
    const raw = localStorage.getItem(cacheKey(ticker));
    if (raw) {
      const { price, asOf } = JSON.parse(raw);
      if (Number.isFinite(price)) return { price, source: 'cache', asOf };
    }
  } catch {}
  return null;
}

// ── Validação de preço (anti-dado manipulado via proxy público) ──
// Rejeita: não-numérico, <=0, absurdo (>R$1bi), e variação implausível
// vs. cache (>20x p/ cima ou <1/20 p/ baixo — cobre splits até 20:1 sem
// envenenar o cache com dado de proxy comprometido).
function isValidPrice(p: unknown): p is number {
  return typeof p === 'number' && Number.isFinite(p) && p > 0 && p < 1_000_000_000;
}

function isPlausibleVsCache(ticker: string, price: number): boolean {
  const cached = readCache(ticker);
  if (!cached || !isValidPrice(cached.price)) return true;
  const ratio = price / cached.price;
  if (ratio < 0.05 || ratio > 20) {
    console.warn(`[jaspe] ${ticker} preço implausível ${price} vs cache ${cached.price} (ratio ${ratio.toFixed(2)}) — ignorado`);
    return false;
  }
  return true;
}

function acceptPrice(ticker: string, price: unknown): number | null {
  const p = Number(price);
  if (!isValidPrice(p)) return null;
  if (!isPlausibleVsCache(ticker, p)) return null;
  return p;
}

function errMsg(e: unknown): string {
  return (e as Error)?.message || 'fetch falhou';
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

function isB3(ticker: string): boolean {
  const t = ticker.trim().toUpperCase();
  return t.endsWith('.SA') || /^[A-Z]{4}\d{1,2}[FB]?$/.test(t);
}

// 1) Brapi — JSON: { results: [{ regularMarketPrice, symbol }] }
async function fetchBrapiPrice(ticker: string, timeoutMs: number, token: string | null): Promise<YahooResult> {
  let sym = ticker.trim().toUpperCase();
  if (sym.endsWith('.SA')) sym = sym.slice(0, -3);
  let url = `https://brapi.dev/api/quote/${encodeURIComponent(sym)}`;
  if (token) url += `?token=${encodeURIComponent(token)}`;
  const res = await fetchWithTimeout(url, timeoutMs);
  if (res.status === 429) throw new Error('brapi 429 (limite)');
  if (!res.ok) throw new Error(`brapi ${res.status}`);
  const j = await res.json();
  const row = j?.results?.[0];
  const price = acceptPrice(ticker, row?.regularMarketPrice);
  if (price == null) throw new Error('brapi sem preço válido');
  saveCache(ticker, price);
  return { price, source: 'brapi', asOf: new Date().toISOString() };
}

const COINGECKO_IDS: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', BNB: 'binancecoin',
  XRP: 'ripple', DOGE: 'dogecoin', ADA: 'cardano', TRX: 'tron',
  LINK: 'chainlink', MATIC: 'matic-network', AVAX: 'avalanche-2',
  LTC: 'litecoin', DOT: 'polkadot', ATOM: 'cosmos', NEAR: 'near',
  ARB: 'arbitrum', OP: 'optimism', SUI: 'sui', PEPE: 'pepe'
};

function coinGeckoId(ticker: string): string | null {
  let t = ticker.trim().toUpperCase().split('-')[0].split('/')[0];
  if (t.endsWith('USDT')) t = t.slice(0, -4);
  else if (t.endsWith('USD')) t = t.slice(0, -3);
  return COINGECKO_IDS[t] || null;
}

// 2) CoinGecko — cripto direto em BRL: { bitcoin: { brl: 123 } }
async function fetchCoinGeckoPrice(ticker: string, id: string, timeoutMs: number): Promise<YahooResult> {
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=brl`;
  const res = await fetchWithTimeout(url, timeoutMs);
  if (res.status === 429) throw new Error('coingecko 429 (limite)');
  if (!res.ok) throw new Error(`coingecko ${res.status}`);
  const j = await res.json();
  const price = acceptPrice(ticker, j?.[id]?.brl);
  if (price == null) throw new Error('coingecko sem preço válido');
  return { price, source: 'coingecko', asOf: new Date().toISOString() };
}

function yahooCandidates(ticker: string): string[] {
  const t = ticker.trim().toUpperCase();
  // B3: tenta .SA primeiro; cripto (BTC, ETH) tenta -USD; resto tenta direto
  const cands = [t];
  if (/^[A-Z]{4}\d{1,2}$/.test(t) && !t.endsWith('.SA')) cands.unshift(`${t}.SA`);
  if (/^(BTC|ETH|SOL|BNB|XRP|DOGE)/.test(t) && !t.includes('-')) cands.unshift(`${t}-USD`);
  return [...new Set(cands)];
}

// Testa um token da Brapi de verdade (chamada real, não só formato do texto).
// Usa WEGE3 de propósito: NÃO está entre os 4 tickers liberados sem token
// (PETR4/MGLU3/VALE3/ITUB4), então só responde com preço se o token for
// aceito pela Brapi — evita o falso-positivo de "token válido" quando na
// verdade só os tickers de teste é que estariam funcionando de graça.
export async function testBrapiToken(token: string, timeoutMs = 10000): Promise<{ ok: boolean; message: string }> {
  const trimmed = (token || '').trim();
  if (!trimmed) return { ok: false, message: 'Cole um token antes de testar.' };
  try {
    const url = `https://brapi.dev/api/quote/WEGE3?token=${encodeURIComponent(trimmed)}`;
    const res = await fetchWithTimeout(url, timeoutMs);
    if (res.status === 401) return { ok: false, message: 'Token inválido, incorreto ou expirado (401).' };
    if (res.status === 402) return { ok: false, message: 'Limite do plano Brapi excedido (402) — token é válido, mas a cota do mês acabou.' };
    if (res.status === 429) return { ok: false, message: 'Muitas tentativas agora (429) — aguarde um instante e teste de novo.' };
    if (!res.ok) return { ok: false, message: `Brapi respondeu com erro (${res.status}).` };
    const j = await res.json();
    const price = j?.results?.[0]?.regularMarketPrice;
    if (typeof price === 'number' && Number.isFinite(price) && price > 0) {
      return { ok: true, message: `Token válido! WEGE3 = R$ ${price.toFixed(2)} agora.` };
    }
    return { ok: false, message: 'A Brapi aceitou a chamada, mas não devolveu um preço válido — confira o plano na sua conta.' };
  } catch (e) {
    return { ok: false, message: `Falha de rede ao testar o token: ${errMsg(e)}` };
  }
}

export async function fetchYahooPrice(ticker: string, timeoutMs = 15000): Promise<YahooResult> {
  const errors: string[] = [];
  const t = ticker.trim().toUpperCase();
  const token = brapiToken();
  console.info(`[jaspe] cotação: ${t}`);

  // 1) Brapi (B3 grátis sem token; com token vale p/ tudo)
  if (isB3(t) || token) {
    try {
      const r = await fetchBrapiPrice(t, timeoutMs, token);
      console.info(`[jaspe] ${t} OK via brapi: ${r.price}`);
      return r;
    } catch (e) {
      console.warn(`[jaspe] ${t} brapi falhou: ${errMsg(e)}`);
      errors.push(`brapi: ${errMsg(e)}`);
    }
  }

  // 2) CoinGecko p/ cripto mapeada (BRL, sem chave)
  const cgId = coinGeckoId(t);
  if (cgId) {
    try {
      const r = await fetchCoinGeckoPrice(t, cgId, timeoutMs);
      saveCache(ticker, r.price);
      console.info(`[jaspe] ${t} OK via coingecko: ${r.price}`);
      return r;
    } catch (e) {
      console.warn(`[jaspe] ${t} coingecko falhou: ${errMsg(e)}`);
      errors.push(`coingecko: ${errMsg(e)}`);
    }
  }

  // 3) Yahoo. No Android nativo (CapacitorHttp ligado em capacitor.config.ts)
  // a chamada sai pela ponte nativa, não pela WebView — CORS não se aplica,
  // então dá pra bater direto no Yahoo sem depender de proxy de terceiro.
  // No navegador/web isso é impossível (CORS bloqueia), daí a cascata de
  // proxies públicos como único caminho restante ali.
  // NOTA: proxies são terceiros não controlados — preço só é aceito após
  // validação de estrutura (symbol/meta) + plausibilidade vs cache; proxy
  // que servir dado manipulado é descartado sem envenenar o cache.
  const YAHOO_PROXIES: ((u: string) => string)[] = isNativePlatform()
    ? [(u) => u] // direto, sem proxy — só funciona de fato dentro do APK (CapacitorHttp)
    : [
        (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
        (u) => `https://api.cors.lol/?url=${encodeURIComponent(u)}`,
        (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
      ];
  const viaNative = isNativePlatform();
  for (const sym of yahooCandidates(t)) {
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1d`;
    let symbolDead = false;
    for (let pi = 0; pi < YAHOO_PROXIES.length && !symbolDead; pi++) {
      const via = viaNative ? 'direto' : `proxy${pi + 1}`;
      try {
        const url = YAHOO_PROXIES[pi](yahooUrl);
        console.info(`[jaspe] ${t} tentando yahoo ${viaNative ? 'direto (nativo)' : `via proxy ${pi + 1}`}: ${sym}`);
        const res = await fetchWithTimeout(url, Math.min(timeoutMs, 10000));
        if (res.status === 429) { errors.push(`${sym}: 429 (${via})`); continue; }
        if (!res.ok) { errors.push(`${sym}: ${via} ${res.status}`); continue; }
        let j: unknown;
        try { j = await res.json(); } catch { errors.push(`${sym}: ${via} JSON inválido`); continue; }
        const meta = (j as { chart?: { result?: { meta?: { regularMarketPrice?: unknown; symbol?: unknown } }[]; error?: unknown } })?.chart?.result?.[0]?.meta;
        if (!meta || typeof meta !== 'object') { errors.push(`${sym}: ${via} envelope inesperado`); continue; }
        // Integridade mínima: o símbolo retornado deve ser o pedido.
        const gotSym = String((meta as { symbol?: unknown }).symbol || '').toUpperCase();
        if (gotSym && gotSym !== sym.toUpperCase()) { errors.push(`${sym}: símbolo divergente (${gotSym})`); continue; }
        const price = acceptPrice(ticker, (meta as { regularMarketPrice?: unknown }).regularMarketPrice);
        if (price != null) {
          saveCache(ticker, price);
          console.info(`[jaspe] ${t} OK via yahoo (${via}): ${price}`);
          return { price, source: 'yahoo', asOf: new Date().toISOString() };
        }
        // Preço inválido/implausível: tenta próxima opção, NÃO marca symbolDead
        // (pode ser proxy manipulado, não símbolo inexistente).
        errors.push(`${sym}: preço inválido/implausível (${via})`);
      } catch (e) {
        console.warn(`[jaspe] ${t} yahoo ${sym} ${via} falhou: ${errMsg(e)}`);
        errors.push(`${sym}: ${via} ${errMsg(e)}`);
      }
    }
  }
  // 4) Preserva última cotação (exigência do laudo)
  const cached = readCache(ticker);
  if (cached) {
    console.info(`[jaspe] ${t} usando cache: ${cached.price}`);
    return cached;
  }
  console.error(`[jaspe] ${t} FALHA TOTAL: ${errors.join('; ') || 'offline'}`);
  throw new Error(`Cotação indisponível para ${ticker} (${errors.join('; ') || 'offline'})`);
}

// Export unidirecional JASPE → Planilha (CSV + XLS via HTML-table). Sem dependências.
export function assetsToCSV(rows: { ticker: string; name: string; cnpj: string; qty: number; avgPrice: number; currentPrice: number; category: string }[]): string {
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = 'ticker;name;cnpj;qty;avgPrice;currentPrice;total;category';
  const lines = rows.map((a) => [
    esc(a.ticker), esc(a.name), esc(a.cnpj), String(a.qty),
    String(a.avgPrice).replace('.', ','), String(a.currentPrice).replace('.', ','),
    String((a.qty * a.currentPrice).toFixed(2)).replace('.', ','), esc(a.category)
  ].join(';'));
  return `\uFEFF${head}\n${lines.join('\n')}\n`;
}

export function assetsToXLS(tickerRows: { ticker: string; name: string; cnpj: string; qty: number; avgPrice: number; currentPrice: number; category: string }[]): string {
  const td = (v: unknown) => `<td>${String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')}</td>`;
  const tr = tickerRows.map((a) => `<tr>${td(a.ticker)}${td(a.name)}${td(a.cnpj)}${td(a.qty)}${td(a.avgPrice)}${td(a.currentPrice)}${td((a.qty * a.currentPrice).toFixed(2))}${td(a.category)}</tr>`).join('');
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"/></head><body><table border="1"><tr><th>ticker</th><th>name</th><th>cnpj</th><th>qty</th><th>avgPrice</th><th>currentPrice</th><th>total</th><th>category</th></tr>${tr}</table></body></html>`;
}

// Simulador Bola de Neve (P1): aporte mensal + yield reinvestido
export interface SnowballPoint { year: number; invested: number; balance: number; dividends: number }
export function simulateSnowball(opts: { initial: number; monthly: number; annualYieldPct: number; years: number }): SnowballPoint[] {
  const y = Math.max(0, Number(opts.annualYieldPct) || 0);
  const monthly = Math.max(0, Number(opts.monthly) || 0);
  const start = Math.max(0, Number(opts.initial) || 0);
  const totalYears = Math.max(0, Math.min(40, Math.floor(Number(opts.years) || 0)));
  const r = Math.pow(1 + y / 100, 1 / 12) - 1;
  let balance = start;
  let invested = start;
  let dividends = 0;
  const out: SnowballPoint[] = [{ year: 0, invested, balance, dividends }];
  for (let yy = 1; yy <= totalYears; yy++) {
    for (let mm = 0; mm < 12; mm++) {
      const gain = balance * r;
      dividends += gain;
      balance += gain + monthly;
      invested += monthly;
    }
    out.push({ year: yy, invested: round2(invested), balance: round2(balance), dividends: round2(dividends) });
  }
  return out;
}
function round2(n: number) { return Math.round(n * 100) / 100; }

// Preço BR ("36,03", "1.234,56") ou US ("36.03"): ponto só é milhar se houver vírgula
function parsePrice(raw: string): number {
  const t = (raw || '').trim();
  if (t.includes(',')) return Number(t.replace(/\./g, '').replace(',', '.'));
  return Number(t);
}

// Parser determinístico de nota de corretagem em texto (B3 / Sinacor / XP / Clear / NuInvest / BTG / Rico / Inter etc.)
export interface ParsedTrade { ticker: string; qty: number; price: number }
export function parseBrokerageText(text: string): ParsedTrade[] {
  const out: ParsedTrade[] = [];
  // Remove acentos e caracteres invisíveis para compatibilidade universal
  const norm = (text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u00a0/g, ' ')
    .toUpperCase();

  // Limpa sufixo fracionário 'F' (ex: VALE3F -> VALE3, CSMG3F -> CSMG3) mantendo ticker padrão
  const cleanTicker = (t: string) => {
    let sym = (t || '').trim().toUpperCase();
    if (/^[A-Z]{4}\d{1,2}F$/.test(sym)) {
      sym = sym.slice(0, -1);
    }
    return sym;
  };

  // 1. Padrão de Notas com Resumo por Ativo (como no print do usuário):
  // Ex: "CSMG3F - COPASA ON NM ... QUANT. TOTAL DE COMPRA: 5 ... PRECO MEDIO COMPRA: R$ 20,9900"
  const reSummary = /\b([A-Z]{4}\d{1,2}[FB]?)\b.{0,180}?QUANT\.?\s*TOTAL\s*(?:DE\s*)?COMPRA\s*[:=\-]?\s*(\d{1,7}).{0,100}?PRECO\s*MEDIO\s*(?:COMPRA)?\s*[:=\-]?\s*(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2,4}|\d+[.,]\d{2,4})/gi;
  let sm: RegExpExecArray | null;
  while ((sm = reSummary.exec(norm)) !== null) {
    const ticker = cleanTicker(sm[1]);
    const qty = Number(sm[2]);
    const price = parsePrice(sm[3]);
    if (ticker && qty > 0 && price > 0) {
      out.push({ ticker, qty, price });
    }
  }

  // 2. Padrão de linhas da tabela operacional da B3 (C / COMPRA):
  // Ex: "COMPRA B3 RV LISTADO 5 R$20,99" associado ao Ticker do bloco anterior
  if (out.length === 0) {
    // Tenta encontrar blocos por Ticker e suas operações
    const blocks = norm.split(/\b([A-Z]{4}\d{1,2}[FB]?)\s*-\s*[A-Z ]+/g);
    if (blocks.length > 2) {
      for (let i = 1; i < blocks.length; i += 2) {
        const ticker = cleanTicker(blocks[i]);
        const blockContent = blocks[i + 1] || '';
        // Procura compra na tabela do bloco
        const reOp = /\b(?:COMPRA|C)\b.{0,60}?(\d{1,7})\s*(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+[.,]\d{2})/gi;
        let opm: RegExpExecArray | null;
        while ((opm = reOp.exec(blockContent)) !== null) {
          const qty = Number(opm[1]);
          const price = parsePrice(opm[2]);
          if (ticker && qty > 0 && price > 0 && qty < 10000000) {
            out.push({ ticker, qty, price });
          }
        }
      }
    }
  }

  // 3. Padrão de linhas diretas: Ticker + Qtd + Preço (ex: TAEE11 400 36,03 ou VALE3F ... 10 ... R$ 61,49)
  if (out.length === 0) {
    const re = /\b([A-Z]{4}\d{1,2}[FB]?)\b[^0-9]{0,40}(\d{1,7})\s*[-X/ ]\s*(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+[.,]\d{2})/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(norm)) !== null) {
      const ticker = cleanTicker(m[1]);
      const qty = Number(m[2]);
      const price = parsePrice(m[3]);
      if (ticker && qty > 0 && price > 0 && qty < 10000000) {
        out.push({ ticker, qty, price });
      }
    }
  }

  // 4. Fallback: Procura Ticker e dois números próximos (Qtd e Preço)
  if (out.length === 0) {
    const reFallback = /\b([A-Z]{4}\d{1,2}[FB]?)\b.{0,60}?(\d{1,7}).{0,30}?(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+[.,]\d{2})/g;
    let fm: RegExpExecArray | null;
    while ((fm = reFallback.exec(norm)) !== null) {
      const ticker = cleanTicker(fm[1]);
      const qty = Number(fm[2]);
      const price = parsePrice(String(fm[3]));
      if (ticker && qty > 0 && qty < 10000000 && price > 0 && price < 1000000) {
        out.push({ ticker, qty, price });
      }
      if (out.length >= 10) break;
    }
  }

  // 5. Consolidação e Eliminação de Duplicidades:
  // Se a mesma ação foi comprada em lotes/ordens fracionadas (ex: 68 + 23 + 1 de KLBN4),
  // consolida em uma única linha com a quantidade total somada e o preço médio ponderado correto.
  const consolidated = new Map<string, { ticker: string; totalQty: number; totalInvested: number }>();

  for (const item of out) {
    const t = item.ticker;
    if (!t || item.qty <= 0 || item.price <= 0) continue;

    if (!consolidated.has(t)) {
      consolidated.set(t, {
        ticker: t,
        totalQty: item.qty,
        totalInvested: item.qty * item.price
      });
    } else {
      const cur = consolidated.get(t)!;
      cur.totalQty += item.qty;
      cur.totalInvested += item.qty * item.price;
    }
  }

  const finalTrades: ParsedTrade[] = Array.from(consolidated.values()).map((c) => ({
    ticker: c.ticker,
    qty: c.totalQty,
    price: Number((c.totalInvested / c.totalQty).toFixed(2))
  }));

  return finalTrades.slice(0, 30);
}
