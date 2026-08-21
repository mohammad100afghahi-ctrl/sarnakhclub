import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/suggest")({
  head: () => ({
    meta: [
      { title: "پیشنهاد بازی جدید | آرشیو پرونده" },
      { name: "description", content: "بازی معمایی یا کارآگاهی موردعلاقه‌تان را پیشنهاد دهید تا پس از بررسی ادمین به آرشیو اضافه شود." },
      { property: "og:title", content: "پیشنهاد بازی جدید | آرشیو پرونده" },
      { property: "og:description", content: "فرم ثبت پرونده جدید برای کاربران عضو." },
    ],
  }),
  component: SuggestPage,
});

const schema = z.object({
  title: z.string().trim().min(2, { message: "نام بازی را وارد کنید" }).max(120),
  description: z.string().trim().max(2000),
  creator_studio: z.string().trim().max(120).optional(),
  release_year: z.number().int().min(1900).max(2100).optional(),
  source_url: z.string().trim().url({ message: "لینک معتبر نیست" }).max(500).optional().or(z.literal("")),
  poster_url: z.string().trim().url({ message: "لینک تصویر معتبر نیست" }).max(500).optional().or(z.literal("")),
});

function SuggestPage() {
  const { user } = useAuth();
  const [form, setForm] = useState({
    title: "",
    description: "",
    creator_studio: "",
    release_year: "",
    source_url: "",
    poster_url: "",
  });
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  if (!user) {
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 py-16 text-center">
        <h1 className="text-xl font-black">برای پیشنهاد بازی باید وارد شوید</h1>
        <Link to="/auth">
          <Button>ورود / ثبت‌نام</Button>
        </Link>
      </div>
    );
  }

  const submit = async () => {
    const parsed = schema.safeParse({
      ...form,
      release_year: form.release_year ? Number(form.release_year) : undefined,
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
      release_year: parsed.data.release_year ?? null,
      source_url: form.source_url || null,
      poster_url: form.poster_url || null,
    });
    setBusy(false);
    if (error) {
      toast.error("ثبت پیشنهاد ناموفق بود");
      return;
    }
    toast.success("پیشنهاد شما ثبت شد و در انتظار بررسی ادمین است");
    setForm({ title: "", description: "", creator_studio: "", release_year: "", source_url: "", poster_url: "" });
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
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>محصول گروه</Label>
            <Input value={form.creator_studio} onChange={(e) => set("creator_studio")(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>سال انتشار</Label>
            <Input
              inputMode="numeric"
              value={form.release_year}
              onChange={(e) => set("release_year")(e.target.value.replace(/\D/g, ""))}
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>لینک منبع</Label>
            <Input dir="ltr" value={form.source_url} onChange={(e) => set("source_url")(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>لینک تصویر پوستر</Label>
            <Input dir="ltr" value={form.poster_url} onChange={(e) => set("poster_url")(e.target.value)} />
          </div>
        </div>
        <Button className="w-full font-bold" disabled={busy} onClick={submit}>
          ارسال پیشنهاد
        </Button>
      </div>
    </div>
  );
}
