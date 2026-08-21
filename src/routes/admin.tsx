import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toFa } from "@/lib/fa";
import { GamesManager, emptyDraft, type GameDraft } from "@/components/admin/GamesManager";

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

  const buildFromSuggestion = (s: {
    title: string;
    description: string | null;
    creator_studio: string | null;
    release_year: number | null;
    min_players?: number | null;
    max_players?: number | null;
    age_rating?: string | null;
    duration_minutes?: number | null;
    poster_url: string | null;
  }) => {
    setDraft({
      ...emptyDraft,
      title: s.title,
      description: s.description ?? "",
      creator_studio: s.creator_studio ?? "",
      release_year: s.release_year ? String(s.release_year) : "",
      min_players: s.min_players ? String(s.min_players) : "",
      max_players: s.max_players ? String(s.max_players) : "",
      age_rating: s.age_rating ?? "",
      duration_minutes: s.duration_minutes ? String(s.duration_minutes) : "",
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
        </TabsList>

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
                    {s.title} {s.release_year ? `(${toFa(s.release_year)})` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">{s.description}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => buildFromSuggestion(s)}>ساخت پرونده از این پیشنهاد</Button>
                <Button size="sm" variant="outline" onClick={() => setSuggestionStatus(s.id, "approved")}>تایید</Button>
                <Button size="sm" variant="secondary" onClick={() => setSuggestionStatus(s.id, "rejected")}>رد</Button>
              </div>
            </div>
          ))}
          {!suggestions?.length && <p className="text-sm text-muted-foreground">پیشنهادی ثبت نشده است.</p>}
        </TabsContent>

        <TabsContent value="reports" className="space-y-2 pt-4">
          {(reports ?? []).map((r) => (
            <div key={r.id} className="rounded-xl surface-case p-4 text-sm">
              <p className="text-xs text-muted-foreground">دلیل: {r.reason ?? "—"}</p>
              <p className="mt-1">{r.reviews?.text ?? "نظر حذف شده است"}</p>
            </div>
          ))}
          {!reports?.length && <p className="text-sm text-muted-foreground">گزارشی ثبت نشده است.</p>}
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
