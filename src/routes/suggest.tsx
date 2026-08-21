import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { onlyDigits, parseNum } from "@/lib/fa";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/suggest")({
  head: () => ({
    meta: [
      { title: "پیشنهاد پرونده جدید | سرنخ" },
      { name: "description", content: "بازی معمایی یا کارآگاهی موردعلاقه‌تان را پیشنهاد دهید تا پس از بررسی ادمین به آرشیو اضافه شود." },
      { property: "og:title", content: "پیشنهاد پرونده جدید | سرنخ" },
      { property: "og:description", content: "فرم ثبت پرونده جدید برای کاربران عضو." },
    ],
  }),
  component: SuggestPage,
});

const schema = z.object({
  title: z.string().trim().min(2, { message: "نام بازی را وارد کنید" }).max(120),
  description: z.string().trim().max(2000),
  creator_studio: z.string().trim().max(120).optional(),
  source_url: z.string().trim().url({ message: "لینک معتبر نیست" }).max(500).optional().or(z.literal("")),
});

const emptyForm = {
  title: "",
  description: "",
  creator_studio: "",
  min_players: "",
  max_players: "",
  age_rating: "",
  duration_minutes: "",
  duration_max_minutes: "",
  source_url: "",
  poster_url: "",
};

const num = parseNum;
const digits = onlyDigits;

function SuggestPage() {
  const { user } = useAuth();
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  if (!user) {
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 py-16 text-center">
        <h1 className="text-xl font-black">برای پیشنهاد پرونده باید وارد شوید</h1>
        <Link to="/auth">
          <Button>ورود / ثبت‌نام</Button>
        </Link>
      </div>
    );
  }

  const uploadPoster = async (file?: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("حجم تصویر باید کمتر از ۵ مگابایت باشد");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
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
    setForm((f) => ({ ...f, poster_url: data.signedUrl }));
    toast.success("تصویر آپلود شد");
  };

  const submit = async () => {
    const parsed = schema.safeParse({
      ...form,
      creator_studio: form.creator_studio || undefined,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "ورودی نامعتبر");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("game_suggestions").insert({
      user_id: user.id,
      title: parsed.data.title,
      description: parsed.data.description,
      creator_studio: parsed.data.creator_studio ?? null,
      min_players: num(form.min_players),
      max_players: num(form.max_players),
      age_rating: digits(form.age_rating) || null,
      duration_minutes: num(form.duration_minutes),
      duration_max_minutes: num(form.duration_max_minutes),
      source_url: form.source_url || null,
      poster_url: form.poster_url || null,
    });
    setBusy(false);
    if (error) {
      toast.error("ثبت پیشنهاد ناموفق بود");
      return;
    }
    toast.success("پیشنهاد شما ثبت شد و در انتظار بررسی ادمین است");
    setForm(emptyForm);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-black">پیشنهاد پرونده جدید</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          پس از ارسال، پیشنهاد شما با وضعیت «در انتظار بررسی» ثبت می‌شود و فقط پس از تایید ادمین در صفحات عمومی نمایش
          داده می‌شود.
        </p>
      </div>

      <div className="space-y-4 rounded-2xl surface-case p-6">
        <div className="space-y-2">
          <Label>نام بازی</Label>
          <Input value={form.title} onChange={(e) => set("title")(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>توضیح</Label>
          <Textarea rows={4} value={form.description} onChange={(e) => set("description")(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>محصول گروه</Label>
          <Input value={form.creator_studio} onChange={(e) => set("creator_studio")(e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>تعداد بازیکن</Label>
            <div className="flex items-center gap-2">
              <Input
                inputMode="numeric"
                placeholder="حداقل"
                value={form.min_players}
                onChange={(e) => set("min_players")(digits(e.target.value))}
              />
              <span className="text-xs text-muted-foreground">تا</span>
              <Input
                inputMode="numeric"
                placeholder="حداکثر"
                value={form.max_players}
                onChange={(e) => set("max_players")(digits(e.target.value))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>رده سنی (فقط عدد)</Label>
            <Input
              inputMode="numeric"
              placeholder="۱۲"
              value={form.age_rating}
              onChange={(e) => set("age_rating")(digits(e.target.value))}
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>مدت بازی (دقیقه)</Label>
            <div className="flex items-center gap-2">
              <Input
                inputMode="numeric"
                placeholder="از"
                value={form.duration_minutes}
                onChange={(e) => set("duration_minutes")(digits(e.target.value))}
              />
              <span className="text-xs text-muted-foreground">تا</span>
              <Input
                inputMode="numeric"
                placeholder="اختیاری"
                value={form.duration_max_minutes}
                onChange={(e) => set("duration_max_minutes")(digits(e.target.value))}
              />
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <Label>لینک منبع</Label>
          <Input dir="ltr" value={form.source_url} onChange={(e) => set("source_url")(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>تصویر پوستر</Label>
          <Input
            type="file"
            accept="image/*"
            disabled={uploading}
            onChange={(e) => uploadPoster(e.target.files?.[0])}
          />
          {uploading && <p className="text-xs text-muted-foreground">در حال آپلود…</p>}
          {form.poster_url && (
            <img
              src={form.poster_url}
              alt="پیش‌نمایش پوستر پیشنهادی"
              className="h-40 w-28 rounded-lg object-cover"
              loading="lazy"
            />
          )}
        </div>
        <Button className="w-full font-bold" disabled={busy || uploading} onClick={submit}>
          ارسال پیشنهاد
        </Button>
      </div>
    </div>
  );
}
