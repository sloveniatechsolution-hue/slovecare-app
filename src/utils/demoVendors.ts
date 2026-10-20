/**
 * Seeded demo vendors — patient-facing listings se hata diye jaate hain.
 *
 * Backend par vendor delete karne ka koi route nahi hai (na patient ke liye,
 * na admin ke liye), isliye ye records DB me maujood rehte hain. App ke
 * listing API se filter karke hataye jaate hain, taaki patient ko fake
 * doctors/compounders na dikhein.
 *
 * ID shape:
 *   - Seed script  : `ven-doc-100001`, `ven-comp-100006`, `ven-care-100007`
 *                    (doctype + 6 digit fixed number)
 *   - Asli signup  : `ven-doct-261275` (type ka 4-char prefix + random number)
 *
 * NOTE: Jaise hi backend par proper delete/moderation route aa jaye, ye file
 * hata sakte ho — baare code me koi aur change nahi hoga.
 */

/** Seed script ke banaye hue staff records (labs is list me nahi hain). */
const SEEDED_STAFF_IDS = new Set([
  'ven-doc-999999', // Dr. Demo Doctor
  'ven-doc-100001', // Dr. Anil Mehta
  'ven-doc-100002', // Dr. Kavita Sharma
  'ven-doc-100003', // Dr. Rohit Vyas
  'ven-doc-100004', // Dr. Sneha Patni
  'ven-doc-100005', // Dr. Aarti Rathore
  'ven-comp-100006', // Ramesh Prajapat
  'ven-care-100007', // Sunita Devi
]);

/** Seed script ka numeric id pattern (doctype + 6 digit number). */
const SEEDED_ID_PATTERN = /^ven-(doc|comp|care)-\d{6}$/;

interface VendorLike {
  id?: string;
  type?: string;
}

/** Ye vendor seed/demo record hai? (patient listing me chhupana hai) */
export function isDemoVendor(vendor: VendorLike | null | undefined): boolean {
  const id = (vendor?.id ?? '').trim();
  if (!id) {
    return false;
  }
  if (SEEDED_STAFF_IDS.has(id)) {
    return true;
  }
  /* Labs public listing me rehti hain — sirf staff (doctor/compounder/
     caretaker/nurse) filter hota hai. */
  if (vendor?.type === 'lab') {
    return false;
  }
  return SEEDED_ID_PATTERN.test(id);
}

/** Listing se demo vendors hata do. */
export function withoutDemoVendors<T extends VendorLike>(list: T[]): T[] {
  return list.filter(item => !isDemoVendor(item));
}
