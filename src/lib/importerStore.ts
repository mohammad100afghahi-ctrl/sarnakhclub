import { toast } from "sonner";
import { discoverCases, importCase } from "@/lib/importer.functions";

export type ImporterRow = {
  url: string;
  selected: boolean;
  state: "idle" | "running" | "waiting" | "imported" | "duplicate" | "skipped" | "error";
  note: string;
};

export type ImporterState = {
  url: string;
  loading: boolean;
  running: boolean;
  rows: ImporterRow[];
};

let state: ImporterState = { url: "", loading: false, running: false, rows: [] };
const listeners = new Set<() => void>();

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function set(patch: Partial<ImporterState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export const importerStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot(): ImporterState {
    return state;
  },
  setUrl(url: string) {
    set({ url });
  },
  setRows(updater: (rows: ImporterRow[]) => ImporterRow[]) {
    set({ rows: updater(state.rows) });
  },
  async discover(): Promise<{ count: number; error?: string }> {
    if (state.loading || state.running) return { count: state.rows.length };
    set({ loading: true });
    try {
      const res = await discoverCases({ data: { url: state.url.trim(), limit: 60 } });
      set({
        rows: res.links.map((l) => ({ url: l, selected: true, state: "idle", note: "" })),
        loading: false,
      });
      return { count: res.links.length };
    } catch (e) {
      set({ loading: false });
      return { count: 0, error: e instanceof Error ? e.message : "خطا در کشف صفحات" };
    }
  },
  async run(): Promise<void> {
    if (state.running) return;
    set({ running: true });
    const targets = state.rows.filter((r) => r.selected && r.state === "idle");
    for (const target of targets) {
      let completed = false;
      for (let attempt = 0; attempt < 3 && !completed; attempt += 1) {
        set({
          rows: state.rows.map((r) =>
            r.url === target.url ? { ...r, state: "running" as const, note: "" } : r,
          ),
        });
        try {
          const res = await importCase({ data: { url: target.url } });
          if (res.status === "provider_error" && res.retryAfterSeconds !== null) {
            if (attempt === 2) {
              set({
                rows: state.rows.map((r) =>
                  r.url === target.url ? { ...r, state: "error" as const, note: res.reason } : r,
                ),
              });
              set({ running: false });
              toast.error("محدودیت سرویس ادامه دارد؛ استخراج متوقف شد و می‌توانید بعداً دوباره شروع کنید.");
              return;
            }
            const waitSeconds = Math.max(1, res.retryAfterSeconds);
            for (let remaining = waitSeconds; remaining > 0; remaining -= 1) {
              set({
                rows: state.rows.map((r) =>
                  r.url === target.url
                    ? { ...r, state: "waiting" as const, note: `ادامه خودکار تا ${remaining} ثانیه دیگر` }
                    : r,
                ),
              });
              await sleep(1_000);
            }
            continue;
          }
          set({
            rows: state.rows.map((r) =>
              r.url === target.url
                ? {
                    ...r,
                    state: res.status === "provider_error" ? ("error" as const) : res.status,
                    note: res.title ?? res.reason ?? "",
                  }
                : r,
            ),
          });
          completed = true;
        } catch (e) {
          set({
            rows: state.rows.map((r) =>
              r.url === target.url
                ? { ...r, state: "error" as const, note: e instanceof Error ? e.message : "خطا" }
                : r,
            ),
          });
          completed = true;
        }
      }
    }
    set({ running: false });
    toast.success("استخراج تمام شد. نتایج در تب «پیشنهادها» است.");
  },
  reset() {
    if (state.running) return;
    set({ url: "", rows: [], loading: false });
  },
};
