import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Flame, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { GameCard, GameCardSkeleton, type GameCardData } from "@/components/GameCard";
import { Button } from "@/components/ui/button";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "آرشیو پرونده | مرجع بازی‌های معمایی و کارآگاهی" },
      {
        name: "description",
        content:
          "معرفی، رتبه‌بندی و امتیازدهی به بازی‌های پرونده‌ای: بازی‌های فکری، معمایی، کارآگاهی و دیداکشن، رومیزی و ویدیویی، به زبان فارسی.",
      },
      { property: "og:title", content: "آرشیو پرونده | مرجع بازی‌های معمایی و کارآگاهی" },
      {
        property: "og:description",
        content: "پرونده‌های برگزیده، تازه‌ترین بازی‌ها و رتبه‌بندی منصفانه بر پایه میانگین وزنی بیزی.",
      },
    ],
  }),
  component: Index,
});

type RankRow = GameCardData & { raw_avg: number | null; views: number; featured: boolean; created_at: string };

function useRankings() {
  return useQuery({
    queryKey: ["rankings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("game_rankings").select("*");
      if (error) throw error;
      return (data ?? []) as unknown as RankRow[];
    },
  });
}

function Section({
  title,
  icon,
  games,
  loading,
}: {
  title: string;
  icon: React.ReactNode;
  games: RankRow[];
  loading: boolean;
}) {
  return (
    <section className="space-y-4">
      <h2 className="flex items-center gap-2 text-lg font-extrabold sm:text-xl">
        <span className="text-primary">{icon}</span>
        {title}
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => <GameCardSkeleton key={i} />)
          : games.map((g) => <GameCard key={g.id} game={g} />)}
      </div>
    </section>
  );
}

function Index() {
  const { data, isLoading } = useRankings();
  const games = data ?? [];
  const featured = games.filter((g) => g.featured).slice(0, 6);
  const newest = [...games].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5);
  const popular = [...games].sort((a, b) => (b.views ?? 0) - (a.views ?? 0)).slice(0, 5);

  return (
    <div className="mx-auto max-w-6xl space-y-12 px-4 py-8">
      <section className="overflow-hidden rounded-2xl surface-case">
        <div className="space-y-4 p-6 sm:p-10">
          <p className="text-xs font-bold tracking-widest text-primary">پرونده‌های برگزیده هفته</p>
          <h1 className="text-2xl font-black leading-relaxed sm:text-4xl">
            هر بازی، یک <span className="text-gradient-gold">پرونده باز</span> است
          </h1>
          <p className="max-w-xl text-sm text-muted-foreground sm:text-base">
            مرجع فارسی معرفی، نقد و رتبه‌بندی بازی های معمایی.
          </p>
          <Link to="/ranking">
            <Button size="lg" className="gap-2 font-bold">
              مشاهده رتبه‌بندی کامل
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto px-6 pb-6 sm:px-10">
          {(isLoading ? Array.from({ length: 4 }) : featured).map((g, i) => (
            <div key={(g as RankRow)?.id ?? i} className="w-40 shrink-0 snap-start sm:w-48">
              {isLoading ? <GameCardSkeleton /> : <GameCard game={g as RankRow} />}
            </div>
          ))}
        </div>
      </section>

      <Section title="تازه‌ترین پرونده‌ها" icon={<Sparkles className="h-5 w-5" />} games={newest} loading={isLoading} />
      <Section title="پرمخاطب‌ترین‌ها این هفته" icon={<Flame className="h-5 w-5" />} games={popular} loading={isLoading} />
    </div>
  );
}
