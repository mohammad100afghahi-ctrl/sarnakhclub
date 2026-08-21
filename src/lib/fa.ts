const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

export function toFa(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return String(value).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

export function faNum(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return toFa(value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }));
}

export function faDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("fa-IR", { year: "numeric", month: "long", day: "numeric" }).format(
      new Date(iso),
    );
  } catch {
    return "—";
  }
}

export function faDuration(minutes: number | null | undefined): string {
  if (!minutes) return "—";
  if (minutes < 60) return `${toFa(minutes)} دقیقه`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${toFa(h)} ساعت و ${toFa(m)} دقیقه` : `${toFa(h)} ساعت`;
}

export const PLATFORMS = ["رومیزی", "کارتی", "اندروید", "iOS", "PC", "کنسول"] as const;
export const GENRES = [
  "کارآگاهی",
  "دیداکشن",
  "معمایی",
  "ترسناک",
  "خانوادگی",
  "استراتژیک",
  "مهمانی",
  "منطقی",
  "داستانی",
  "اتاق فرار",
] as const;
export const AGE_RATINGS = ["+۷", "+۱۰", "+۱۲", "+۱۴", "+۱۶", "+۱۸"] as const;
