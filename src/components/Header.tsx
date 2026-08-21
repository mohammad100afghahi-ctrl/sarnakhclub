import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Menu, Search, ShieldCheck, User as UserIcon, X, FileSearch } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";

type Suggestion = { id: string; title: string; creator_studio: string | null };

const navItems = [
  { to: "/", label: "خانه" },
  { to: "/ranking", label: "رتبه‌بندی" },
  { to: "/suggest", label: "پیشنهاد پرونده" },
] as const;

export function Header() {
  const { user, isAdmin, signOut } = useAuth();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const term = `%${q.trim()}%`;
      const { data } = await supabase
        .from("games")
        .select("id,title,creator_studio")
        .or(`title.ilike.${term},creator_studio.ilike.${term}`)
        .eq("status", "active")
        .limit(6);
      setResults(data ?? []);
      setOpen(true);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto max-w-6xl px-3 py-2 sm:px-4 sm:py-3">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:gap-3">
          <div className="flex min-w-0 items-center gap-1 sm:gap-2">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon" aria-label="منو">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72">
                <SheetTitle className="text-right text-gradient-gold">سرنخ</SheetTitle>
                <nav className="mt-6 flex flex-col gap-1">
                  {navItems.map((i) => (
                    <Link
                      key={i.to}
                      to={i.to}
                      onClick={() => setMenuOpen(false)}
                      className="rounded-lg px-3 py-2 text-sm hover:bg-accent"
                    >
                      {i.label}
                    </Link>
                  ))}
                  {user && (
                    <Link to="/profile" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2 text-sm hover:bg-accent">
                      پروفایل من
                    </Link>
                  )}
                  {isAdmin && (
                    <Link to="/admin" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2 text-sm hover:bg-accent">
                      پنل مدیریت
                    </Link>
                  )}
                </nav>
              </SheetContent>
            </Sheet>

            <Link to="/" className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <FileSearch className="h-5 w-5 shrink-0 text-primary sm:h-6 sm:w-6" />
              <span className="text-base font-extrabold text-gradient-gold sm:text-lg">سرنخ</span>
            </Link>

            <nav className="hidden items-center gap-1 md:flex">
              {navItems.map((i) => (
                <Link
                  key={i.to}
                  to={i.to}
                  activeProps={{ className: "text-primary" }}
                  className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {i.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="hidden md:block" />

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            {isAdmin && (
              <Link to="/admin" className="hidden md:block">
                <Button variant="ghost" size="icon" aria-label="پنل مدیریت">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                </Button>
              </Link>
            )}
            {user ? (
              <>
                <Link to="/profile">
                  <Button variant="secondary" size="sm" className="gap-2">
                    <UserIcon className="h-4 w-4" />
                    <span className="hidden sm:inline">پروفایل</span>
                  </Button>
                </Link>
                <Button variant="ghost" size="icon" aria-label="خروج" onClick={() => signOut()}>
                  <X className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <Link to="/auth">
                <Button size="sm" className="px-3 text-xs sm:text-sm">
                  ورود / ثبت‌نام
                </Button>
              </Link>
            )}
          </div>

        <div
          className="relative col-span-3 row-start-2 mt-2 min-w-0 md:col-span-1 md:col-start-2 md:row-start-1 md:mt-0"
          ref={boxRef}
        >

          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => results.length && setOpen(true)}
            placeholder="نام بازی، سازنده…"
            className="h-9 pr-9 text-sm"
            aria-label="جستجو"
          />
          {open && results.length > 0 && (
            <div className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-xl surface-case">
              {results.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    setOpen(false);
                    setQ("");
                    navigate({ to: "/game/$gameId", params: { gameId: r.id } });
                  }}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-right text-sm hover:bg-accent"
                >
                  <span className="truncate">{r.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{r.creator_studio ?? ""}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        </div>
      </div>

    </header>
  );
}
