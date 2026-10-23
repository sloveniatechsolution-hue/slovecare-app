import { isDemoVendor, withoutDemoVendors } from '../src/utils/demoVendors';

describe('demoVendors filter', () => {
  it('filters out old seeded demo staff IDs', () => {
    expect(isDemoVendor({ id: 'ven-doc-999999', type: 'doctor' })).toBe(true);
    expect(isDemoVendor({ id: 'ven-doc-100001', type: 'doctor' })).toBe(true);
    expect(isDemoVendor({ id: 'ven-doc-100002', type: 'doctor' })).toBe(true);
    expect(isDemoVendor({ id: 'ven-doc-100005', type: 'doctor' })).toBe(true);
    expect(isDemoVendor({ id: 'ven-comp-100006', type: 'compounder' })).toBe(true);
    expect(isDemoVendor({ id: 'ven-care-100007', type: 'caretaker' })).toBe(true);
  });

  it('keeps real doctors from live backend and signup', () => {
    // Real doctors present in production backend
    expect(isDemoVendor({ id: 'ven-doc-200001', type: 'doctor' })).toBe(false);
    expect(isDemoVendor({ id: 'ven-doc-200002', type: 'doctor' })).toBe(false);
    expect(isDemoVendor({ id: 'ven-doc-200003', type: 'doctor' })).toBe(false);
    expect(isDemoVendor({ id: 'ven-doc-200004', type: 'doctor' })).toBe(false);
    expect(isDemoVendor({ id: 'ven-doc-200005', type: 'doctor' })).toBe(false);
    expect(isDemoVendor({ id: 'ven-doct-072382', type: 'doctor' })).toBe(false);
    expect(isDemoVendor({ id: 'ven-doct-261275', type: 'doctor' })).toBe(false);
  });

  it('never filters out labs', () => {
    expect(isDemoVendor({ id: 'ven-lab-100008', type: 'lab' })).toBe(false);
    expect(isDemoVendor({ id: 'ven-lab-100009', type: 'lab' })).toBe(false);
  });

  it('withoutDemoVendors retains all real doctors', () => {
    const list = [
      { id: 'ven-doc-100001', name: 'Fake Anil', type: 'doctor' },
      { id: 'ven-doc-200001', name: 'Dr. Naman Jain', type: 'doctor' },
      { id: 'ven-doc-200002', name: 'Dr. Suresh Rawal', type: 'doctor' },
      { id: 'ven-doc-200003', name: 'Dr. Aniket Mishra', type: 'doctor' },
      { id: 'ven-doc-200004', name: 'Dr. Suman Sahu', type: 'doctor' },
      { id: 'ven-doc-200005', name: 'Dr. Nimita Jaidev', type: 'doctor' },
      { id: 'ven-doct-072382', name: 'Dr. Sharda', type: 'doctor' },
    ];
    const filtered = withoutDemoVendors(list);
    expect(filtered).toHaveLength(6);
    expect(filtered.map(d => d.name)).toEqual([
      'Dr. Naman Jain',
      'Dr. Suresh Rawal',
      'Dr. Aniket Mishra',
      'Dr. Suman Sahu',
      'Dr. Nimita Jaidev',
      'Dr. Sharda',
    ]);
  });
});
