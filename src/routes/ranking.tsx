import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { faNum, toFa, AGE_RATINGS } from "@/lib/fa";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/ranking")({
  head: () => ({
    meta: [
      { title: "رتبه‌بندی بازی‌های پرونده‌ای | آرشیو پرونده" },
      {
        name: "description",
        content:
          "جدول رتبه‌بندی بازی‌های معمایی و کارآگاهی بر پایه میانگین وزنی بیزی، با فیلتر سال انتشار و رده سنی.",
      },
      { property: "og:title", content: "رتبه‌بندی بازی‌های پرونده‌ای | آرشیو پرونده" },
      { property: "og:description", content: "برترین‌های همه‌دوران، برترین‌های امسال و پرطرفدارترین پرونده‌ها." },
    ],
  }),
  component: RankingPage,
});

type Row = {
  id: string;
  title: string;
  poster_url: string | null;
  release_year: number | null;
  age_rating: string | null;
  raw_avg: number;
  votes: number;
  weighted_score: number;
};

const ALL = "همه";

function RankingPage() {
  const [tab, setTab] = useState("all");
  const [year, setYear] = useState(ALL);
  const [age, setAge] = useState(ALL);

  const { data, isLoading } = useQuery({
    queryKey: ["rankings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("game_rankings").select("*");
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
    staleTime: 60_000,
  });

  const years = useMemo(
    () => Array.from(new Set((data ?? []).map((r) => r.release_year).filter(Boolean))).sort((a, b) => b! - a!),
    [data],
  );

  const rows = useMemo(() => {
    let list = [...(data ?? [])];
    if (year !== ALL) list = list.filter((r) => String(r.release_year) === year);
    if (age !== ALL) list = list.filter((r) => r.age_rating === age);
    if (tab === "year") list = list.filter((r) => r.release_year === new Date().getFullYear());
    if (tab === "votes") list.sort((a, b) => b.votes - a.votes);
    else list.sort((a, b) => Number(b.weighted_score) - Number(a.weighted_score));
    return list;
  }, [data, year, age, tab]);

  const filters = [
    { label: "سال", value: year, set: setYear, options: years.map((y) => String(y)) },
    { label: "رده سنی", value: age, set: setAge, options: AGE_RATINGS as readonly string[] },
  ];

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
        <TabsList className="w-full">
          <TabsTrigger value="all" className="flex-1">برترین‌های همه‌دوران</TabsTrigger>
          <TabsTrigger value="year" className="flex-1">برترین‌های امسال</TabsTrigger>
          <TabsTrigger value="votes" className="flex-1">پرطرفدارترین‌ها</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {filters.map((f) => (
          <Select key={f.label} value={f.value} onValueChange={f.set} dir="rtl">
            <SelectTrigger aria-label={f.label}>
              <SelectValue placeholder={f.label} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{f.label}: همه</SelectItem>
              {f.options.map((o) => (
                <SelectItem key={o} value={o}>
                  {toFa(o)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
      </div>

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
                  <p className="truncate text-xs text-muted-foreground">
                    {toFa(r.release_year ?? "")}
                  </p>
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
          <p className="p-8 text-center text-sm text-muted-foreground">پرونده‌ای با این فیلترها پیدا نشد.</p>
        )}
      </div>
    </div>
  );
}
