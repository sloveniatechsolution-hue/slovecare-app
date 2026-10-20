/**
 * Prescription read-pack purchase — Razorpay + credit grant.
 *
 * Flow:
 *   1. POST /prescription/create-order → server Razorpay order (₹19 / 10 reads).
 *   2. Razorpay sheet me user pay karta hai (UI: `components/RazorpayCheckout`).
 *   3. POST /prescription/verify → signature verify + server side 10 reads grant.
 *   4. Local ledger update (device cache) + success callback.
 *
 * ⚠️ Backend ka billing route abhi live nahi hai. Tab tak device-ledger
 * fallback chalta hai (utils/prescriptionCredits.ts me flag) — pack device
 * par activate ho jaata hai, taaki flow test/demo ho sake. Route live hone
 * par wahi path server-authoritative ho jaata hai.
 */

import { useCallback, useState } from 'react';
import api, { isMissingRoute } from '../api/api';
import { CheckoutOrder, RazorpayCheckoutProps } from '../components/RazorpayCheckout';
import { useAuth } from '../context/AuthContext';
import { usePrescriptionCredits } from '../context/PrescriptionCreditsContext';
import {
  ALLOW_DEVICE_LEDGER_FALLBACK,
  CREDIT_PACK_PRICE_RUPEES,
  CREDIT_PACK_SIZE,
} from '../utils/prescriptionCredits';

export interface PrescriptionPackPurchase {
  /** Purchase start karo — order bana ke Razorpay sheet kholta hai. */
  purchase: () => Promise<void>;
  /** `<RazorpayCheckout {...checkoutProps} />` — screen ko render karna hai. */
  checkoutProps: RazorpayCheckoutProps & { visible: boolean };
  /** Order create / payment chal raha hai. */
  busy: boolean;
  /** Payment ho chuka, signature verify ho raha hai. */
  verifying: boolean;
  /** Payment / order ka error (user ko dikhana hai). */
  error: string | null;
  clearError: () => void;
  /** Pack kitne reads ka hai (UI copy ke liye). */
  packSize: number;
  packPriceRupees: number;
}

export function usePrescriptionPackPurchase(options?: {
  /** Pack activate hone par (payment verify ya fallback) — screen close karta hai. */
  onActivated?: () => void;
}): PrescriptionPackPurchase {
  const { user } = useAuth();
  const { grantPack, refresh } = usePrescriptionCredits();

  const [order, setOrder] = useState<CheckoutOrder | null>(null);
  const [busy, setBusy] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Order create — server decide karta hai amount (client tamper nahi kar sakta). */
  const purchase = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const created = await api.prescription.createCreditOrder();
      setOrder({
        keyId: created.keyId,
        orderId: created.orderId,
        amount: created.amount,
        currency: created.currency || 'INR',
        amountRupees: created.amountRupees,
      });
    } catch (e) {
      if (isMissingRoute(e) && ALLOW_DEVICE_LEDGER_FALLBACK) {
        /* Server billing route abhi live nahi — pack device par activate. */
        grantPack(CREDIT_PACK_SIZE);
        options?.onActivated?.();
        await refresh();
        return;
      }
      setError((e as Error).message || 'Could not start payment. Please try again.');
    } finally {
      setBusy(false);
    }
  }, [grantPack, refresh, options]);

  /** Payment signature verify + credit grant. */
  const onResult = useCallback(
    async (signature: {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    }) => {
      setVerifying(true);
      setError(null);
      try {
        await api.prescription.verifyCreditPayment(signature);
        grantPack(CREDIT_PACK_SIZE);
        setOrder(null);
        options?.onActivated?.();
        await refresh();
      } catch (e) {
        if (isMissingRoute(e) && ALLOW_DEVICE_LEDGER_FALLBACK) {
          /* Verify route bhi nahi hai — device ledger par activate. */
          grantPack(CREDIT_PACK_SIZE);
          setOrder(null);
          options?.onActivated?.();
          await refresh();
          return;
        }
        setError((e as Error).message || 'Payment verification failed. Please try again.');
      } finally {
        setVerifying(false);
      }
    },
    [grantPack, refresh, options],
  );

  const checkoutProps: RazorpayCheckoutProps & { visible: boolean } = {
    visible: Boolean(order),
    order: order ?? {
      keyId: '',
      orderId: '',
      amount: 0,
      currency: 'INR',
      amountRupees: 0,
    },
    prefill: user
      ? { name: user.name, email: user.email, contact: user.phone }
      : undefined,
    verifying,
    onResult,
    onDismiss: () => setOrder(null),
    onError: (message: string) => {
      setError(message);
      setOrder(null);
    },
  };

  return {
    purchase,
    checkoutProps,
    busy,
    verifying,
    error,
    clearError: () => setError(null),
    packSize: CREDIT_PACK_SIZE,
    packPriceRupees: CREDIT_PACK_PRICE_RUPEES,
  };
}

export default usePrescriptionPackPurchase;
