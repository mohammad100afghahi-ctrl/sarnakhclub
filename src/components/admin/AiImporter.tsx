import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { discoverCases, importCase } from "@/lib/importer.functions";
import { toFa } from "@/lib/fa";

type Row = {
  url: string;
  selected: boolean;
  state: "idle" | "running" | "imported" | "duplicate" | "skipped" | "error";
  note: string;
};

const stateLabel: Record<Row["state"], string> = {
  idle: "در انتظار",
  running: "در حال بررسی…",
  imported: "افزوده شد",
  duplicate: "تکراری",
  skipped: "نادیده گرفته شد",
  error: "خطا",
};

export function AiImporter() {
  const discover = useServerFn(discoverCases);
  const runImport = useServerFn(importCase);

  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);

  const doneCount = rows.filter((r) => r.state === "imported").length;

  const handleDiscover = async () => {
    setLoading(true);
    try {
      const res = await discover({ data: { url: url.trim(), limit: 60 } });
      setRows(res.links.map((l) => ({ url: l, selected: true, state: "idle", note: "" })));
      if (res.links.length === 0) toast.error("صفحه‌ای پیدا نشد.");
      else toast.success(`${toFa(res.links.length)} صفحه پیدا شد.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در کشف صفحات");
    } finally {
      setLoading(false);
    }
  };

  const handleRun = async () => {
    setRunning(true);
    const targets = rows.filter((r) => r.selected && r.state === "idle");
    for (const target of targets) {
      setRows((prev) => prev.map((r) => (r.url === target.url ? { ...r, state: "running" } : r)));
      try {
        const res = await runImport({ data: { url: target.url } });
        setRows((prev) =>
          prev.map((r) =>
            r.url === target.url
              ? { ...r, state: res.status, note: res.title ?? res.reason ?? "" }
              : r,
          ),
        );
      } catch (e) {
        setRows((prev) =>
          prev.map((r) =>
            r.url === target.url
              ? { ...r, state: "error", note: e instanceof Error ? e.message : "خطا" }
              : r,
          ),
        );
      }
    }
    setRunning(false);
    toast.success("استخراج تمام شد. نتایج در تب «پیشنهادها» است.");
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border/60 bg-card/40 p-3 text-sm text-muted-foreground">
        آدرس صفحه دسته‌بندی یک فروشگاه را وارد کنید. ابتدا صفحات محصول کشف می‌شوند، سپس هوش مصنوعی اطلاعات هر
        پرونده را به فارسی استخراج می‌کند و همراه پوستر به «پیشنهادها» اضافه می‌شود تا شما تأیید کنید.
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          dir="ltr"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/products/category/..."
        />
        <Button onClick={handleDiscover} disabled={loading || running || !url.trim()}>
          {loading ? "در حال کشف…" : "کشف صفحات"}
        </Button>
      </div>

      {rows.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleRun} disabled={running}>
              {running ? "در حال استخراج…" : "شروع استخراج"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={running}
              onClick={() => setRows((prev) => prev.map((r) => ({ ...r, selected: true })))}
            >
              انتخاب همه
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={running}
              onClick={() => setRows((prev) => prev.map((r) => ({ ...r, selected: false })))}
            >
              لغو انتخاب
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
                    setRows((prev) =>
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
