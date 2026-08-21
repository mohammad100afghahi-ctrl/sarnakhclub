import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toFa } from "@/lib/fa";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "پروفایل من | آرشیو پرونده" },
      { name: "description", content: "علاقه‌مندی‌ها، امتیازها، نظرها و پیشنهادهای ثبت‌شده شما در آرشیو پرونده." },
      { property: "og:title", content: "پروفایل من | آرشیو پرونده" },
      { property: "og:description", content: "مدیریت علاقه‌مندی‌ها، امتیازها و پیشنهادهای شما." },
    ],
  }),
  component: ProfilePage,
});

const statusFa: Record<string, string> = {
  pending: "در انتظار بررسی",
  approved: "تایید شده",
  rejected: "رد شده",
};

function ProfilePage() {
  const { user, profile, loading, signOut } = useAuth();

  const { data: wishlist } = useQuery({
    queryKey: ["wishlist-full", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("wishlist")
        .select("game_id, games(id,title,poster_url,release_year)")
        .eq("user_id", user!.id);
      return (data ?? []) as unknown as {
        game_id: string;
        games: { id: string; title: string; poster_url: string | null; release_year: number | null } | null;
      }[];
    },
  });

  const { data: ratings } = useQuery({
    queryKey: ["my-ratings", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("ratings")
        .select("score, game_id, games(id,title)")
        .eq("user_id", user!.id);
      return (data ?? []) as unknown as {
        score: number;
        game_id: string;
        games: { id: string; title: string } | null;
      }[];
    },
  });

  const { data: reviews } = useQuery({
    queryKey: ["my-reviews", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("reviews")
        .select("id, text, created_at, game_id, games(id,title)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return (data ?? []) as unknown as {
        id: string;
        text: string;
        created_at: string;
        game_id: string;
        games: { id: string; title: string } | null;
      }[];
    },
  });

  const { data: suggestions } = useQuery({
    queryKey: ["my-suggestions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("game_suggestions")
        .select("id,title,status,admin_note,created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  if (loading) return <div className="mx-auto max-w-4xl px-4 py-16 text-muted-foreground">در حال بارگذاری…</div>;

  if (!user)
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-20 text-center">
        <h1 className="text-xl font-bold">برای دیدن پروفایل وارد شوید</h1>
        <Link to="/auth">
          <Button>ورود / ثبت‌نام</Button>
        </Link>
      </div>
    );

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl surface-case p-6">
        <div>
          <h1 className="text-2xl font-black">{profile?.username ?? "کاربر"}</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <Button variant="secondary" onClick={() => signOut()}>
          خروج از حساب
        </Button>
      </div>

      <Tabs defaultValue="wishlist" dir="rtl">
        <TabsList className="w-full">
          <TabsTrigger value="wishlist" className="flex-1">علاقه‌مندی‌ها</TabsTrigger>
          <TabsTrigger value="ratings" className="flex-1">امتیازها</TabsTrigger>
          <TabsTrigger value="reviews" className="flex-1">نظرها</TabsTrigger>
          <TabsTrigger value="suggestions" className="flex-1">پیشنهادها</TabsTrigger>
        </TabsList>

        <TabsContent value="wishlist" className="pt-4">
          <Empty items={wishlist} text="هنوز بازی‌ای به علاقه‌مندی‌ها اضافه نکرده‌اید." />
          <div className="grid gap-3 sm:grid-cols-2">
            {(wishlist ?? []).map((w) =>
              w.games ? (
                <Link
                  key={w.game_id}
                  to="/game/$gameId"
                  params={{ gameId: w.games.id }}
                  className="rounded-xl surface-case p-4 text-sm hover:bg-accent"
                >
                  {w.games.title} {w.games.release_year ? `(${toFa(w.games.release_year)})` : ""}
                </Link>
              ) : null,
            )}
          </div>
        </TabsContent>

        <TabsContent value="ratings" className="pt-4">
          <Empty items={ratings} text="هنوز به بازی‌ای امتیاز نداده‌اید." />
          <div className="space-y-2">
            {(ratings ?? []).map((r) =>
              r.games ? (
                <div key={r.game_id} className="flex items-center justify-between rounded-xl surface-case p-4 text-sm">
                  <Link to="/game/$gameId" params={{ gameId: r.games.id }} className="hover:text-primary">
                    {r.games.title}
                  </Link>
                  <span className="font-bold text-primary">{toFa(r.score)}</span>
                </div>
              ) : null,
            )}
          </div>
        </TabsContent>

        <TabsContent value="reviews" className="pt-4">
          <Empty items={reviews} text="هنوز نظری ننوشته‌اید." />
          <div className="space-y-2">
            {(reviews ?? []).map((r) => (
              <div key={r.id} className="rounded-xl surface-case p-4 text-sm">
                {r.games && (
                  <Link to="/game/$gameId" params={{ gameId: r.games.id }} className="font-bold hover:text-primary">
                    {r.games.title}
                  </Link>
                )}
                <p className="mt-2 text-muted-foreground">{r.text}</p>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="suggestions" className="pt-4">
          <Empty items={suggestions} text="هنوز بازی‌ای پیشنهاد نداده‌اید." />
          <div className="space-y-2">
            {(suggestions ?? []).map((s) => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl surface-case p-4 text-sm">
                <span className="font-bold">{s.title}</span>
                <span className="text-xs text-muted-foreground">{statusFa[s.status] ?? s.status}</span>
                {s.admin_note && <p className="w-full text-xs text-muted-foreground">یادداشت ادمین: {s.admin_note}</p>}
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Empty({ items, text }: { items: unknown[] | undefined; text: string }) {
  if (items && items.length > 0) return null;
  return <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{text}</p>;
}
