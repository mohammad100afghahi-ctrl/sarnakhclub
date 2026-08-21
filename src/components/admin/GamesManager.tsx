import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toFa } from "@/lib/fa";

export type GameDraft = {
  id?: string;
  title: string;
  description: string;
  creator_studio: string;
  release_year: string;
  platforms: string;
  genres: string;
  min_players: string;
  max_players: string;
  age_rating: string;
  duration_minutes: string;
  poster_url: string;
  featured: boolean;
  status: string;
};

export const emptyDraft: GameDraft = {
  title: "",
  description: "",
  creator_studio: "",
  release_year: "",
  platforms: "",
  genres: "",
  min_players: "",
  max_players: "",
  age_rating: "",
  duration_minutes: "",
  poster_url: "",
  featured: false,
  status: "active",
};

const list = (v: string) =>
  v
    .split(/[،,]/)
    .map((s) => s.trim())
    .filter(Boolean);

const num = (v: string) => (v.trim() === "" ? null : Number(v));

export function GamesManager({
  draft,
  setDraft,
  userId,
}: {
  draft: GameDraft;
  setDraft: (d: GameDraft) => void;
  userId: string;
}) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);

  const { data: games } = useQuery({
    queryKey: ["admin-games"],
    queryFn: async () => {
      const { data } = await supabase
        .from("games")
        .select("id, title, release_year, status, featured, poster_url")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  useEffect(() => {
    if (draft.id) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [draft.id]);

  const set = (k: keyof GameDraft, v: string | boolean) => setDraft({ ...draft, [k]: v });

  const save = async () => {
    if (!draft.title.trim()) {
      toast.error("عنوان پرونده الزامی است");
      return;
    }
    setSaving(true);
    const payload = {
      title: draft.title.trim(),
      description: draft.description.trim(),
      creator_studio: draft.creator_studio.trim() || null,
      release_year: num(draft.release_year),
      platforms: list(draft.platforms),
      genres: list(draft.genres),
      min_players: num(draft.min_players),
      max_players: num(draft.max_players),
      age_rating: draft.age_rating.trim() || null,
      duration_minutes: num(draft.duration_minutes),
      poster_url: draft.poster_url.trim() || null,
      featured: draft.featured,
      status: draft.status,
    };

    const { error } = draft.id
      ? await supabase.from("games").update(payload).eq("id", draft.id)
      : await supabase.from("games").insert({ ...payload, created_by: userId });

    setSaving(false);
    if (error) {
      toast.error("ذخیره پرونده ناموفق بود");
      return;
    }
    toast.success(draft.id ? "پرونده به‌روزرسانی شد" : "پرونده جدید ثبت شد");
    setDraft(emptyDraft);
    qc.invalidateQueries();
  };

  const edit = async (id: string) => {
    const { data } = await supabase.from("games").select("*").eq("id", id).maybeSingle();
    if (!data) return;
    setDraft({
      id: data.id,
      title: data.title ?? "",
      description: data.description ?? "",
      creator_studio: data.creator_studio ?? "",
      release_year: data.release_year ? String(data.release_year) : "",
      platforms: (data.platforms ?? []).join("، "),
      genres: (data.genres ?? []).join("، "),
      min_players: data.min_players ? String(data.min_players) : "",
      max_players: data.max_players ? String(data.max_players) : "",
      age_rating: data.age_rating ?? "",
      duration_minutes: data.duration_minutes ? String(data.duration_minutes) : "",
      poster_url: data.poster_url ?? "",
      featured: !!data.featured,
      status: data.status ?? "active",
    });
  };

  const toggleArchive = async (id: string, status: string) => {
    const next = status === "active" ? "archived" : "active";
    const { error } = await supabase.from("games").update({ status: next }).eq("id", id);
    if (error) {
      toast.error("تغییر وضعیت ناموفق بود");
      return;
    }
    qc.invalidateQueries({ queryKey: ["admin-games"] });
  };

  const remove = async (id: string) => {
    if (!window.confirm("این پرونده و همه امتیازها و نظرهای آن حذف شود؟")) return;
    const { error } = await supabase.from("games").delete().eq("id", id);
    if (error) {
      toast.error("حذف ناموفق بود — ابتدا نظرها و امتیازها را بررسی کنید");
      return;
    }
    toast.success("پرونده حذف شد");
    qc.invalidateQueries();
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-xl surface-case p-6">
        <h2 className="text-lg font-bold">{draft.id ? "ویرایش پرونده" : "افزودن پرونده جدید"}</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="عنوان بازی *">
            <Input value={draft.title} onChange={(e) => set("title", e.target.value)} placeholder="مثلا: ۱۳ سرنخ" />
          </Field>
          <Field label="سازنده / استودیو">
            <Input value={draft.creator_studio} onChange={(e) => set("creator_studio", e.target.value)} />
          </Field>
          <Field label="سال انتشار">
            <Input value={draft.release_year} onChange={(e) => set("release_year", e.target.value)} inputMode="numeric" placeholder="۲۰۱۹ → 2019" />
          </Field>
          <Field label="رده سنی">
            <Input value={draft.age_rating} onChange={(e) => set("age_rating", e.target.value)} placeholder="+۱۲" />
          </Field>
          <Field label="پلتفرم‌ها (با ویرگول جدا کنید)">
            <Input value={draft.platforms} onChange={(e) => set("platforms", e.target.value)} placeholder="رومیزی، اندروید، PC" />
          </Field>
          <Field label="ژانرها (با ویرگول جدا کنید)">
            <Input value={draft.genres} onChange={(e) => set("genres", e.target.value)} placeholder="کارآگاهی، معمایی" />
          </Field>
          <Field label="حداقل بازیکن">
            <Input value={draft.min_players} onChange={(e) => set("min_players", e.target.value)} inputMode="numeric" />
          </Field>
          <Field label="حداکثر بازیکن">
            <Input value={draft.max_players} onChange={(e) => set("max_players", e.target.value)} inputMode="numeric" />
          </Field>
          <Field label="مدت زمان (دقیقه)">
            <Input value={draft.duration_minutes} onChange={(e) => set("duration_minutes", e.target.value)} inputMode="numeric" />
          </Field>
          <Field label="نشانی تصویر پوستر">
            <Input value={draft.poster_url} onChange={(e) => set("poster_url", e.target.value)} placeholder="https://…" dir="ltr" />
          </Field>
        </div>

        <Field label="توضیحات پرونده">
          <Textarea rows={5} value={draft.description} onChange={(e) => set("description", e.target.value)} />
        </Field>

        <div className="flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={draft.featured} onCheckedChange={(v) => set("featured", v)} />
            نمایش در پرونده‌های ویژه صفحه اصلی
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={draft.status === "active"} onCheckedChange={(v) => set("status", v ? "active" : "archived")} />
            منتشر شده (قابل مشاهده برای همه)
          </label>
        </div>

        <div className="flex gap-2">
          <Button onClick={save} disabled={saving}>
            {saving ? "در حال ذخیره…" : draft.id ? "ذخیره تغییرات" : "ثبت پرونده"}
          </Button>
          {draft.id && (
            <Button variant="secondary" onClick={() => setDraft(emptyDraft)}>
              انصراف
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-bold">پرونده‌های ثبت‌شده</h2>
        {(games ?? []).map((g) => (
          <div key={g.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl surface-case p-4 text-sm">
            <div>
              <p className="font-bold">
                {g.title} {g.release_year ? `(${toFa(g.release_year)})` : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                {g.status === "active" ? "منتشر شده" : "بایگانی"}
                {g.featured ? " · ویژه" : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/game/$gameId" params={{ gameId: g.id }}>
                <Button size="sm" variant="ghost">مشاهده</Button>
              </Link>
              <Button size="sm" onClick={() => edit(g.id)}>ویرایش</Button>
              <Button size="sm" variant="secondary" onClick={() => toggleArchive(g.id, g.status)}>
                {g.status === "active" ? "بایگانی" : "انتشار"}
              </Button>
              <Button size="sm" variant="destructive" onClick={() => remove(g.id)}>حذف</Button>
            </div>
          </div>
        ))}
        {!games?.length && <p className="text-sm text-muted-foreground">هنوز پرونده‌ای ثبت نشده است.</p>}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
