import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { faDate } from "@/lib/fa";

const KIND_LABEL: Record<string, string> = {
  bug: "باگ",
  suggestion: "پیشنهاد",
  other: "سایر",
};

export function FeedbackManager() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"open" | "resolved" | "all">("open");

  const { data: rows } = useQuery({
    queryKey: ["admin-feedback"],
    queryFn: async () => {
      const { data } = await supabase
        .from("feedback")
        .select("id, kind, message, contact, status, created_at, user_id")
        .order("created_at", { ascending: false });
      const list = data ?? [];
      const ids = Array.from(new Set(list.map((r) => r.user_id).filter(Boolean) as string[]));
      const { data: profs } = ids.length
        ? await supabase.from("profiles").select("id, username").in("id", ids)
        : { data: [] as { id: string; username: string }[] };
      const nameOf = new Map((profs ?? []).map((p) => [p.id, p.username]));
      return list.map((r) => ({ ...r, username: r.user_id ? nameOf.get(r.user_id) ?? "کاربر" : "کاربر" }));
    },
  });

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("feedback").update({ status }).eq("id", id);
    if (error) {
      toast.error("انجام نشد: " + error.message);
      return;
    }
    toast.success("وضعیت به‌روزرسانی شد");
    qc.invalidateQueries({ queryKey: ["admin-feedback"] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("feedback").delete().eq("id", id);
    if (error) {
      toast.error("حذف نشد: " + error.message);
      return;
    }
    toast.success("حذف شد");
    qc.invalidateQueries({ queryKey: ["admin-feedback"] });
  };

  const list = (rows ?? []).filter((r) => filter === "all" || r.status === filter);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {([
          ["open", "باز"],
          ["resolved", "بررسی‌شده"],
          ["all", "همه"],
        ] as const).map(([v, l]) => (
          <Button key={v} size="sm" variant={filter === v ? "default" : "outline"} onClick={() => setFilter(v)}>
            {l}
          </Button>
        ))}
      </div>

      {list.map((r) => (
        <div key={r.id} className="space-y-2 rounded-lg border border-border p-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded bg-primary/10 px-2 py-0.5 font-bold text-primary">
              {KIND_LABEL[r.kind] ?? r.kind}
            </span>
            <span>{r.username}</span>
            <span>{faDate(r.created_at)}</span>
            {r.contact && <span>تماس: {r.contact}</span>}
          </div>
          <p className="whitespace-pre-wrap text-sm">{r.message}</p>
          <div className="flex gap-2">
            {r.status === "open" ? (
              <Button size="sm" onClick={() => setStatus(r.id, "resolved")}>
                بررسی شد
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "open")}>
                بازگشت به باز
              </Button>
            )}
            <Button size="sm" variant="destructive" onClick={() => remove(r.id)}>
              حذف
            </Button>
          </div>
        </div>
      ))}
      {list.length === 0 && <p className="text-sm text-muted-foreground">موردی نیست.</p>}
    </div>
  );
}
