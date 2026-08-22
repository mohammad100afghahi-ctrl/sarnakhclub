import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { faNum, toFa } from "@/lib/fa";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";


export const Route = createFileRoute("/ranking")({
  head: () => ({
    meta: [
      { title: "رتبه‌بندی بازی‌های پرونده‌ای | سرنخ" },
      {
        name: "description",
        content:
          "جدول رتبه‌بندی بازی‌های معمایی و کارآگاهی بر پایه میانگین وزنی بیزی، با فیلتر سال انتشار و رده سنی.",
      },
      { property: "og:title", content: "رتبه‌بندی بازی‌های پرونده‌ای | سرنخ" },
      { property: "og:description", content: "برترین‌های همه‌دوران، برترین‌های امسال و پرطرفدارترین پرونده‌ها." },
    ],
  }),
  component: RankingPage,
});

type Row = {
  id: string;
  title: string;
  poster_url: string | null;
  age_rating: string | null;
  raw_avg: number;
  votes: number;
  weighted_score: number;
};

function RankingPage() {
  const [tab, setTab] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["rankings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("game_rankings").select("*");
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
    staleTime: 60_000,
  });

  const rows = useMemo(() => {
    const list = [...(data ?? [])];
    if (tab === "votes") list.sort((a, b) => b.votes - a.votes || Number(b.weighted_score) - Number(a.weighted_score));
    else
      list.sort(
        (a, b) =>
          Number(b.weighted_score) - Number(a.weighted_score) ||
          b.votes - a.votes ||
          Number(b.raw_avg) - Number(a.raw_avg),
      );
    return list;
  }, [data, tab]);


  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-black sm:text-3xl">رتبه‌بندی پرونده‌ها</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          مرتب‌سازی بر پایه میانگین وزنی بیزی (فرمول IMDb): بازی‌هایی با رای کم به میانگین کل سایت نزدیک می‌شوند تا
          رتبه‌بندی منصفانه بماند.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} dir="rtl">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1">
          <TabsTrigger value="all" className="whitespace-normal px-1 py-2 text-[11px] leading-tight sm:text-sm">
            برترین‌های همه‌دوران
          </TabsTrigger>
          <TabsTrigger value="votes" className="whitespace-normal px-1 py-2 text-[11px] leading-tight sm:text-sm">
            پرطرفدارترین‌ها
          </TabsTrigger>
        </TabsList>

      </Tabs>


      <div className="overflow-hidden rounded-xl surface-case">
        <div className="hidden grid-cols-[3rem_4rem_minmax(0,1fr)_5rem_5rem] items-center gap-3 border-b border-border px-4 py-3 text-xs text-muted-foreground sm:grid">
          <span>رتبه</span>
          <span aria-hidden />
          <span aria-hidden />
          <span className="text-center">امتیاز وزنی</span>
          <span className="text-center">تعداد رای</span>
        </div>

        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 border-b border-border p-4">
                <Skeleton className="h-16 w-12 shrink-0 rounded-md" />
                <Skeleton className="h-4 w-full" />
              </div>
            ))
          : rows.map((r, i) => (
              <Link
                key={r.id}
                to="/game/$gameId"
                params={{ gameId: r.id }}
                className="grid grid-cols-[2rem_3rem_minmax(0,1fr)] items-center gap-3 border-b border-border px-3 py-3 transition-colors last:border-0 hover:bg-accent sm:grid-cols-[3rem_4rem_minmax(0,1fr)_5rem_5rem] sm:px-4"
              >
                <span className="text-sm font-black text-primary">{toFa(i + 1)}</span>
                <div className="h-16 w-12 overflow-hidden rounded-md bg-muted">
                  {r.poster_url && (
                    <img src={r.poster_url} alt={r.title} loading="lazy" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{r.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground sm:hidden">
                    وزنی {faNum(Number(r.weighted_score), 1)} · {faNum(r.votes)} رای
                  </p>
                </div>
                <span className="hidden text-center text-base font-black text-primary sm:block">
                  {faNum(Number(r.weighted_score), 1)}
                </span>
                <span className="hidden text-center text-sm text-muted-foreground sm:block">{faNum(r.votes)}</span>
              </Link>
            ))}
        {!isLoading && rows.length === 0 && (
          <p className="p-8 text-center text-sm text-muted-foreground">هنوز پرونده‌ای ثبت نشده است.</p>
        )}
      </div>
    </div>
  );
}
