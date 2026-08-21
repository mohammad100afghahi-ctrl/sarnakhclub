import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "my_lists",
  title: "My cases",
  description:
    "List the signed-in user's own سرنخ data: played cases, wishlist, or their ratings.",
  inputSchema: {
    list: z.enum(["played", "wishlist", "ratings"]).describe("Which of the user's lists to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ list }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const userId = ctx.getUserId()!;

    const table = list === "played" ? "played_games" : list === "wishlist" ? "wishlist" : "ratings";
    const columns = list === "ratings" ? "game_id, score, created_at" : "game_id, created_at";
    const { data, error } = await supabase.from(table).select(columns).eq("user_id", userId);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const rows = (data ?? []) as Array<Record<string, unknown>>;
    const ids = rows.map((r) => r["game_id"] as string);
    const { data: games } = ids.length
      ? await supabase.from("games").select("id, title, creator_studio").in("id", ids)
      : { data: [] as Array<{ id: string; title: string; creator_studio: string | null }> };
    const titles = new Map((games ?? []).map((g) => [g.id, g]));
    const items = rows.map((r) => ({ ...r, game: titles.get(r["game_id"] as string) ?? null }));
    return { content: [{ type: "text", text: JSON.stringify(items) }], structuredContent: { items } };
  },
});
