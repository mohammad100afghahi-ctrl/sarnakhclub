import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, Star, ThumbsDown, ThumbsUp, Flag, EyeOff, Trash2, CheckCircle2, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GameCard, type GameCardData } from "@/components/GameCard";
import { GameQuickEdit } from "@/components/admin/GameQuickEdit";

import { faAge, faDate, faDurationRange, faNum, toFa } from "@/lib/fa";

export const Route = createFileRoute("/game/$gameId")({
  loader: async ({ params }) => {
    const { data } = await supabase
      .from("game_rankings")
      .select("id, title, description, poster_url, raw_avg, votes")
      .eq("id", params.gameId)
      .maybeSingle();
    return { game: data as unknown as {
      id: string;
      title: string;
      description: string | null;
      poster_url: string | null;
      raw_avg: number | null;
      votes: number | null;
    } | null };
  },
  head: ({ params, loaderData }) => {
    const g = loaderData?.game;
    const name = g?.title ?? "پرونده بازی";
    const title = `${name} | سرنخ`;
    const desc = (g?.description ?? "جزئیات کامل بازی: امتیاز، نظرات کاربران و پرونده‌های مشابه.")
      .replace(/\s+/g, " ")
      .slice(0, 155);
    const url = `https://sarnakhclub.lovable.app/game/${params.gameId}`;
    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: desc },
      { property: "og:title", content: title },
      { property: "og:description", content: desc },
      { property: "og:type", content: "article" },
      { property: "og:url", content: url },
    ];
    if (g?.poster_url?.startsWith("https://")) {
      meta.push({ property: "og:image", content: g.poster_url });
      meta.push({ name: "twitter:image", content: g.poster_url });
    }
    const ld: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "Game",
      name,
      url,
      ...(g?.description ? { description: g.description } : {}),
      ...(g?.poster_url ? { image: g.poster_url } : {}),
    };
    if (g?.raw_avg && (g?.votes ?? 0) > 0) {
      ld["aggregateRating"] = {
        "@type": "AggregateRating",
        ratingValue: Number(g.raw_avg).toFixed(1),
        ratingCount: g.votes,
        bestRating: 10,
        worstRating: 1,
      };
    }
    return {
      meta,
      links: [{ rel: "canonical", href: url }],
      scripts: [{ type: "application/ld+json", children: JSON.stringify(ld) }],
    };
  },
  component: GamePage,
});


type Review = {
  id: string;
  user_id: string;
  text: string;
  is_spoiler: boolean;
  helpful_count: number;
  unhelpful_count: number;
  created_at: string;
  profiles?: { username: string; avatar_url: string | null } | null;
};

function GamePage() {
  const { gameId } = Route.useParams();
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const [sort, setSort] = useState("popular");
  const [reviewText, setReviewText] = useState("");
  const [spoiler, setSpoiler] = useState(false);
  const [revealed, setRevealed] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [reportFor, setReportFor] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoText, setInfoText] = useState("");

  const { data: game, isLoading } = useQuery({
    queryKey: ["game", gameId],
    queryFn: async () => {
      const { data, error } = await supabase.from("game_rankings").select("*").eq("id", gameId).maybeSingle();
      if (error) throw error;
      return data as Record<string, never> | null;
    },
  });

  const { data: rankInfo } = useQuery({
    queryKey: ["game-rank", gameId],
    queryFn: async () => {
      const { data } = await supabase.from("game_rankings").select("id, weighted_score");
      const list = [...((data ?? []) as unknown as { id: string; weighted_score: number }[])].sort(
        (a, b) => Number(b.weighted_score) - Number(a.weighted_score),
      );
      const idx = list.findIndex((r) => r.id === gameId);
      return idx === -1 ? null : { rank: idx + 1, total: list.length };
    },
    staleTime: 60_000,
  });

  const { data: similar } = useQuery({
    queryKey: ["similar", gameId],
    enabled: !!game,
    queryFn: async () => {
      const { data } = await supabase.from("game_rankings").select("*").neq("id", gameId).limit(5);
      return (data ?? []) as unknown as GameCardData[];
    },
  });


  const { data: reviews } = useQuery({
    queryKey: ["reviews", gameId, sort],
    queryFn: async () => {
      const q = supabase.from("reviews").select("*").eq("game_id", gameId);
      const { data, error } =
        sort === "popular"
          ? await q.order("helpful_count", { ascending: false })
          : await q.order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as unknown as Review[];
      const ids = Array.from(new Set(rows.map((r) => r.user_id)));
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, username, avatar_url")
          .in("id", ids);
        const map = new Map((profs ?? []).map((p) => [p.id, p]));
        rows.forEach((r) => {
          const p = map.get(r.user_id);
          r.profiles = p ? { username: p.username, avatar_url: p.avatar_url } : null;
        });
      }
      return rows;
    },
  });

  const { data: myVotes } = useQuery({
    queryKey: ["my-review-votes", gameId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("review_votes").select("review_id, vote_type").eq("user_id", user!.id);
      return Object.fromEntries((data ?? []).map((v) => [v.review_id, v.vote_type])) as Record<string, string>;
    },
  });


  const { data: myRating } = useQuery({
    queryKey: ["my-rating", gameId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("ratings")
        .select("score")
        .eq("game_id", gameId)
        .eq("user_id", user!.id)
        .maybeSingle();
      return data?.score ?? null;
    },
  });

  const { data: inWishlist } = useQuery({
    queryKey: ["wishlist", gameId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("wishlist")
        .select("game_id")
        .eq("game_id", gameId)
        .eq("user_id", user!.id)
        .maybeSingle();
      return !!data;
    },
  });

  const needLogin = () => toast.error("برای این کار باید وارد حساب خود شوید");

  const rate = async (score: number) => {
    if (!user) { needLogin(); return; }
    const { error } = await supabase
      .from("ratings")
      .upsert({ user_id: user.id, game_id: gameId, score }, { onConflict: "user_id,game_id" });
    if (error) {
      toast.error("ثبت امتیاز ناموفق بود");
      return;
    }
    toast.success(`امتیاز ${toFa(score)} ثبت شد`);
    qc.invalidateQueries();
  };

  const { data: played } = useQuery({
    queryKey: ["played", gameId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("played_games")
        .select("game_id")
        .eq("game_id", gameId)
        .eq("user_id", user!.id)
        .maybeSingle();
      return !!data;
    },
  });

  const togglePlayed = async () => {
    if (!user) { needLogin(); return; }
    if (played) await supabase.from("played_games").delete().eq("user_id", user.id).eq("game_id", gameId);
    else await supabase.from("played_games").insert({ user_id: user.id, game_id: gameId });
    qc.invalidateQueries({ queryKey: ["played"] });
    toast.success(played ? "از لیست بازی شده حذف شد" : "به لیست بازی شده اضافه شد");
  };

  const toggleWishlist = async () => {
    if (!user) { needLogin(); return; }
    if (inWishlist) await supabase.from("wishlist").delete().eq("user_id", user.id).eq("game_id", gameId);
    else await supabase.from("wishlist").insert({ user_id: user.id, game_id: gameId });
    qc.invalidateQueries({ queryKey: ["wishlist"] });
    toast.success(inWishlist ? "از علاقه‌مندی‌ها حذف شد" : "به علاقه‌مندی‌ها اضافه شد");
  };


  const myReview = (reviews ?? []).find((r) => r.user_id === user?.id) ?? null;

  const startEdit = () => {
    if (!myReview) return;
    setReviewText(myReview.text);
    setSpoiler(myReview.is_spoiler);
    setEditing(true);
  };

  const submitReview = async () => {
    if (!user) { needLogin(); return; }
    const text = reviewText.trim();
    if (text.length < 3 || text.length > 2000) {
      toast.error("متن نظر باید بین ۳ تا ۲۰۰۰ کاراکتر باشد");
      return;
    }
    const { error } = await supabase
      .from("reviews")
      .upsert(
        { user_id: user.id, game_id: gameId, text, is_spoiler: spoiler },
        { onConflict: "user_id,game_id" },
      );
    if (error) {
      toast.error("ثبت نظر ناموفق بود");
      return;
    }
    setReviewText("");
    setSpoiler(false);
    setEditing(false);
    toast.success(myReview ? "نظر شما ویرایش شد" : "نظر شما ثبت شد");
    qc.invalidateQueries({ queryKey: ["reviews"] });
  };


  const voteReview = async (reviewId: string, type: "helpful" | "unhelpful") => {
    if (!user) { needLogin(); return; }
    if (myVotes?.[reviewId] === type) {
      await supabase.from("review_votes").delete().eq("review_id", reviewId).eq("user_id", user.id);
    } else {
      const { error } = await supabase
        .from("review_votes")
        .upsert({ review_id: reviewId, user_id: user.id, vote_type: type }, { onConflict: "review_id,user_id" });
      if (error) { toast.error("ثبت رای ناموفق بود"); return; }
    }
    qc.invalidateQueries({ queryKey: ["reviews"] });
    qc.invalidateQueries({ queryKey: ["my-review-votes"] });
  };

  const deleteReview = async (reviewId: string) => {
    const { error } = await supabase.from("reviews").delete().eq("id", reviewId);
    if (error) { toast.error("حذف نظر ناموفق بود"); return; }
    toast.success("نظر حذف شد");
    qc.invalidateQueries({ queryKey: ["reviews"] });
  };

  const openReport = (reviewId: string) => {
    if (!user) { needLogin(); return; }
    setReportFor(reviewId);
    setReportReason("");
  };

  const submitReport = async () => {
    if (!user || !reportFor) return;
    const reason = reportReason.trim();
    if (reason.length < 3) { toast.error("لطفاً دلیل گزارش را بنویسید"); return; }
    const { error } = await supabase
      .from("review_reports")
      .insert({ review_id: reportFor, user_id: user.id, reason });
    if (error) { toast.error("ثبت گزارش ناموفق بود"); return; }
    toast.success("گزارش شما ثبت شد و توسط مدیران بررسی می‌شود");
    setReportFor(null);
    setReportReason("");
  };

  const submitInfoReport = async () => {
    if (!user) { needLogin(); return; }
    const text = infoText.trim();
    if (text.length < 3) { toast.error("لطفاً توضیح دهید کدام اطلاعات نادرست است"); return; }
    const title = (game as unknown as { title?: string } | null)?.title ?? "";
    const { error } = await supabase.from("feedback").insert({
      user_id: user.id,
      kind: "game_info",
      message: `پرونده: ${title}\nلینک: /game/${gameId}\n\n${text}`,
    });
    if (error) { toast.error("ثبت گزارش ناموفق بود"); return; }
    toast.success("گزارش شما ثبت شد و توسط مدیران بررسی می‌شود");
    setInfoOpen(false);
    setInfoText("");
  };


  if (isLoading) {
    return (
      <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8 sm:grid-cols-[240px_minmax(0,1fr)]">
        <Skeleton className="aspect-[3/4] w-full rounded-xl" />
        <div className="space-y-3">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!game) {
    return <p className="px-4 py-16 text-center text-muted-foreground">این پرونده پیدا نشد.</p>;
  }

  const g = game as unknown as {
    title: string;
    description: string;
    creator_studio: string | null;
    min_players: number | null;
    max_players: number | null;
    age_rating: string | null;
    duration_minutes: number | null;
    duration_max_minutes: number | null;
    poster_url: string | null;
    raw_avg: number;
    votes: number;
    weighted_score: number;
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-6 sm:space-y-10 sm:py-8">
      <div className="grid gap-5 sm:grid-cols-[240px_minmax(0,1fr)] sm:gap-6">
        <div className="mx-auto w-40 self-start overflow-hidden rounded-xl surface-case sm:mx-0 sm:w-auto">
          <div className="aspect-[3/4] bg-muted">
            {g.poster_url && (
              <img src={g.poster_url} alt={`پوستر ${g.title}`} className="h-full w-full object-cover" />
            )}
          </div>
        </div>


        <div className="min-w-0 space-y-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-black sm:text-3xl">{g.title}</h1>
              {isAdmin && user && (
                <div className="flex items-center gap-2">
                  <GameQuickEdit gameId={gameId} userId={user.id} />
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    title="جستجوی این پرونده در وب"
                    onClick={() => {
                      const q = `پرونده معمایی ${g.title}`;
                      window.open(
                        `https://www.google.com/search?q=${encodeURIComponent(q)}`,
                        "_blank",
                        "noopener,noreferrer",
                      );
                    }}
                  >
                    <Search className="h-4 w-4" />
                    جستجوی پرونده
                  </Button>
                </div>
              )}
            </div>

            <p className="mt-1 text-sm text-muted-foreground">
              {g.creator_studio ? (
                <Link
                  to="/studio/$studio"
                  params={{ studio: encodeURIComponent(g.creator_studio) }}
                  className="text-primary hover:underline"
                >
                  {g.creator_studio}
                </Link>
              ) : (
                "نامشخص"
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 rounded-xl surface-case p-3 sm:gap-4 sm:p-4">
            <div className="flex items-baseline gap-1">
              <Star className="h-5 w-5 fill-current text-primary sm:h-6 sm:w-6" />
              <span className="text-3xl font-black text-primary sm:text-4xl">{faNum(Number(g.raw_avg), 1)}</span>
              <span className="text-sm text-muted-foreground">/ ۱۰</span>
            </div>
            <div className="text-xs text-muted-foreground">
              <p>{faNum(g.votes)} رای‌دهنده</p>
              <p>امتیاز وزنی: {faNum(Number(g.weighted_score), 1)}</p>
            </div>
            {rankInfo && (
              <Link
                to="/ranking"
                className="rounded-lg border border-border px-3 py-2 text-xs transition-colors hover:bg-accent"
              >
                <span className="text-muted-foreground">رتبه فعلی: </span>
                <span className="text-base font-black text-primary">{toFa(rankInfo.rank)}</span>
              </Link>
            )}

            <div className="grid w-full grid-cols-2 gap-2 sm:mr-auto sm:flex sm:w-auto sm:flex-wrap">
              <Button
                variant={played ? "secondary" : "outline"}
                className="gap-2 px-2 text-xs sm:px-4 sm:text-sm"
                onClick={togglePlayed}
              >
                <CheckCircle2 className={played ? "h-4 w-4 shrink-0 fill-current text-primary" : "h-4 w-4 shrink-0"} />
                <span className="truncate">بازی شده</span>
              </Button>
              <Button
                variant={inWishlist ? "secondary" : "outline"}
                className="gap-2 px-2 text-xs sm:px-4 sm:text-sm"
                onClick={toggleWishlist}
              >
                <Heart className={inWishlist ? "h-4 w-4 shrink-0 fill-current text-primary" : "h-4 w-4 shrink-0"} />
                <span className="truncate">{inWishlist ? "در علاقه‌مندی‌ها" : "علاقه‌مندی‌ها"}</span>
              </Button>
            </div>

          </div>

          <div className="rounded-xl surface-case p-3 sm:p-4">
            <p className="mb-2 text-sm font-bold">امتیاز شما {myRating ? `(${toFa(myRating)})` : ""}</p>
            <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-10">
              {Array.from({ length: 10 }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => rate(i + 1)}
                  className={`h-9 rounded-md border border-border text-xs font-bold transition-colors hover:bg-primary hover:text-primary-foreground sm:text-sm ${
                    myRating && myRating >= i + 1 ? "bg-primary/20 text-primary" : "bg-secondary"
                  }`}
                >
                  {toFa(i + 1)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <Info label="تعداد بازیکن" value={`${toFa(g.min_players ?? "?")} تا ${toFa(g.max_players ?? "?")}`} />
            <Info label="رده سنی" value={faAge(g.age_rating)} />
            <Info label="مدت بازی" value={faDurationRange(g.duration_minutes, g.duration_max_minutes)} />
          </div>


          <p className="leading-8 text-muted-foreground">{g.description}</p>

        </div>
      </div>

      <section className="space-y-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <h2 className="truncate text-lg font-extrabold">نظرات کاربران</h2>
          <Tabs value={sort} onValueChange={setSort} dir="rtl">
            <TabsList>
              <TabsTrigger value="popular">محبوب‌ترین</TabsTrigger>
              <TabsTrigger value="new">جدیدترین</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {myReview && !editing ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl surface-case p-4">
            <p className="text-sm text-muted-foreground">شما برای این پرونده یک نظر ثبت کرده‌اید.</p>
            <Button variant="outline" onClick={startEdit}>ویرایش نظر من</Button>
          </div>
        ) : (
          <div className="space-y-3 rounded-xl surface-case p-4">
            <Textarea
              rows={3}
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="نظر خود را درباره این پرونده بنویسید…"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={spoiler} onCheckedChange={(c) => setSpoiler(!!c)} />
                این نظر حاوی اسپویلر است
              </label>
              <div className="flex gap-2">
                {editing && (
                  <Button
                    variant="ghost"
                    onClick={() => { setEditing(false); setReviewText(""); setSpoiler(false); }}
                  >
                    انصراف
                  </Button>
                )}
                <Button onClick={submitReview}>{editing ? "ذخیره ویرایش" : "ثبت نظر"}</Button>
              </div>
            </div>
          </div>
        )}


        {(reviews ?? []).map((r) => {
          const hidden = r.is_spoiler && !revealed.includes(r.id);
          return (
            <article key={r.id} className="space-y-3 rounded-xl surface-case p-4">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <p className="truncate text-sm font-bold">{r.profiles?.username ?? "کاربر"}</p>
                <span className="shrink-0 text-xs text-muted-foreground">{faDate(r.created_at)}</span>
              </div>
              <div className="relative">
                <p className={`text-sm leading-7 ${hidden ? "blur-sm select-none" : ""}`}>{r.text}</p>
                {hidden && (
                  <button
                    onClick={() => setRevealed((p) => [...p, r.id])}
                    className="absolute inset-0 flex items-center justify-center gap-2 text-xs font-bold text-primary"
                  >
                    <EyeOff className="h-4 w-4" /> حاوی اسپویلر — برای نمایش کلیک کنید
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Button
                  size="sm"
                  variant="ghost"
                  className={`gap-1 ${myVotes?.[r.id] === "helpful" ? "text-primary" : ""}`}
                  onClick={() => voteReview(r.id, "helpful")}
                >
                  <ThumbsUp className="h-4 w-4" /> {faNum(r.helpful_count)}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className={`gap-1 ${myVotes?.[r.id] === "unhelpful" ? "text-destructive" : ""}`}
                  onClick={() => voteReview(r.id, "unhelpful")}
                >
                  <ThumbsDown className="h-4 w-4" /> {faNum(r.unhelpful_count)}
                </Button>
                <Button size="sm" variant="ghost" className="gap-1 text-muted-foreground" onClick={() => openReport(r.id)}>
                  <Flag className="h-4 w-4" /> گزارش
                </Button>
                {(isAdmin || r.user_id === user?.id) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1 text-destructive"
                    onClick={() => deleteReview(r.id)}
                  >
                    <Trash2 className="h-4 w-4" /> حذف
                  </Button>
                )}
              </div>

            </article>
          );
        })}
        {reviews?.length === 0 && (
          <p className="rounded-xl surface-case p-6 text-center text-sm text-muted-foreground">
            هنوز نظری ثبت نشده است. اولین نفر باشید.
          </p>
        )}
      </section>

      {!!similar?.length && (
        <section className="space-y-4">
          <h2 className="text-lg font-extrabold">پرونده‌های مشابه</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {similar.map((s) => (
              <GameCard key={s.id} game={s} />
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-col items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => (user ? setInfoOpen(true) : needLogin())}
        >
          <Flag className="h-4 w-4" /> گزارش نادرست بودن اطلاعات پرونده
        </Button>
        <Link to="/ranking" className="text-sm text-primary hover:underline">
          بازگشت به جدول رتبه‌بندی
        </Link>
      </div>

      <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>گزارش نادرست بودن اطلاعات</DialogTitle>
            <DialogDescription>
              بنویسید کدام بخش از اطلاعات این پرونده نادرست است و مقدار درست چیست. مدیران بررسی و اصلاح می‌کنند.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={infoText}
            onChange={(e) => setInfoText(e.target.value)}
            placeholder="مثلاً: تعداد بازیکن‌ها اشتباه است، درستش ۴ تا ۸ نفر است."
            rows={4}
          />
          <DialogFooter className="gap-2">
            <Button variant="secondary" onClick={() => setInfoOpen(false)}>انصراف</Button>
            <Button onClick={submitInfoReport}>ارسال گزارش</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <Dialog open={!!reportFor} onOpenChange={(o) => !o && setReportFor(null)}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>گزارش نظر</DialogTitle>
            <DialogDescription>
              دلیل گزارش را بنویسید (توهین، اسپویل بدون هشدار، تبلیغ، محتوای نامناسب و...). مدیران بررسی می‌کنند.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            placeholder="دلیل گزارش..."
            rows={4}
          />
          <DialogFooter className="gap-2">
            <Button variant="secondary" onClick={() => setReportFor(null)}>انصراف</Button>
            <Button onClick={submitReport}>ارسال گزارش</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-secondary/60 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-bold">{value}</p>
    </div>
  );
}
