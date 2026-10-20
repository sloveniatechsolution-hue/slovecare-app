/**
 * Prescription Reader credits — rules test.
 *
 * Spec: pehli 3 reads FREE → phir ₹19 me 10 reads ka pack (repeatable).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CREDIT_PACK_PRICE_RUPEES,
  CREDIT_PACK_SIZE,
  FREE_READS_TOTAL,
  addPack,
  consumeRead,
  emptyCredits,
  freeRemaining,
  isExhausted,
  loadCredits,
  pricePerRead,
  readsUsed,
  saveCredits,
  storageKey,
  totalGranted,
  totalRemaining,
} from '../src/utils/prescriptionCredits';

describe('prescription credits — free quota', () => {
  it('naye user ko 3 free reads milte hain', () => {
    const credits = emptyCredits();
    expect(FREE_READS_TOTAL).toBe(3);
    expect(totalRemaining(credits)).toBe(3);
    expect(freeRemaining(credits)).toBe(3);
    expect(isExhausted(credits)).toBe(false);
  });

  it('3 reads use karne ke baad credits khatam ho jaate hain', () => {
    let credits = emptyCredits();
    for (let i = 0; i < 3; i += 1) {
      const result = consumeRead(credits);
      expect(result.consumed).toBe(true);
      expect(result.source).toBe('free');
      credits = result.credits;
    }
    expect(totalRemaining(credits)).toBe(0);
    expect(isExhausted(credits)).toBe(true);
    expect(readsUsed(credits)).toBe(3);
  });

  it('credits khatam hone par consume nahi hota', () => {
    let credits = emptyCredits();
    credits = consumeRead(credits).credits;
    credits = consumeRead(credits).credits;
    credits = consumeRead(credits).credits;
    const blocked = consumeRead(credits);
    expect(blocked.consumed).toBe(false);
    expect(blocked.source).toBeNull();
    expect(totalRemaining(blocked.credits)).toBe(0);
  });
});

describe('prescription credits — paid pack (₹19 / 10 reads)', () => {
  it('pack add karne par 10 reads milte hain', () => {
    const credits = addPack(emptyCredits());
    expect(CREDIT_PACK_SIZE).toBe(10);
    expect(CREDIT_PACK_PRICE_RUPEES).toBe(19);
    expect(totalRemaining(credits)).toBe(13); // 3 free + 10 pack
    expect(credits.paidCredits).toBe(10);
  });

  it('pack ke reads pehle free, phir paid balance se consume hote hain', () => {
    let credits = addPack(emptyCredits());
    // Free reads pehle — yahan free 3 + pack 10 = 13 total.
    for (let i = 0; i < 3; i += 1) {
      const result = consumeRead(credits);
      expect(result.source).toBe('free');
      credits = result.credits;
    }
    const paid = consumeRead(credits);
    expect(paid.source).toBe('paid');
    expect(paid.credits.paidCredits).toBe(9);
  });

  it('pack top-up repeatable hai (dobara 10 reads)', () => {
    let credits = emptyCredits();
    credits = addPack(credits);
    credits = addPack(credits);
    expect(credits.paidCredits).toBe(20);
    expect(totalRemaining(credits)).toBe(23);
    expect(totalGranted(credits)).toBe(23);
  });

  it('per-read price ₹1.90 hota hai', () => {
    expect(pricePerRead()).toBe('₹1.90');
  });
});

describe('prescription credits — device storage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('credits save/load round-trip', async () => {
    const credits = addPack(emptyCredits());
    await saveCredits('user-1', credits);
    const loaded = await loadCredits('user-1');
    expect(loaded).toEqual(credits);
  });

  it('alag user ka alag ledger hota hai', async () => {
    await saveCredits('user-1', addPack(emptyCredits()));
    const guest = await loadCredits('guest');
    expect(totalRemaining(guest)).toBe(3);
    expect(storageKey('user-1')).not.toBe(storageKey('guest'));
  });

  it('corrupt value par fresh ledger milta hai', async () => {
    await AsyncStorage.setItem(storageKey('user-2'), '{not-json');
    const loaded = await loadCredits('user-2');
    expect(totalRemaining(loaded)).toBe(3);
  });
});
