import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { importerStore, type ImporterRow } from "@/lib/importerStore";
import { toFa } from "@/lib/fa";

const stateLabel: Record<ImporterRow["state"], string> = {
  idle: "در انتظار",
  running: "در حال بررسی…",
  waiting: "محدودیت موقت سرویس",
  imported: "افزوده شد",
  duplicate: "تکراری",
  skipped: "نادیده گرفته شد",
  error: "خطا",
};

export function AiImporter() {
  const snapshot = useSyncExternalStore(
    importerStore.subscribe,
    importerStore.getSnapshot,
    importerStore.getSnapshot,
  );
  const { url, loading, running, rows } = snapshot;

  const doneCount = rows.filter((r) => r.state === "imported").length;

  const handleDiscover = async () => {
    const res = await importerStore.discover();
    if (res.error) toast.error(res.error);
    else if (res.count === 0) toast.error("صفحه‌ای پیدا نشد.");
    else toast.success(`${toFa(res.count)} صفحه پیدا شد.`);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border/60 bg-card/40 p-3 text-sm text-muted-foreground">
        آدرس صفحه دسته‌بندی یک فروشگاه را وارد کنید. ابتدا صفحات محصول کشف می‌شوند، سپس هوش مصنوعی اطلاعات هر
        پرونده را به فارسی استخراج می‌کند و همراه پوستر به «پیشنهادها» اضافه می‌شود تا شما تأیید کنید.
        {" "}استخراج در پس‌زمینه ادامه پیدا می‌کند؛ می‌توانید بین تب‌ها جابه‌جا شوید.
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          dir="ltr"
          value={url}
          onChange={(e) => importerStore.setUrl(e.target.value)}
          placeholder="https://example.com/products/category/..."
        />
        <Button onClick={handleDiscover} disabled={loading || running || !url.trim()}>
          {loading ? "در حال کشف…" : "کشف صفحات"}
        </Button>
      </div>

      {rows.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => void importerStore.run()} disabled={running}>
              {running ? "در حال استخراج…" : "شروع استخراج"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={running}
              onClick={() => importerStore.setRows((prev) => prev.map((r) => ({ ...r, selected: true })))}
            >
              انتخاب همه
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={running}
              onClick={() => importerStore.setRows((prev) => prev.map((r) => ({ ...r, selected: false })))}
            >
              لغو انتخاب
            </Button>
            <Button variant="ghost" size="sm" disabled={running} onClick={() => importerStore.reset()}>
              پاک کردن فهرست
            </Button>
            <span className="text-xs text-muted-foreground">
              {toFa(doneCount)} از {toFa(rows.length)} افزوده شد
            </span>
          </div>

          <div className="max-h-[28rem] space-y-1 overflow-y-auto rounded-lg border border-border/60 p-2">
            {rows.map((r) => (
              <div key={r.url} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/40">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={r.selected}
                  disabled={running || r.state !== "idle"}
                  onChange={(e) =>
                    importerStore.setRows((prev) =>
                      prev.map((x) => (x.url === r.url ? { ...x, selected: e.target.checked } : x)),
                    )
                  }
                />
                <span dir="ltr" className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                  {r.url}
                </span>
                <span className="shrink-0 text-xs">
                  {stateLabel[r.state]}
                  {r.note ? ` — ${r.note}` : ""}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
