// Philippine sale calculation, shared by the POS preview and the server (which has the final say).
//
// Shelf prices always INCLUDE VAT (Consumer Act all-in pricing); nothing is added at checkout.
// - VAT-registered: the VAT inside the price is shown separately: VAT = vatable amount × 12/112.
// - Non-VAT: no VAT is shown. (The business pays 3% percentage tax quarterly; it is not on receipts.)
// Senior citizen / PWD discount on basic necessities & prime commodities (DTI-DA-DOE JAO 24-02):
//   5% of eligible items, WITHOUT VAT exemption, up to ₱2,500 of purchases (₱125 discount) per week.
import { round2 } from "./format";

export const VAT_RATE = 12;
export const SENIOR_DISCOUNT_RATE = 5;
export const SENIOR_WEEKLY_PURCHASE_CAP = 2500;
export const BUYER_INFO_THRESHOLD = 1000; // buyer name/address/TIN needed at ₱1,000+ for VAT-registered buyers

export type TaxLine = { price: number; quantity: number; vatExempt: boolean; seniorEligible: boolean };

export type TaxInput = {
  lines: TaxLine[];
  vatRegistered: boolean;
  discountType: "amount" | "percent";
  discountValue: number;
  senior: boolean; // a senior citizen / PWD discount is being applied
  seniorUsedThisWeek: number; // eligible purchases already counted this week for that ID
};

export type TaxResult = {
  subtotal: number; // VAT-inclusive total of all lines
  seniorEligible: number; // purchase amount counted toward the weekly cap
  seniorDiscount: number;
  discount: number;
  total: number;
  vatableSales: number; // net of VAT
  vat: number;
  vatExemptSales: number;
};

export function computeSale(input: TaxInput): TaxResult {
  const gross = input.lines.map((l) => round2(l.price * l.quantity));
  const subtotal = round2(gross.reduce((s, g) => s + g, 0));

  // Senior / PWD: 5% of eligible items, limited by what is left of this week's cap.
  const eligibleGross = input.senior
    ? round2(gross.reduce((s, g, i) => s + (input.lines[i].seniorEligible ? g : 0), 0))
    : 0;
  const capLeft = Math.max(0, SENIOR_WEEKLY_PURCHASE_CAP - input.seniorUsedThisWeek);
  const seniorEligible = round2(Math.min(eligibleGross, capLeft));
  const seniorDiscount = round2((seniorEligible * SENIOR_DISCOUNT_RATE) / 100);

  const afterSenior = round2(subtotal - seniorDiscount);
  const v = Math.max(0, input.discountValue || 0);
  const discount = round2(
    Math.min(input.discountType === "percent" ? (afterSenior * Math.min(v, 100)) / 100 : v, afterSenior),
  );
  const total = round2(afterSenior - discount);

  if (!input.vatRegistered) {
    return { subtotal, seniorEligible, seniorDiscount, discount, total, vatableSales: 0, vat: 0, vatExemptSales: 0 };
  }

  // Spread both discounts over the lines in proportion, to split the total into VATable and VAT-exempt.
  let exempt = 0;
  gross.forEach((g, i) => {
    const seniorShare = eligibleGross > 0 && input.lines[i].seniorEligible ? (seniorDiscount * g) / eligibleGross : 0;
    const afterLine = g - seniorShare;
    const final = afterSenior > 0 ? afterLine - (discount * afterLine) / afterSenior : 0;
    if (input.lines[i].vatExempt) exempt += final;
  });
  const vatExemptSales = round2(exempt);
  const vatableGross = round2(total - vatExemptSales);
  const vat = round2((vatableGross * VAT_RATE) / (100 + VAT_RATE));
  return {
    subtotal,
    seniorEligible,
    seniorDiscount,
    discount,
    total,
    vatableSales: round2(vatableGross - vat),
    vat,
    vatExemptSales,
  };
}

/** Monday 00:00 local time of the current week (the senior/PWD cap resets weekly). */
export function startOfWeek(d = new Date()) {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  s.setDate(s.getDate() - ((s.getDay() + 6) % 7));
  return s;
}

export function normalizeId(id: string) {
  return id.trim().toUpperCase().replace(/\s+/g, "");
}
