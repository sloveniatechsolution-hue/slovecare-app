/**
 * Prescription Reader credits — app-wide provider.
 *
 * Kya karta hai:
 *   • Device ledger (AsyncStorage) se balance load/persist karta hai.
 *   • Backend quota route live ho to server ka balance authoritative bana deta hai.
 *   • Reader screen par "kitne reads bache" live update hota hai.
 *
 * Rules (spec): 3 free reads → phir ₹19 me 10 reads ka pack (repeatable).
 * Details + storage: `utils/prescriptionCredits.ts`.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import api, { PrescriptionQuota } from '../api/api';
import { useAuth } from './AuthContext';
import {
  CREDIT_PACK_PRICE_RUPEES,
  CREDIT_PACK_SIZE,
  PrescriptionCredits,
  addPack,
  consumeRead,
  emptyCredits,
  freeRemaining,
  isExhausted,
  loadCredits,
  saveCredits,
  totalRemaining,
} from '../utils/prescriptionCredits';

interface PrescriptionCreditsValue {
  /** Current ledger (free + paid balance). */
  credits: PrescriptionCredits;
  /** Total bache hue reads. */
  remaining: number;
  /** Free reads ka bacha hua balance. */
  freeLeft: number;
  /** Paid pack se aaye reads ka balance. */
  paidLeft: number;
  /** true = abhi ledger load ho raha hai. */
  loading: boolean;
  /** true = server quota route live hai (server authoritative). */
  serverBacked: boolean;
  /** Pack size (10 reads). */
  packSize: number;
  /** Pack price (₹19). */
  packPriceRupees: number;
  /** Kya abhi ek read chal sakti hai? */
  canAnalyze: boolean;
  /** Ek read consume karo — success = true, credits khatam = false. */
  consumeRead(): boolean;
  /** Payment verify hone ke baad pack add karo. */
  grantPack(size?: number): void;
  /** Analyze response ke saath aaya server quota — ledger sync. */
  applyServerQuota(quota: PrescriptionQuota): void;
  /** Server se quota dobara fetch karo (pull-to-refresh / screen focus). */
  refresh(): Promise<void>;
}

const PrescriptionCreditsContext = createContext<PrescriptionCreditsValue | undefined>(undefined);

/** Server quota payload ko device-ledger shape me map karo. */
const fromServerQuota = (
  quota: PrescriptionQuota,
  local: PrescriptionCredits,
): PrescriptionCredits => {
  const freeTotal = Number.isFinite(quota.freeTotal)
    ? Math.max(0, Math.floor(quota.freeTotal as number))
    : local.freeTotal;
  const freeUsed = Number.isFinite(quota.freeRemaining)
    ? Math.max(0, freeTotal - Math.floor(quota.freeRemaining as number))
    : local.freeUsed;
  const paidCredits = Number.isFinite(quota.paidRemaining)
    ? Math.max(0, Math.floor(quota.paidRemaining as number))
    : local.paidCredits;
  return {
    freeTotal,
    freeUsed: Math.min(freeUsed, freeTotal),
    /* Server sirf balance batata hai — granted count local se rakho (>= balance). */
    paidGranted: Math.max(local.paidGranted, paidCredits),
    paidCredits,
  };
};

export function PrescriptionCreditsProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [credits, setCredits] = useState<PrescriptionCredits>(emptyCredits);
  const [loading, setLoading] = useState(true);
  const [serverBacked, setServerBacked] = useState(false);

  /** Latest credits — consume/grant me stale state na mile (async handlers). */
  const creditsRef = useRef<PrescriptionCredits>(credits);
  useEffect(() => {
    creditsRef.current = credits;
  }, [credits]);

  const persist = useCallback(
    (next: PrescriptionCredits) => {
      creditsRef.current = next;
      setCredits(next);
      saveCredits(userId, next);
    },
    [userId],
  );

  /* ---------------------- device ledger (offline-safe) --------------------- */

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const local = await loadCredits(userId);
      if (!alive) {
        return;
      }
      creditsRef.current = local;
      setCredits(local);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

  /* ------------------------ server quota (best effort) --------------------- */

  const refresh = useCallback(async () => {
    try {
      const quota = await api.prescription.quota();
      const next = fromServerQuota(quota, creditsRef.current);
      setServerBacked(true);
      persist(next);
    } catch {
      // Server route nahi hai ya network down — device ledger hi source of truth.
      setServerBacked(false);
    }
  }, [persist]);

  /**
   * Analyze response ke saath aaya quota (server authoritative) — ledger
   * update. Server hi credit kaata hai, client sirf sync karta hai.
   */
  const applyServerQuota = useCallback(
    (quota: PrescriptionQuota) => {
      setServerBacked(true);
      persist(fromServerQuota(quota, creditsRef.current));
    },
    [persist],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  /* ------------------------------ actions --------------------------------- */

  /** Ek read consume karo — credits khatam ho to false (kuch nahi hota). */
  const consume = useCallback((): boolean => {
    const result = consumeRead(creditsRef.current);
    if (!result.consumed) {
      return false;
    }
    persist(result.credits);
    return true;
  }, [persist]);

  /** Payment verify hone ke baad pack add karo. */
  const grant = useCallback(
    (size: number = CREDIT_PACK_SIZE) => {
      persist(addPack(creditsRef.current, size));
    },
    [persist],
  );

  const value = useMemo<PrescriptionCreditsValue>(
    () => ({
      credits,
      remaining: totalRemaining(credits),
      freeLeft: freeRemaining(credits),
      paidLeft: Math.max(0, credits.paidCredits),
      loading,
      serverBacked,
      packSize: CREDIT_PACK_SIZE,
      packPriceRupees: CREDIT_PACK_PRICE_RUPEES,
      canAnalyze: !isExhausted(credits),
      consumeRead: consume,
      grantPack: grant,
      applyServerQuota,
      refresh,
    }),
    [credits, loading, serverBacked, consume, grant, applyServerQuota, refresh],
  );

  return (
    <PrescriptionCreditsContext.Provider value={value}>
      {children}
    </PrescriptionCreditsContext.Provider>
  );
}

/** Credits ka hook — provider ke andar hi use hona chahiye. */
export function usePrescriptionCredits(): PrescriptionCreditsValue {
  const ctx = useContext(PrescriptionCreditsContext);
  if (!ctx) {
    throw new Error('usePrescriptionCredits must be used inside PrescriptionCreditsProvider');
  }
  return ctx;
}

export default PrescriptionCreditsProvider;
