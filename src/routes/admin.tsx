import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { faDate, toFa } from "@/lib/fa";
import { GamesManager, emptyDraft, type GameDraft } from "@/components/admin/GamesManager";
import { AdminsManager } from "@/components/admin/AdminsManager";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "پنل مدیریت | آرشیو پرونده" },
      { name: "description", content: "مدیریت پیشنهادهای بازی، گزارش نظرها و تنظیمات رتبه‌بندی." },
      { property: "og:title", content: "پنل مدیریت | آرشیو پرونده" },
      { property: "og:description", content: "ابزارهای مدیریتی آرشیو پرونده." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { isAdmin, loading, user } = useAuth();
  const qc = useQueryClient();
  const [mValue, setMValue] = useState("");
  const [tab, setTab] = useState("games");
  const [draft, setDraft] = useState<GameDraft>(emptyDraft);
  const [reportFilter, setReportFilter] = useState<"open" | "resolved" | "dismissed" | "all">("open");

  const { data: primaryAdminId } = useQuery({
    queryKey: ["primary-admin"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase.rpc("primary_admin_id");
      return (data as string | null) ?? null;
    },
  });
  const isPrimaryAdmin = !!user && !!primaryAdminId && user.id === primaryAdminId;

  const { data: suggestions } = useQuery({
    queryKey: ["admin-suggestions"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase
        .from("game_suggestions")
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: reports } = useQuery({
    queryKey: ["admin-reports"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase
        .from("review_reports")
        .select("id, reason, status, created_at, user_id, review_id, reviews(id, text, user_id, game_id)")
        .order("created_at", { ascending: false });
      const rows = (data ?? []) as unknown as {
        id: string;
        reason: string | null;
        status: string;
        created_at: string;
        user_id: string;
        review_id: string;
        reviews: { id: string; text: string; user_id: string; game_id: string } | null;
      }[];

      const userIds = Array.from(
        new Set(rows.flatMap((r) => [r.user_id, r.reviews?.user_id]).filter(Boolean) as string[]),
      );
      const gameIds = Array.from(new Set(rows.map((r) => r.reviews?.game_id).filter(Boolean) as string[]));

      const [{ data: profs }, { data: gms }] = await Promise.all([
        userIds.length
          ? supabase.from("profiles").select("id, username").in("id", userIds)
          : Promise.resolve({ data: [] as { id: string; username: string }[] }),
        gameIds.length
          ? supabase.from("games").select("id, title").in("id", gameIds)
          : Promise.resolve({ data: [] as { id: string; title: string }[] }),
      ]);

      const nameOf = new Map((profs ?? []).map((p) => [p.id, p.username]));
      const titleOf = new Map((gms ?? []).map((g) => [g.id, g.title]));

      return rows.map((r) => ({
        ...r,
        reporterName: nameOf.get(r.user_id) ?? "کاربر ناشناس",
        authorName: r.reviews ? nameOf.get(r.reviews.user_id) ?? "کاربر ناشناس" : null,
        gameTitle: r.reviews ? titleOf.get(r.reviews.game_id) ?? null : null,
        gameId: r.reviews?.game_id ?? null,
      }));
    },
  });

  const { data: settings } = useQuery({
    queryKey: ["admin-settings"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("*").eq("key", "m").maybeSingle();
      return data;
    },
  });

  const setSuggestionStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("game_suggestions").update({ status }).eq("id", id);
    if (error) {
      toast.error("به‌روزرسانی ناموفق بود");
      return;
    }
    toast.success("وضعیت پیشنهاد به‌روزرسانی شد");
    qc.invalidateQueries({ queryKey: ["admin-suggestions"] });
  };

  const deleteSuggestion = async (id: string) => {
    const { error } = await supabase.from("game_suggestions").delete().eq("id", id);
    if (error) {
      toast.error("حذف پیشنهاد ناموفق بود");
      return;
    }
    toast.success("پیشنهاد رد و حذف شد");
    qc.invalidateQueries({ queryKey: ["admin-suggestions"] });
  };

  const setReportStatus = async (id: string, status: "resolved" | "dismissed" | "open") => {
    const { error } = await supabase.from("review_reports").update({ status }).eq("id", id);
    if (error) { toast.error("به‌روزرسانی گزارش ناموفق بود"); return; }
    toast.success("وضعیت گزارش به‌روزرسانی شد");
    qc.invalidateQueries({ queryKey: ["admin-reports"] });
  };

  const deleteReportedReview = async (reviewId: string, reportId: string) => {
    const { error } = await supabase.from("reviews").delete().eq("id", reviewId);
    if (error) { toast.error("حذف نظر ناموفق بود"); return; }
    await supabase.from("review_reports").update({ status: "resolved" }).eq("id", reportId);
    toast.success("نظر حذف و گزارش بسته شد");
    qc.invalidateQueries({ queryKey: ["admin-reports"] });
  };


  const buildFromSuggestion = (s: {
    title: string;
    description: string | null;
    creator_studio: string | null;
    min_players?: number | null;
    max_players?: number | null;
    age_rating?: string | null;
    duration_minutes?: number | null;
    duration_max_minutes?: number | null;
    poster_url: string | null;
  }) => {
    setDraft({
      ...emptyDraft,
      title: s.title,
      description: s.description ?? "",
      creator_studio: s.creator_studio ?? "",
      min_players: s.min_players ? String(s.min_players) : "",
      max_players: s.max_players ? String(s.max_players) : "",
      age_rating: s.age_rating ?? "",
      duration_minutes: s.duration_minutes ? String(s.duration_minutes) : "",
      duration_max_minutes: s.duration_max_minutes ? String(s.duration_max_minutes) : "",
      poster_url: s.poster_url ?? "",
    });

    setTab("games");
    toast.info("اطلاعات پیشنهاد در فرم پرونده بارگذاری شد");
  };

  const saveM = async () => {
    const value = Number(mValue);
    if (!Number.isFinite(value) || value < 0) {
      toast.error("مقدار m نامعتبر است");
      return;
    }
    const { error } = await supabase.from("site_settings").upsert({ key: "m", value }, { onConflict: "key" });
    if (error) {
      toast.error("ذخیره ناموفق بود");
      return;
    }
    toast.success("مقدار m ذخیره شد");
    qc.invalidateQueries();
  };

  if (loading) return <div className="mx-auto max-w-4xl px-4 py-16 text-muted-foreground">در حال بارگذاری…</div>;

  if (!user)
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-20 text-center">
        <h1 className="text-xl font-bold">برای دسترسی به پنل مدیریت وارد شوید</h1>
        <Link to="/auth">
          <Button>ورود</Button>
        </Link>
      </div>
    );

  if (!isAdmin)
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-xl font-bold">دسترسی مجاز نیست</h1>
        <p className="mt-2 text-sm text-muted-foreground">این بخش تنها برای مدیران سایت در دسترس است.</p>
      </div>
    );

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-10">
      <h1 className="text-2xl font-black">پنل مدیریت</h1>

      <Tabs value={tab} onValueChange={setTab} dir="rtl">
        <TabsList className="w-full">
          <TabsTrigger value="games" className="flex-1">پرونده‌ها</TabsTrigger>
          <TabsTrigger value="suggestions" className="flex-1">پیشنهادها</TabsTrigger>
          <TabsTrigger value="reports" className="flex-1">گزارش‌ها</TabsTrigger>
          <TabsTrigger value="settings" className="flex-1">تنظیمات</TabsTrigger>
          {isPrimaryAdmin && (
            <TabsTrigger value="admins" className="flex-1">مدیران</TabsTrigger>
          )}
        </TabsList>

        {isPrimaryAdmin && (
          <TabsContent value="admins" className="pt-4">
            <AdminsManager />
          </TabsContent>
        )}

        <TabsContent value="games" className="pt-4">
          <GamesManager draft={draft} setDraft={setDraft} userId={user.id} />
        </TabsContent>

        <TabsContent value="suggestions" className="space-y-2 pt-4">
          {(suggestions ?? []).map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl surface-case p-4 text-sm">
              <div className="flex items-start gap-3">
                {s.poster_url && (
                  <img
                    src={s.poster_url}
                    alt={s.title}
                    className="h-20 w-14 shrink-0 rounded-md object-cover"
                  />
                )}
                <div>
                  <p className="font-bold">
                    {s.title} {s.creator_studio ? `— ${s.creator_studio}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">{s.description}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => buildFromSuggestion(s)}>ساخت پرونده از این پیشنهاد</Button>
                <Button size="sm" variant="outline" onClick={() => setSuggestionStatus(s.id, "approved")}>تایید</Button>
                <Button size="sm" variant="secondary" onClick={() => deleteSuggestion(s.id)}>رد</Button>
              </div>
            </div>
          ))}
          {!suggestions?.length && <p className="text-sm text-muted-foreground">پیشنهادی ثبت نشده است.</p>}
        </TabsContent>

        <TabsContent value="reports" className="space-y-3 pt-4">
          <div className="flex flex-wrap gap-2">
            {([
              ["open", "باز"],
              ["resolved", "رسیدگی‌شده"],
              ["dismissed", "نادیده‌گرفته"],
              ["all", "همه"],
            ] as const).map(([key, label]) => (
              <Button
                key={key}
                size="sm"
                variant={reportFilter === key ? "default" : "secondary"}
                onClick={() => setReportFilter(key)}
              >
                {label} ({toFa((reports ?? []).filter((r) => key === "all" || r.status === key).length)})
              </Button>
            ))}
          </div>

          {(reports ?? [])
            .filter((r) => reportFilter === "all" || r.status === reportFilter)
            .map((r) => (
              <div key={r.id} className="space-y-3 rounded-xl surface-case p-4 text-sm">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span
                    className={`rounded-full px-2 py-0.5 ${
                      r.status === "open"
                        ? "bg-primary/15 text-primary"
                        : r.status === "resolved"
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {r.status === "open" ? "باز" : r.status === "resolved" ? "رسیدگی‌شده" : "نادیده‌گرفته"}
                  </span>
                  <span>گزارش‌دهنده: {r.reporterName}</span>
                  <span>•</span>
                  <span>{faDate(r.created_at)}</span>
                  {r.gameTitle && r.gameId && (
                    <>
                      <span>•</span>
                      <Link to="/game/$gameId" params={{ gameId: r.gameId }} className="text-primary hover:underline">
                        {r.gameTitle}
                      </Link>
                    </>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">دلیل گزارش: {r.reason?.trim() || "—"}</p>

                <div className="rounded-lg bg-secondary/50 p-3">
                  <p className="mb-1 text-xs text-muted-foreground">
                    نویسنده نظر: {r.authorName ?? "—"}
                  </p>
                  <p>{r.reviews?.text ?? "نظر حذف شده است"}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {r.reviews && (
                    <Button size="sm" variant="destructive" onClick={() => deleteReportedReview(r.reviews!.id, r.id)}>
                      حذف نظر
                    </Button>
                  )}
                  {r.status !== "resolved" && (
                    <Button size="sm" variant="outline" onClick={() => setReportStatus(r.id, "resolved")}>
                      رسیدگی شد
                    </Button>
                  )}
                  {r.status !== "dismissed" && (
                    <Button size="sm" variant="secondary" onClick={() => setReportStatus(r.id, "dismissed")}>
                      نادیده گرفتن
                    </Button>
                  )}
                  {r.status !== "open" && (
                    <Button size="sm" variant="ghost" onClick={() => setReportStatus(r.id, "open")}>
                      بازگشایی
                    </Button>
                  )}
                </div>
              </div>
            ))}
          {!(reports ?? []).filter((r) => reportFilter === "all" || r.status === reportFilter).length && (
            <p className="text-sm text-muted-foreground">گزارشی در این وضعیت نیست.</p>
          )}
        </TabsContent>

        <TabsContent value="settings" className="pt-4">
          <div className="space-y-3 rounded-xl surface-case p-6">
            <p className="text-sm">
              مقدار فعلی m (حداقل تعداد رای برای رتبه‌بندی): <b>{settings ? toFa(settings.value) : "—"}</b>
            </p>
            <div className="flex gap-2">
              <Input
                value={mValue}
                onChange={(e) => setMValue(e.target.value)}
                placeholder="مقدار جدید m"
                inputMode="numeric"
              />
              <Button onClick={saveM}>ذخیره</Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
