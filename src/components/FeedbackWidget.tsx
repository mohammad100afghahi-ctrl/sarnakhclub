import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const KINDS = [
  { value: "bug", label: "گزارش باگ" },
  { value: "suggestion", label: "پیشنهاد" },
  { value: "other", label: "سایر" },
] as const;

export function FeedbackWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<string>("suggestion");
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async () => {
    const text = message.trim();
    if (text.length < 5) {
      toast.error("لطفاً توضیح بیشتری بنویسید.");
      return;
    }
    if (text.length > 1000) {
      toast.error("متن نباید بیشتر از ۱۰۰۰ نویسه باشد.");
      return;
    }
    setSending(true);
    const { error } = await supabase.from("feedback").insert({
      user_id: user!.id,
      kind,
      message: text,
      contact: contact.trim().slice(0, 200) || null,
    });
    setSending(false);
    if (error) {
      toast.error("ارسال نشد: " + error.message);
      return;
    }
    toast.success("بازخورد شما برای مدیران ارسال شد. ممنون!");
    setMessage("");
    setContact("");
    setKind("suggestion");
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="ارسال بازخورد به مدیران"
        className="fixed bottom-5 left-5 z-50 flex items-center gap-2 rounded-full border border-primary/40 bg-card/95 px-4 py-3 text-sm font-bold text-primary shadow-lg backdrop-blur transition-transform hover:scale-105"
      >
        <MessageSquarePlus className="h-5 w-5" />
        <span className="hidden sm:inline">بازخورد</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader className="text-right">
            <DialogTitle>ارسال بازخورد</DialogTitle>
            <DialogDescription>
              باگ، پیشنهاد یا هر نظری درباره سایت دارید برای مدیران بنویسید.
            </DialogDescription>
          </DialogHeader>

          {!user ? (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">برای ارسال بازخورد باید وارد حساب خود شوید.</p>
              <Link to="/auth" onClick={() => setOpen(false)}>
                <Button className="w-full">ورود / ثبت‌نام</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-2">
                {KINDS.map((k) => (
                  <button
                    key={k.value}
                    type="button"
                    onClick={() => setKind(k.value)}
                    className={`flex-1 rounded-lg border px-2 py-2 text-xs font-bold transition-colors ${
                      kind === k.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {k.label}
                  </button>
                ))}
              </div>
              <Textarea
                value={message}
                maxLength={1000}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="توضیح خود را بنویسید…"
                className="min-h-32"
              />
              <Input
                value={contact}
                maxLength={200}
                onChange={(e) => setContact(e.target.value)}
                placeholder="راه تماس (اختیاری) — ایمیل یا آیدی"
              />
              <Button className="w-full" disabled={sending} onClick={submit}>
                {sending ? "در حال ارسال…" : "ارسال بازخورد"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
