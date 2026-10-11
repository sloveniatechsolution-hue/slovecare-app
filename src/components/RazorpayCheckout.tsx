/**
 * RazorpayCheckout — Razorpay ka official checkout.js ek WebView ke andar.
 *
 * Flow:
 *   1. Backend create-order se keyId + orderId + amount (paise) aata hai.
 *   2. User yahan Razorpay sheet me pay karta hai.
 *   3. Success par 3 signatures (order/payment/signature) parent ko milte
 *      hain → parent backend /payments/verify ko bhejta hai (HMAC + Razorpay
 *      API double verification wahan server par hoti hai).
 *   4. User band kare to onDismiss, checkout load na ho to onError.
 *
 * NOTE: Payment karte waqt Razorpay deep links trigger karta hai (upi://,
 * intent://, wallet app links). WebView sirf http(s) chala sakta hai — koi
 * aur scheme load hui to crash: net::ERR_UNKNOWN_URL_SCHEME (-10).
 * Isliye sirf web URLs WebView me load hote hain, baaki bahar (app) khulti hain.
 *
 * Security: app me SIRF public keyId aata hai — KEY_SECRET kabhi nahi.
 * Amount server se aata hai, isliye client se tamper possible nahi.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import WebView, { type WebViewMessageEvent, type WebViewProps } from 'react-native-webview';
import Icon from './Icon';
import { colors, spacing, typography } from '../theme/theme';

export interface CheckoutOrder {
  keyId: string;
  orderId: string;
  amount: number; // paise
  currency: string;
  amountRupees: number;
}

export interface RazorpayCheckoutProps {
  visible: boolean;
  order: CheckoutOrder;
  prefill?: { name?: string; email?: string; contact?: string };
  /** Backend verify chal raha hai — UI block + close disable. */
  verifying: boolean;
  onResult: (signature: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => void;
  onDismiss: () => void;
  onError: (message: string) => void;
}

/** HTML me embed karne ke liye safe JSON — `</script>` injection rokta hai. */
const safeJson = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');

/** Event types WebViewProps se (package root sirf kuch hi types export karta hai). */
type ShouldStartEvent = Parameters<NonNullable<WebViewProps['onShouldStartLoadWithRequest']>>[0];
type CheckoutErrorEvent = Parameters<NonNullable<WebViewProps['onError']>>[0];

/**
 * Yeh schemes WebView ke andar load kar sakte hain. Baaki sab deep links
 * hain (upi://, intent://, phonepe:// …) jinhe WebView nahi chala sakta.
 */
const WEB_SAFE_SCHEME = /^(https?|about|blob|data|javascript):/i;

/**
 * `intent://pay?pa=..&pn=..#Intent;scheme=upi;package=..;end` → `upi://pay?pa=..&pn=..`
 * Android intent: URLs ko Linking samajhta nahi — andar wala scheme nikal ke
 * wahi deep link banate hain (yahi tarika Razorpay khud WebView docs me deta hai).
 */
const intentToSchemeUrl = (url: string): string => {
  const match = /^intent:\/\/([^#]*)(?:#Intent[;:]([\s\S]*))?$/.exec(url);
  if (!match) {
    return url;
  }
  const scheme = /(?:^|;)scheme=([^;]+)/.exec(match[2] || '')?.[1];
  return scheme ? `${scheme}://${match[1]}` : url;
};

/** Deep link hamesha WebView ke BAHAR kholo (UPI/wallet/bank app) — best-effort. */
const openExternally = (url: string) => {
  const target = /^intent:/i.test(url) ? intentToSchemeUrl(url) : url;
  try {
    Linking.openURL(target).catch(() => {
      // App installed nahi hai — user checkout par hi reh jayega (koi crash nahi).
    });
  } catch {
    // ignore — link na khulne par checkout waise bhi intact rehta hai
  }
};

function buildCheckoutHtml(
  order: CheckoutOrder,
  prefill: RazorpayCheckoutProps['prefill'],
): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>
  html, body { margin: 0; padding: 0; background: #ffffff; height: 100%; }
  body { display: flex; align-items: center; justify-content: center;
         font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  .boot { color: #64748b; font-size: 14px; }
</style>
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
</head>
<body>
<div class="boot">Preparing secure checkout…</div>
<script>
(function () {
  var post = function (data) {
    try { window.ReactNativeWebView.postMessage(JSON.stringify(data)); } catch (e) {}
  };
  var started = false;

  function boot() {
    if (started) return;
    if (typeof window.Razorpay !== 'function') {
      post({ type: 'error', message: 'Payment checkout could not load. Please check your internet connection and try again.' });
      return;
    }
    started = true;
    try {
      var rzp = new window.Razorpay({
        key: ${safeJson(order.keyId)},
        order_id: ${safeJson(order.orderId)},
        amount: ${safeJson(order.amount)},
        currency: ${safeJson(order.currency)},
        name: 'SloveCare',
        description: 'Booking payment',
        prefill: ${safeJson(prefill || {})},
        theme: { color: ${safeJson(colors.navy)} },
        handler: function (response) {
          post({
            type: 'success',
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature
          });
        },
        modal: {
          ondismiss: function () { post({ type: 'dismiss' }); }
        }
      });
      rzp.on('payment.failed', function (response) {
        // Checkout ke andar hi error + retry option dikhta hai — parent ko sirf bata do.
        post({
          type: 'failed',
          code: response.error && response.error.code,
          message: response.error && response.error.description
        });
      });
      rzp.open();
    } catch (e) {
      post({ type: 'error', message: 'Could not start the secure checkout. Please try again.' });
    }
  }

  if (document.readyState === 'complete') boot();
  else window.addEventListener('load', boot);
  // Agar CDN slow/blocked ho to user ko lamba "hang" na dikhe.
  setTimeout(boot, 9000);
})();
</script>
</body>
</html>`;
}

export default function RazorpayCheckout({
  visible,
  order,
  prefill,
  verifying,
  onResult,
  onDismiss,
  onError,
}: RazorpayCheckoutProps): React.JSX.Element | null {
  const [loadFailed, setLoadFailed] = useState(false);
  const [webKey, setWebKey] = useState(0);
  const retriesRef = useRef(0);
  const wasOpenRef = useRef(false);
  const html = useMemo(() => buildCheckoutHtml(order, prefill), [order, prefill]);

  // Sheet dobara khule to fresh state — purana error/retry na aaye
  // (iOS par Modal ke children mounted rehte hain, isliye WebView bhi naya chahiye).
  useEffect(() => {
    if (visible) {
      retriesRef.current = 0;
      setLoadFailed(false);
      if (wasOpenRef.current) {
        setWebKey((k) => k + 1);
      }
      wasOpenRef.current = true;
    } else {
      wasOpenRef.current = false;
    }
  }, [visible]);

  /**
   * Sirf web URLs WebView me load hone do. Deep links (upi://, intent:// …)
   * rok ke bahar app me kholo — warna Android WebView -10
   * (net::ERR_UNKNOWN_URL_SCHEME) de deta hai aur poora checkout mar jata hai.
   */
  const handleShouldStart = (event: ShouldStartEvent): boolean => {
    const url = String(event.url || '');
    if (WEB_SAFE_SCHEME.test(url)) {
      return true;
    }
    if (!verifying) {
      openExternally(url);
    }
    return false;
  };

  /** Main-frame load fail → ek-do baar fresh checkout HTML, phir friendly error. */
  const handleWebViewError = (event: CheckoutErrorEvent) => {
    const { code, description, url } = event.nativeEvent;
    console.warn(`[RazorpayCheckout] load failed: ${code} ${description} (${url})`);
    if (verifying) {
      return; // payment aa chuka — ab sirf RN-side verify chal raha hai
    }
    if (retriesRef.current < 2) {
      retriesRef.current += 1;
      setWebKey((k) => k + 1); // naya WebView = naya checkout HTML
      return;
    }
    if (!loadFailed) {
      setLoadFailed(true);
      onError('Payment checkout could not load. Please check your internet connection and try again.');
    }
  };

  const handleMessage = (event: WebViewMessageEvent) => {
    let data: Record<string, string> | null = null;
    try {
      data = JSON.parse(event.nativeEvent.data);
    } catch {
      return; // page ki koi aur message — ignore
    }
    if (!data || typeof data.type !== 'string') {
      return;
    }
    if (data.type === 'success') {
      onResult({
        razorpay_order_id: String(data.razorpay_order_id || ''),
        razorpay_payment_id: String(data.razorpay_payment_id || ''),
        razorpay_signature: String(data.razorpay_signature || ''),
      });
      return;
    }
    if (data.type === 'dismiss') {
      // Verify chal raha ho to dismiss ignore (payment ho chuka hai).
      if (!verifying) {
        onDismiss();
      }
      return;
    }
    if (data.type === 'error') {
      if (!loadFailed) {
        setLoadFailed(true);
        onError(String(data.message || 'Payment checkout failed. Please try again.'));
      }
      return;
    }
    // 'failed' → checkout sheet apne andar retry dikhata hai; kuch nahi karte.
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={() => {
        if (!verifying) {
          onDismiss();
        }
      }}
    >
      <View style={styles.container}>
        {/* Header — amount + band karne ka rasta */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.lockBadge}>
              <Icon name="lock" size={13} color="#FFFFFF" />
            </View>
            <View>
              <Text style={styles.headerTitle} numberOfLines={1}>
                Pay ₹{order.amountRupees}
              </Text>
              <Text style={styles.headerSub} numberOfLines={1}>
                Secure payment powered by Razorpay
              </Text>
            </View>
          </View>
          {!verifying ? (
            <Pressable
              accessibilityLabel="Close payment"
              hitSlop={10}
              onPress={onDismiss}
              style={styles.closeBtn}
            >
              <Icon name="x" size={18} color={colors.textSecondary} />
            </Pressable>
          ) : null}
        </View>

        <WebView
          key={webKey}
          source={{ html }}
          /* `*` = har navigation hamare handleShouldStart se guzre (whitelist
             fail hone par RN khud Linking chalata hai, jahan intent:// tut jata hai). */
          originWhitelist={['*']}
          onShouldStartLoadWithRequest={handleShouldStart}
          onError={handleWebViewError}
          javaScriptEnabled
          domStorageEnabled
          setSupportMultipleWindows={false}
          allowsInlineMediaPlayback
          style={styles.webview}
          onMessage={handleMessage}
        />

        {/* Verifying overlay — signature aane ke baad backend double-check */}
        {verifying ? (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.overlayTitle}>Verifying payment…</Text>
            <Text style={styles.overlaySub}>
              Payment received. Please don&apos;t close the app — we&apos;re confirming with Razorpay.
            </Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.card },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === 'ios' ? spacing.xl + 8 : spacing.lg + 6,
    paddingBottom: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  lockBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { ...typography.smallMedium, color: colors.text },
  headerSub: { ...typography.caption, color: colors.textSecondary },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.cardMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webview: { flex: 1, backgroundColor: colors.card },
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(255,255,255,0.97)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  overlayTitle: { ...typography.h4, color: colors.text, textAlign: 'center' },
  overlaySub: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 18,
  },
});
