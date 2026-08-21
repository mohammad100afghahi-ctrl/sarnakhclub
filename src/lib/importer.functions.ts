import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error || !data) throw new Error("دسترسی مجاز نیست.");
}

export const discoverCases = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { url: string; limit?: number }) => {
    const url = String(input.url ?? "").trim();
    if (!/^https?:\/\//.test(url)) throw new Error("آدرس معتبر نیست.");
    return { url, limit: Math.min(Math.max(input.limit ?? 60, 1), 200) };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { firecrawlMap } = await import("./importer.server");
    const links = await firecrawlMap(data.url, data.limit);
    const base = new URL(data.url);
    const unique = Array.from(new Set(links)).filter((l) => {
      try {
        const u = new URL(l);
        return u.hostname === base.hostname && u.pathname !== base.pathname;
      } catch {
        return false;
      }
    });
    return { links: unique.slice(0, data.limit) };
  });

export const importCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { url: string }) => {
    const url = String(input.url ?? "").trim();
    if (!/^https?:\/\//.test(url)) throw new Error("آدرس معتبر نیست.");
    return { url };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { firecrawlScrape, extractCase, uploadPoster } = await import("./importer.server");

    const { markdown, images } = await firecrawlScrape(data.url);
    if (!markdown || markdown.length < 80) {
      return { status: "skipped" as const, reason: "محتوای صفحه خالی بود", title: null };
    }

    const extracted = await extractCase(data.url, markdown, images);
    if (!extracted.is_case_game || !extracted.title) {
      return { status: "skipped" as const, reason: "بازی معمایی تشخیص داده نشد", title: extracted.title || null };
    }

    const { data: existingGame } = await context.supabase
      .from("games")
      .select("id")
      .ilike("title", extracted.title)
      .maybeSingle();
    const { data: existingSugg } = await context.supabase
      .from("game_suggestions")
      .select("id")
      .ilike("title", extracted.title)
      .maybeSingle();
    if (existingGame || existingSugg) {
      return { status: "duplicate" as const, reason: "قبلاً ثبت شده", title: extracted.title };
    }

    const posterUrl = extracted.poster_url ? await uploadPoster(extracted.poster_url) : null;

    const { error } = await context.supabase.from("game_suggestions").insert({
      user_id: context.userId,
      title: extracted.title,
      description: extracted.description,
      creator_studio: extracted.creator_studio,
      source_url: data.url,
      poster_url: posterUrl,
      min_players: extracted.min_players,
      max_players: extracted.max_players,
      age_rating: extracted.age_rating,
      duration_minutes: extracted.duration_minutes,
      duration_max_minutes: extracted.duration_max_minutes,
      admin_note: "استخراج خودکار توسط هوش مصنوعی",
      status: "pending",
    });
    if (error) throw new Error(error.message);

    return { status: "imported" as const, reason: null, title: extracted.title };
  });
