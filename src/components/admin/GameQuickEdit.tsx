import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { onlyDigits, parseNum } from "@/lib/fa";

type Draft = {
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

const emptyDraft: Draft = {
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

export function GameQuickEdit({ gameId, userId }: { gameId: string; userId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const set = (k: keyof Draft, v: string | boolean) => setDraft((d) => ({ ...d, [k]: v }));

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    (async () => {
      const { data } = await supabase.from("games").select("*").eq("id", gameId).maybeSingle();
      if (!active) return;
      setLoading(false);
      if (!data) return;
      setDraft({
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
    })();
    return () => {
      active = false;
    };
  }, [open, gameId]);

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
    set("poster_url", data.signedUrl);
    toast.success("تصویر آپلود شد");
  };

  const save = async () => {
    if (!draft.title.trim()) {
      toast.error("عنوان پرونده الزامی است");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("games")
      .update({
        title: draft.title.trim(),
        description: draft.description.trim(),
        creator_studio: draft.creator_studio.trim() || null,
        min_players: parseNum(draft.min_players),
        max_players: parseNum(draft.max_players),
        age_rating: onlyDigits(draft.age_rating) || null,
        duration_minutes: parseNum(draft.duration_minutes),
        duration_max_minutes: parseNum(draft.duration_max_minutes),
        poster_url: draft.poster_url.trim() || null,
        featured: draft.featured,
        status: draft.status,
      })
      .eq("id", gameId);
    setSaving(false);
    if (error) {
      toast.error("ذخیره تغییرات ناموفق بود");
      return;
    }
    toast.success("پرونده به‌روزرسانی شد");
    setOpen(false);
    qc.invalidateQueries();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary" className="gap-1">
          <Pencil className="h-4 w-4" />
          ویرایش سریع
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-right">ویرایش سریع پرونده</DialogTitle>
          <DialogDescription className="text-right">
            تغییرات بلافاصله روی همین صفحه اعمال می‌شود.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">در حال بارگذاری…</p>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="عنوان بازی *">
                <Input value={draft.title} onChange={(e) => set("title", e.target.value)} />
              </Field>
              <Field label="محصول گروه">
                <Input value={draft.creator_studio} onChange={(e) => set("creator_studio", e.target.value)} />
              </Field>
              <Field label="رده سنی (فقط عدد)">
                <Input
                  value={draft.age_rating}
                  onChange={(e) => set("age_rating", onlyDigits(e.target.value))}
                  inputMode="numeric"
                />
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
                پرونده ویژه
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={draft.status === "active"} onCheckedChange={(v) => set("status", v ? "active" : "archived")} />
                منتشر شده
              </label>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-start">
          <Button onClick={save} disabled={saving || loading}>
            {saving ? "در حال ذخیره…" : "ذخیره تغییرات"}
          </Button>
          <Button variant="secondary" onClick={() => setOpen(false)}>انصراف</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
