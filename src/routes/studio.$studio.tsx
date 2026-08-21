import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { GameCard, GameCardSkeleton, type GameCardData } from "@/components/GameCard";

export const Route = createFileRoute("/studio/$studio")({
  head: ({ params }) => {
    const name = decodeURIComponent(params.studio);
    return {
      meta: [
        { title: `پرونده‌های ${name} | آرشیو پرونده` },
        { name: "description", content: `فهرست کامل بازی‌ها و پرونده‌های معمایی محصول گروه ${name} در آرشیو پرونده.` },
        { property: "og:title", content: `پرونده‌های ${name} | آرشیو پرونده` },
        { property: "og:description", content: `همه پرونده‌های ثبت‌شده از ${name}.` },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: StudioPage,
  errorComponent: () => <p className="px-4 py-16 text-center text-muted-foreground">خطا در بارگذاری پرونده‌ها.</p>,
  notFoundComponent: () => <p className="px-4 py-16 text-center text-muted-foreground">گروهی با این نام پیدا نشد.</p>,
});

function StudioPage() {
  const { studio } = Route.useParams();
  const name = decodeURIComponent(studio);

  const { data, isLoading } = useQuery({
    queryKey: ["studio-games", name],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("games")
        .select("id,title,poster_url")
        .eq("status", "active")
        .ilike("creator_studio", name)
        .order("title");
      if (error) throw error;
      return (data ?? []) as unknown as GameCardData[];
    },
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div>
        <p className="text-sm text-muted-foreground">محصول گروه</p>
        <h1 className="text-2xl font-black sm:text-3xl">{name}</h1>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => <GameCardSkeleton key={i} />)
          : (data ?? []).map((g) => <GameCard key={g.id} game={g} />)}
      </div>

      {!isLoading && !data?.length && (
        <p className="py-12 text-center text-sm text-muted-foreground">
          پرونده‌ای از این گروه ثبت نشده است. <Link to="/" className="text-primary">بازگشت به خانه</Link>
        </p>
      )}
    </div>
  );
}
