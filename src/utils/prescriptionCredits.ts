/**
 * Prescription Reader credits — "pehli 3 reads free, phir ₹19 me 10 reads".
 *
 * Product rules (spec):
 *   • Naye user ko 3 FREE prescription reads milte hain.
 *   • Free reads khatam hone par ₹19 ka "10 reads" pack lena padta hai.
 *   • Pack baar-baar lena allowed hai (top-up) — credits khatam hone par hi.
 *   • Credit sirf SUCCESSFUL analysis par consume hota hai (fail = wapas).
 *
 * Ledger do jagah rehta hai:
 *   1. DEVICE (AsyncStorage) — abhi ka source of truth, offline-safe.
 *   2. SERVER (GET /prescription/quota) — jaise hi backend route live hoga,
 *      server authoritative ho jaata hai aur device cache sirf fallback
 *      (offline / server down) ke liye rehta hai.
 *
 * Is file me koi UI nahi — sirf rules + storage. UI `components/` me hai.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

/* ------------------------------ plan / pricing ------------------------------ */

/** Har naye user ko milne wale free reads. */
export const FREE_READS_TOTAL = 3;

/** ₹19 pack me kitne reads milte hain. */
export const CREDIT_PACK_SIZE = 10;

/** Pack ki price (rupees). */
export const CREDIT_PACK_PRICE_RUPEES = 19;

/** Pack ki price (paise) — Razorpay amount unit. */
export const CREDIT_PACK_PRICE_PAISE = CREDIT_PACK_PRICE_RUPEES * 100;

/**
 * Server ka billing route (POST /prescription/create-order) abhi live nahi
 * hai. Is flag ke ON hone par pack device par activate ho jaata hai, taaki
 * flow abhi sehi demo/test ho sake. Backend route live hone par is flag ko
 * OFF kar do — server quota aa jaata hai to wahi authoritative ho jaata hai.
 */
export const ALLOW_DEVICE_LEDGER_FALLBACK = true;

/* --------------------------------- shape ----------------------------------- */

export interface PrescriptionCredits {
  /** Total free reads (default 3). */
  freeTotal: number;
  /** Kitne free reads already use ho chuke. */
  freeUsed: number;
  /** Paid pack se aayi total reads (saare packs mila kar). */
  paidGranted: number;
  /** Paid pack se aayi abhi bachi hui reads (balance). */
  paidCredits: number;
}

export const emptyCredits = (): PrescriptionCredits => ({
  freeTotal: FREE_READS_TOTAL,
  freeUsed: 0,
  paidGranted: 0,
  paidCredits: 0,
});

/* --------------------------------- rules ----------------------------------- */

/** Free reads ka bacha hua balance. */
export const freeRemaining = (credits: PrescriptionCredits): number =>
  Math.max(0, credits.freeTotal - credits.freeUsed);

/** Total bache hue reads (free + paid). */
export const totalRemaining = (credits: PrescriptionCredits): number =>
  freeRemaining(credits) + Math.max(0, credits.paidCredits);

/** Total kitne reads user ko mili (progress bar ke liye). */
export const totalGranted = (credits: PrescriptionCredits): number =>
  credits.freeTotal + Math.max(0, credits.paidGranted);

/** Total kitne reads use ho chuki. */
export const readsUsed = (credits: PrescriptionCredits): number =>
  credits.freeUsed + Math.max(0, credits.paidGranted - credits.paidCredits);

export const isExhausted = (credits: PrescriptionCredits): boolean =>
  totalRemaining(credits) <= 0;

/**
 * Ek read consume karo — pehle free, phir paid.
 * Credits khatam ho gaye to kuch nahi hota (consumed: false).
 */
export const consumeRead = (
  credits: PrescriptionCredits,
): { credits: PrescriptionCredits; consumed: boolean; source: 'free' | 'paid' | null } => {
  if (isExhausted(credits)) {
    return { credits, consumed: false, source: null };
  }
  if (freeRemaining(credits) > 0) {
    return {
      credits: { ...credits, freeUsed: credits.freeUsed + 1 },
      consumed: true,
      source: 'free',
    };
  }
  return {
    credits: { ...credits, paidCredits: Math.max(0, credits.paidCredits - 1) },
    consumed: true,
    source: 'paid',
  };
};

/** Paid pack add karo (payment verify hone ke baad). */
export const addPack = (
  credits: PrescriptionCredits,
  size: number = CREDIT_PACK_SIZE,
): PrescriptionCredits => {
  const pack = Math.max(0, size);
  return {
    ...credits,
    paidGranted: Math.max(0, credits.paidGranted) + pack,
    paidCredits: Math.max(0, credits.paidCredits) + pack,
  };
};

/* ------------------------------- device storage ----------------------------- */

const STORAGE_PREFIX = 'slovecare_rx_credits_v1';

/** Per-user key — logout/login par alag ledger (guest = shared device ledger). */
export const storageKey = (userId?: string | null): string =>
  `${STORAGE_PREFIX}:${userId && userId.trim() ? userId.trim() : 'guest'}`;

/** Stored JSON ko safe shape me coerce karo (corrupt value → fresh ledger). */
const sanitize = (raw: unknown): PrescriptionCredits => {
  const base = emptyCredits();
  if (!raw || typeof raw !== 'object') {
    return base;
  }
  const obj = raw as Partial<PrescriptionCredits>;
  const freeTotal = Number.isFinite(obj.freeTotal)
    ? Math.max(0, Math.floor(obj.freeTotal as number))
    : base.freeTotal;
  const freeUsed = Number.isFinite(obj.freeUsed)
    ? Math.max(0, Math.floor(obj.freeUsed as number))
    : 0;
  const paidCredits = Number.isFinite(obj.paidCredits)
    ? Math.max(0, Math.floor(obj.paidCredits as number))
    : 0;
  const paidGranted = Number.isFinite(obj.paidGranted)
    ? Math.max(paidCredits, Math.floor(obj.paidGranted as number))
    : paidCredits;
  return {
    freeTotal,
    freeUsed: Math.min(freeUsed, freeTotal),
    paidGranted,
    paidCredits: Math.min(paidCredits, paidGranted),
  };
};

export async function loadCredits(userId?: string | null): Promise<PrescriptionCredits> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    if (!raw) {
      return emptyCredits();
    }
    return sanitize(JSON.parse(raw));
  } catch {
    return emptyCredits();
  }
}

export async function saveCredits(
  userId: string | null | undefined,
  credits: PrescriptionCredits,
): Promise<void> {
  try {
    await AsyncStorage.setItem(storageKey(userId), JSON.stringify(credits));
  } catch {
    /* storage unavailable — credits in-memory rahenge, crash nahi hoga */
  }
}

/* ---------------------------------- copy ----------------------------------- */

/** Card / header me dikhne wala plan naam. */
export const planLabel = (credits: PrescriptionCredits): string =>
  credits.paidCredits > 0 ? 'Read pack' : 'Free plan';

/** Per-read cost (₹1.90) — pricing card me dikhta hai. */
export const pricePerRead = (
  priceRupees: number = CREDIT_PACK_PRICE_RUPEES,
  size: number = CREDIT_PACK_SIZE,
): string => `₹${(priceRupees / Math.max(1, size)).toFixed(2)}`;
