import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "ورود و ثبت‌نام | آرشیو پرونده" },
      { name: "description", content: "برای ثبت امتیاز، نوشتن نظر و ساختن لیست علاقه‌مندی وارد آرشیو پرونده شوید." },
      { property: "og:title", content: "ورود و ثبت‌نام | آرشیو پرونده" },
      { property: "og:description", content: "ورود با ایمیل و رمز عبور یا حساب گوگل." },
    ],
  }),
  component: AuthPage,
});

const schema = z.object({
  email: z.string().trim().email({ message: "ایمیل معتبر نیست" }).max(255),
  password: z.string().min(6, { message: "رمز عبور حداقل ۶ کاراکتر" }).max(72),
  username: z.string().trim().min(2, { message: "نام کاربری کوتاه است" }).max(40).optional(),
});

function AuthPage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");

  const submit = async (mode: "in" | "up") => {
    const parsed = schema.safeParse({ email, password, username: mode === "up" ? username : undefined });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "ورودی نامعتبر");
      return;
    }
    setBusy(true);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) return toast.error("ورود ناموفق: ایمیل یا رمز عبور اشتباه است");
      toast.success("خوش آمدید");
      navigate({ to: "/" });
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin, data: { username } },
      });
      setBusy(false);
      if (error) return toast.error(error.message);
      toast.success("ثبت‌نام انجام شد. لینک تایید به ایمیل شما ارسال شد.");
    }
  };

  const google = async () => {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) return toast.error("ورود با گوگل ناموفق بود");
    if (result.redirected) return;
    navigate({ to: "/" });
  };

  const reset = async () => {
    if (!email) return toast.error("ابتدا ایمیل خود را وارد کنید");
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    if (error) return toast.error(error.message);
    toast.success("لینک بازیابی رمز به ایمیل شما ارسال شد");
  };

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-12">
      <h1 className="text-center text-2xl font-black">ورود به آرشیو پرونده</h1>
      <div className="rounded-2xl surface-case p-6">
        <Tabs defaultValue="in" dir="rtl">
          <TabsList className="w-full">
            <TabsTrigger value="in" className="flex-1">ورود</TabsTrigger>
            <TabsTrigger value="up" className="flex-1">ثبت‌نام</TabsTrigger>
          </TabsList>

          <TabsContent value="in" className="space-y-4 pt-4">
            <Field label="ایمیل" value={email} onChange={setEmail} type="email" />
            <Field label="رمز عبور" value={password} onChange={setPassword} type="password" />
            <Button className="w-full font-bold" disabled={busy} onClick={() => submit("in")}>
              ورود
            </Button>
            <button onClick={reset} className="w-full text-xs text-muted-foreground hover:text-primary">
              رمز عبور را فراموش کرده‌اید؟
            </button>
          </TabsContent>

          <TabsContent value="up" className="space-y-4 pt-4">
            <Field label="نام کاربری" value={username} onChange={setUsername} />
            <Field label="ایمیل" value={email} onChange={setEmail} type="email" />
            <Field label="رمز عبور" value={password} onChange={setPassword} type="password" />
            <Button className="w-full font-bold" disabled={busy} onClick={() => submit("up")}>
              ساخت حساب
            </Button>
            <p className="text-xs text-muted-foreground">پس از ثبت‌نام، لینک تایید به ایمیل شما ارسال می‌شود.</p>
          </TabsContent>
        </Tabs>

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          یا
          <span className="h-px flex-1 bg-border" />
        </div>
        <Button variant="secondary" className="w-full" onClick={google}>
          ورود با حساب گوگل
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
