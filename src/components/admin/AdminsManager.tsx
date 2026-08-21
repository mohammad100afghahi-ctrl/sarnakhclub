import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { faDate } from "@/lib/fa";

export function AdminsManager() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  const { data: primaryId } = useQuery({
    queryKey: ["primary-admin"],
    queryFn: async () => {
      const { data } = await supabase.rpc("primary_admin_id");
      return (data as string | null) ?? null;
    },
  });

  const isPrimary = !!user && !!primaryId && user.id === primaryId;

  const { data: rows } = useQuery({
    queryKey: ["admin-users"],
    enabled: isPrimary,
    queryFn: async () => {
      const [{ data: profs }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, username, created_at").order("created_at"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      const adminIds = new Set((roles ?? []).filter((r) => r.role === "admin").map((r) => r.user_id));
      return (profs ?? []).map((p) => ({ ...p, isAdmin: adminIds.has(p.id) }));
    },
  });

  if (!isPrimary) {
    return (
      <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
        فقط مدیر اصلی سایت می‌تواند مدیران را مدیریت کند.
      </p>
    );
  }

  const toggle = async (id: string, makeAdmin: boolean) => {
    const { error } = makeAdmin
      ? await supabase.from("user_roles").insert({ user_id: id, role: "admin" })
      : await supabase.from("user_roles").delete().eq("user_id", id).eq("role", "admin");
    if (error) {
      toast.error("انجام نشد: " + error.message);
      return;
    }
    toast.success(makeAdmin ? "کاربر مدیر شد" : "دسترسی مدیریت گرفته شد");
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  };

  const list = (rows ?? []).filter((r) => r.username?.includes(q.trim()) || !q.trim());

  return (
    <div className="space-y-3">
      <Input placeholder="جستجوی نام کاربری" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="space-y-2">
        {list.map((u) => (
          <div key={u.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">
                {u.username}
                {u.id === primaryId && <span className="mr-2 text-xs text-primary">مدیر اصلی</span>}
              </p>
              <p className="text-xs text-muted-foreground">عضویت: {faDate(u.created_at)}</p>
            </div>
            {u.id === primaryId ? (
              <span className="text-xs text-muted-foreground">غیرقابل تغییر</span>
            ) : (
              <Button
                size="sm"
                variant={u.isAdmin ? "destructive" : "default"}
                onClick={() => toggle(u.id, !u.isAdmin)}
              >
                {u.isAdmin ? "حذف مدیریت" : "مدیر کن"}
              </Button>
            )}
          </div>
        ))}
        {list.length === 0 && <p className="text-sm text-muted-foreground">کاربری یافت نشد.</p>}
      </div>
    </div>
  );
}
