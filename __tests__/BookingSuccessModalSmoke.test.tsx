/**
 * @format
 */

/**
 * BookingSuccessModal smoke test — booking confirm hone wala premium card
 * (animated tick + booking details) jest me bina crash render hota hai.
 *
 * Notes:
 *  - RN ka `Modal` (native host view) aur `SafeAreaProvider` jest me apne
 *    children render nahi karte, isliye safe-area halka mock hota hai aur
 *    card (`BookingSuccessCard`) alag se export hoke test hota hai.
 *  - Har test ke baad tree unmount hota hai — animated loop (tick pulse)
 *    warna teardown ke baad bhi timer fire karta rehta hai.
 */

jest.mock('react-native-safe-area-context', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    SafeAreaProvider: ({ children }: { children?: unknown }) =>
      ReactActual.createElement(View, null, children),
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { BookingSuccessCard } from '../src/components/BookingSuccessModal';
import BookingSuccessModal from '../src/components/BookingSuccessModal';

const INFO = {
  serviceName: 'Dr. Ramesh Verma',
  providerName: 'General Physician • MBBS, MD',
  serviceTypeLabel: 'Home Visit',
  patientName: 'Amit Kumar',
  patientPhone: '+91 98765 43210',
  date: '2026-01-14',
  timeSlot: '10:30 AM',
  amount: 499,
  bookingId: 'SLV-9F2K71',
};

/** Mount → callback → assert-friendly teardown (animations band). */
async function renderCard(element: React.ReactElement): Promise<string> {
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(element);
  });
  const json = JSON.stringify(tree?.toJSON() ?? null);
  await ReactTestRenderer.act(() => {
    tree?.unmount();
  });
  return json;
}

test('BookingSuccessCard renders booking details (ribbon + rows + amount)', async () => {
  const json = await renderCard(
    <BookingSuccessCard
      info={INFO}
      onPrimary={() => {}}
      onSecondary={() => {}}
      primaryLabel="View Appointments"
    />,
  );

  expect(json).toContain('Booking Confirmed');
  expect(json).toContain('Payment Verified');
  expect(json).toContain('Dr. Ramesh Verma');
  expect(json).toContain('General Physician');
  expect(json).toContain('Home Visit');
  expect(json).toContain('Amit Kumar');
  expect(json).toContain('10:30 AM');
  expect(json).toContain('₹499');
  expect(json).toContain('SLV-9F2K71');
  expect(json).toContain('View Appointments');
});

test('BookingSuccessCard free booking shows FREE + Free badge', async () => {
  const json = await renderCard(
    <BookingSuccessCard info={{ serviceName: 'Follow-up Chat', date: '2026-01-14', timeSlot: '09:00 AM', amount: 0 }} />,
  );
  expect(json).toContain('FREE');
  expect(json).toContain('Free');
  expect(json).not.toContain('₹0');
});

test('BookingSuccessModal hidden par kuch render nahi karta', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<BookingSuccessModal visible={false} info={INFO} />);
  });
  expect(tree?.root.findAllByType(BookingSuccessModal).length).toBe(1);
  expect(tree?.toJSON()).toBeNull();
  await ReactTestRenderer.act(() => {
    tree?.unmount();
  });
});
