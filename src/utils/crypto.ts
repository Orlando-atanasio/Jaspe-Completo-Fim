// JASPE — Núcleo criptográfico real (WebCrypto, sem dependências)
// REQ-17/18/27: AES-256-GCM + PBKDF2-SHA256 + SHA-256

const ITERATIONS = 210000;
const KEY_LEN = 256;

function bufToB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function b64ToBuf(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

// Copia p/ ArrayBuffer puro: WebCrypto (e checkers novos como TS 6.x)
// exigem BufferSource com ArrayBuffer exato, não ArrayBufferLike/view
// sobre SharedArrayBuffer. `new Uint8Array(len).buffer` é sempre ArrayBuffer.
function toPureBuffer(u8: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(u8.length);
  copy.set(u8);
  return copy.buffer;
}

function utf8ToBuf(str: string): Uint8Array<ArrayBuffer> {
  const enc = new TextEncoder().encode(str);
  const copy = new Uint8Array(enc.length);
  copy.set(enc);
  return copy;
}

function bufToUtf8(buf: ArrayBuffer): string {
  return new TextDecoder().decode(buf);
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', toPureBuffer(utf8ToBuf(text)));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function randomSaltB64(bytes = 16): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return bufToB64(a);
}

async function deriveAesKey(pin: string, saltB64: string): Promise<CryptoKey> {
  let salt: Uint8Array<ArrayBuffer>;
  try {
    salt = b64ToBuf(saltB64);
  } catch {
    throw new Error('Sal de derivação inválido ou corrompido.');
  }
  const base = await crypto.subtle.importKey('raw', toPureBuffer(utf8ToBuf(pin)), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: toPureBuffer(salt), iterations: ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: KEY_LEN },
    false,
    ['encrypt', 'decrypt']
  );
}

export interface EncryptedPayload {
  v: 3;
  alg: 'AES-256-GCM';
  kdf: 'PBKDF2-SHA256-210k';
  salt: string;
  iv: string;
  data: string;
  sha256: string;
}

export async function encryptJSON(pin: string, obj: unknown): Promise<EncryptedPayload> {
  const plain = JSON.stringify(obj);
  const hash = await sha256Hex(plain);
  const salt = randomSaltB64(16);
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const key = await deriveAesKey(pin, salt);
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: toPureBuffer(iv) }, key, toPureBuffer(utf8ToBuf(plain)));
  return { v: 3, alg: 'AES-256-GCM', kdf: 'PBKDF2-SHA256-210k', salt, iv: bufToB64(iv), data: bufToB64(cipher), sha256: hash };
}

export async function decryptJSON<T = unknown>(pin: string, payload: EncryptedPayload): Promise<T> {
  if (!payload || payload.v !== 3 || !payload.salt || !payload.iv || !payload.data) {
    throw new Error('Arquivo .jaspe inválido ou corrompido.');
  }
  const key = await deriveAesKey(pin, payload.salt);
  let plainBuf: ArrayBuffer;
  try {
    plainBuf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: toPureBuffer(b64ToBuf(payload.iv)) },
      key,
      toPureBuffer(b64ToBuf(payload.data))
    );
  } catch {
    throw new Error('PIN incorreto ou arquivo adulterado.');
  }
  const plain = bufToUtf8(plainBuf);
  const hash = await sha256Hex(plain);
  if (payload.sha256 && hash !== payload.sha256) {
    throw new Error('Falha de integridade (SHA-256 divergente).');
  }
  try {
    return JSON.parse(plain) as T;
  } catch {
    throw new Error('Backup descriptografado, mas conteúdo corrompido.');
  }
}

// Verificador de PIN para bootstrap (não armazena PIN, só salt+hash)
export async function createPinVerifier(pin: string): Promise<{ salt: string; hash: string; iter: number; createdAt: string }> {
  const salt = randomSaltB64(16);
  const base = await crypto.subtle.importKey('raw', toPureBuffer(utf8ToBuf(`jaspe-pin::${pin}`)), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: toPureBuffer(b64ToBuf(salt)), iterations: ITERATIONS, hash: 'SHA-256' }, base, 256);
  return { salt, hash: bufToB64(bits), iter: ITERATIONS, createdAt: new Date().toISOString() };
}

export async function verifyPin(pin: string, salt: string, expectedHash: string): Promise<boolean> {
  try {
    const base = await crypto.subtle.importKey('raw', toPureBuffer(utf8ToBuf(`jaspe-pin::${pin}`)), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: toPureBuffer(b64ToBuf(salt)), iterations: ITERATIONS, hash: 'SHA-256' }, base, 256);
    const computed = bufToB64(bits);
    if (computed.length !== expectedHash.length) return false;
    let diff = 0;
    for (let i = 0; i < computed.length; i++) {
      diff |= computed.charCodeAt(i) ^ expectedHash.charCodeAt(i);
    }
    return diff === 0;
  } catch {
    return false;
  }
}

// Gerador CSPRNG com rejection sampling (sem viés de módulo).
// `rnd % 78` favoreceria os primeiros valores (2^32 não é múltiplo de 78);
// aqui descartamos amostras >= floor(2^32/78)*78, garantindo distribuição uniforme.
export function generateStrongPassword(length = 16): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=';
  const n = Math.max(1, Math.min(128, Math.floor(length) || 16));
  const range = 0x100000000;
  const limit = Math.floor(range / chars.length) * chars.length;
  let out = '';
  const buf = new Uint32Array(32);
  while (out.length < n) {
    crypto.getRandomValues(buf);
    for (let i = 0; i < buf.length && out.length < n; i++) {
      const v = buf[i];
      if (v >= limit) continue; // rejeita p/ eliminar viés
      out += chars[v % chars.length];
    }
  }
  return out;
}

export function passwordStrength(pass: string): 'Fraca' | 'Razoável' | 'Forte' | 'Excelente' {
  let score = 0;
  if (pass.length >= 8) score++;
  if (pass.length >= 12) score++;
  if (/[a-z]/.test(pass) && /[A-Z]/.test(pass)) score++;
  if (/\d/.test(pass)) score++;
  if (/[^A-Za-z0-9]/.test(pass)) score++;
  if (score <= 2) return 'Fraca';
  if (score === 3) return 'Razoável';
  if (score === 4) return 'Forte';
  return 'Excelente';
}
