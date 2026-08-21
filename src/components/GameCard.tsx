import { Link } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { faNum, toFa } from "@/lib/fa";
import { Skeleton } from "@/components/ui/skeleton";

export type GameCardData = {
  id: string;
  title: string;
  poster_url: string | null;
  release_year?: number | null;
  weighted_score?: number | string | null;
  votes?: number | null;
};

export function GameCard({ game }: { game: GameCardData }) {
  const score = game.weighted_score != null ? Number(game.weighted_score) : null;
  return (
    <Link
      to="/game/$gameId"
      params={{ gameId: game.id }}
      className="group block overflow-hidden rounded-xl surface-case transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-glow)]"
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-muted">
        {game.poster_url ? (
          <img
            src={game.poster_url}
            alt={`پوستر بازی ${game.title}`}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : null}
        <div className="absolute inset-0 bg-[var(--gradient-noir)]" />
        {score != null && (
          <div className="absolute top-2 left-2 flex items-center gap-1 rounded-lg bg-background/80 px-2 py-1 text-xs font-bold text-primary backdrop-blur">
            <Star className="h-3.5 w-3.5 fill-current" />
            {faNum(score, 1)}
          </div>
        )}
      </div>
      <div className="space-y-1 p-3">
        <h3 className="truncate text-sm font-bold sm:text-base">{game.title}</h3>
        {game.release_year ? (
          <p className="truncate text-xs text-muted-foreground">{toFa(game.release_year)}</p>
        ) : null}
      </div>
    </Link>
  );
}

export function GameCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl surface-case">
      <Skeleton className="aspect-[3/4] w-full" />
      <div className="space-y-2 p-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}
