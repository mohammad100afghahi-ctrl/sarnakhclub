const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

export function toFa(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return String(value).replace(/\d/g, (d) => FA_DIGITS[Number(d)] ?? d);
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

/** تبدیل ارقام فارسی/عربی به لاتین و حذف کاراکترهای غیرعددی */
export function toLatinDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

/** فقط ارقام (با پشتیبانی از اعداد فارسی) */
export function onlyDigits(value: string): string {
  return toLatinDigits(value).replace(/[^\d]/g, "");
}

export function parseNum(value: string): number | null {
  const d = onlyDigits(value);
  return d === "" ? null : Number(d);
}

/** نمایش رده سنی: ۱۲ → +۱۲ */
export function faAge(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const d = onlyDigits(String(value));
  return d === "" ? "—" : `${toFa(d)}+`;
}

/** نمایش بازه مدت زمان */
export function faDurationRange(min: number | null | undefined, max: number | null | undefined): string {
  if (!min && !max) return "—";
  if (min && max && max !== min) return `${toFa(min)} تا ${toFa(max)} دقیقه`;
  return faDuration(min ?? max);
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
