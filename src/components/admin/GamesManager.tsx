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
import { onlyDigits, parseNum } from "@/lib/fa";

export type GameDraft = {
  id?: string;
  title: string;
  description: string;
  creator_studio: string;
  min_players: string;
  max_players: string;
  age_rating: string;
  duration_minutes: string;
  duration_max_minutes: string;
  poster_url: string;
  featured: boolean;
  status: string;
};

export const emptyDraft: GameDraft = {
  title: "",
  description: "",
  creator_studio: "",
  min_players: "",
  max_players: "",
  age_rating: "",
  duration_minutes: "",
  duration_max_minutes: "",
  poster_url: "",
  featured: false,
  status: "active",
};

const num = parseNum;

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
  const [uploading, setUploading] = useState(false);

  const uploadPoster = async (file?: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("حجم تصویر باید کمتر از ۵ مگابایت باشد");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("posters").upload(path, file, { contentType: file.type });
    if (error) {
      setUploading(false);
      toast.error("آپلود تصویر ناموفق بود");
      return;
    }
    const { data } = await supabase.storage.from("posters").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
    setUploading(false);
    if (!data?.signedUrl) {
      toast.error("دریافت نشانی تصویر ناموفق بود");
      return;
    }
    setDraft({ ...draft, poster_url: data.signedUrl });
    toast.success("تصویر آپلود شد");
  };

  const { data: games } = useQuery({
    queryKey: ["admin-games"],
    queryFn: async () => {
      const { data } = await supabase
        .from("games")
        .select("id, title, creator_studio, status, featured, poster_url")
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
      min_players: num(draft.min_players),
      max_players: num(draft.max_players),
      age_rating: onlyDigits(draft.age_rating) || null,
      duration_minutes: num(draft.duration_minutes),
      duration_max_minutes: num(draft.duration_max_minutes),
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
      min_players: data.min_players ? String(data.min_players) : "",
      max_players: data.max_players ? String(data.max_players) : "",
      age_rating: data.age_rating ? onlyDigits(String(data.age_rating)) : "",
      duration_minutes: data.duration_minutes ? String(data.duration_minutes) : "",
      duration_max_minutes: data.duration_max_minutes ? String(data.duration_max_minutes) : "",
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
          <Field label="محصول گروه">
            <Input value={draft.creator_studio} onChange={(e) => set("creator_studio", e.target.value)} />
          </Field>
          <Field label="رده سنی (فقط عدد)">
            <Input value={draft.age_rating} onChange={(e) => set("age_rating", onlyDigits(e.target.value))} inputMode="numeric" placeholder="۱۲" />
          </Field>
          <Field label="تعداد بازیکن">
            <div className="flex items-center gap-2">
              <Input value={draft.min_players} onChange={(e) => set("min_players", onlyDigits(e.target.value))} inputMode="numeric" placeholder="حداقل" />
              <span className="text-xs text-muted-foreground">تا</span>
              <Input value={draft.max_players} onChange={(e) => set("max_players", onlyDigits(e.target.value))} inputMode="numeric" placeholder="حداکثر" />
            </div>
          </Field>
          <Field label="مدت زمان (دقیقه)">
            <div className="flex items-center gap-2">
              <Input value={draft.duration_minutes} onChange={(e) => set("duration_minutes", onlyDigits(e.target.value))} inputMode="numeric" placeholder="از" />
              <span className="text-xs text-muted-foreground">تا</span>
              <Input value={draft.duration_max_minutes} onChange={(e) => set("duration_max_minutes", onlyDigits(e.target.value))} inputMode="numeric" placeholder="اختیاری" />
            </div>
          </Field>
          <Field label="تصویر پوستر">
            <div className="space-y-2">
              <Input type="file" accept="image/*" disabled={uploading} onChange={(e) => uploadPoster(e.target.files?.[0])} />
              {uploading && <p className="text-xs text-muted-foreground">در حال آپلود…</p>}
              {draft.poster_url && (
                <div className="flex items-center gap-3">
                  <img src={draft.poster_url} alt="پیش‌نمایش پوستر" className="h-20 w-16 rounded-md object-cover" />
                  <Button size="sm" variant="secondary" onClick={() => set("poster_url", "")}>حذف تصویر</Button>
                  <a href={draft.poster_url} download target="_blank" rel="noreferrer">
                    <Button size="sm" variant="secondary">دانلود تصویر</Button>
                  </a>
                </div>
              )}
            </div>
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
                {g.title} {g.creator_studio ? `— ${g.creator_studio}` : ""}
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
