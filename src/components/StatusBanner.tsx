import { useEffect, useState } from "react";
import { X } from "lucide-react";

const STORAGE_KEY = "sernakh-status-banner-dismissed-v1";

export function StatusBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setShow(true);
    } catch {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  const dismiss = () => {
    setShow(false);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="sticky top-0 z-[60] w-full border-b border-amber-500/40 bg-amber-500/15 text-foreground backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-start gap-2 px-3 py-2 sm:px-4">
        <p className="flex-1 text-xs leading-relaxed sm:text-sm">
          <span className="font-extrabold text-amber-600 dark:text-amber-400">
            این پروژه دیگر توسعه داده نمی‌شود.
          </span>{" "}
          به‌دلیل نبود بودجه برای ادامه‌ی توسعه، این سایت دیگر رفع باگ یا ویژگی
          جدیدی دریافت نمی‌کند و به همین شکل باقی خواهد ماند. اگر با مشکلی مواجه
          شدید، ممکن است برطرف نشود.
        </p>
        <button
          onClick={dismiss}
          aria-label="بستن"
          className="mt-0.5 shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-amber-500/20 hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
