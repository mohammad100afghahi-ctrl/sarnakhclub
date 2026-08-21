import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

const BASE_URL = "https://sarnakhclub.lovable.app";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "daily", priority: "1.0" },
          { path: "/ranking", changefreq: "daily", priority: "0.9" },
          { path: "/suggest", changefreq: "monthly", priority: "0.5" },
        ];

        const { data: games } = await supabase
          .from("game_rankings")
          .select("id, creator_studio")
          .eq("status", "active");

        const studios = new Set<string>();
        for (const g of (games ?? []) as { id: string | null; creator_studio: string | null }[]) {
          if (g.id) entries.push({ path: `/game/${g.id}`, changefreq: "weekly", priority: "0.8" });
          if (g.creator_studio) studios.add(g.creator_studio);
        }
        for (const s of studios) {
          entries.push({ path: `/studio/${encodeURIComponent(s)}`, changefreq: "monthly", priority: "0.6" });
        }

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
