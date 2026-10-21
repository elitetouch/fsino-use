/**
 * Currencies a farm here actually transacts in.
 *
 * WHY A LIST AND NOT A FREE-TEXT BOX. Currency is the most groupable
 * field in the app — every total, every report, every "what did this
 * cost" is summed by it — and a three-character input invites "ngn",
 * "NGN ", "NG" and "N". The first three all survive a size:3
 * validation, and then the expenses page shows four separate totals
 * for one currency and the farmer concludes the arithmetic is broken.
 *
 * Naira first because that is where nearly every farm is. The rest of
 * West and East Africa follows, then the two currencies an exporter
 * invoices in. Deliberately short: a picker nobody can scan is its own
 * kind of friction, and anything missing is a one-line addition.
 */
export type CurrencyOption = {
  code: string;
  label: string;
  symbol: string;
};

export const CURRENCIES: CurrencyOption[] = [
  { code: 'NGN', label: 'Nigerian Naira', symbol: '₦' },
  { code: 'GHS', label: 'Ghanaian Cedi', symbol: 'GH₵' },
  { code: 'KES', label: 'Kenyan Shilling', symbol: 'KSh' },
  { code: 'UGX', label: 'Ugandan Shilling', symbol: 'USh' },
  { code: 'TZS', label: 'Tanzanian Shilling', symbol: 'TSh' },
  { code: 'ZAR', label: 'South African Rand', symbol: 'R' },
  { code: 'XOF', label: 'West African CFA Franc', symbol: 'CFA' },
  { code: 'USD', label: 'US Dollar', symbol: '$' },
  { code: 'EUR', label: 'Euro', symbol: '€' },
  { code: 'GBP', label: 'Pound Sterling', symbol: '£' },
];

export const DEFAULT_CURRENCY = 'NGN';

/** The symbol for a code, falling back to the code itself. */
export function currencySymbol(code: string | null | undefined): string {
  if (!code) return CURRENCIES[0].symbol;

  return CURRENCIES.find((c) => c.code === code)?.symbol ?? `${code} `;
}
