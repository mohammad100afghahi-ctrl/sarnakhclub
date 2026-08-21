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

    const { data, error } =
      list === "ratings"
        ? await supabase.from("ratings").select("game_id, score, created_at").eq("user_id", userId)
        : list === "wishlist"
          ? await supabase.from("wishlist").select("game_id, created_at").eq("user_id", userId)
          : await supabase.from("played_games").select("game_id, created_at").eq("user_id", userId);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
    const ids = rows.map((r) => r["game_id"] as string);
    const { data: games } = ids.length
      ? await supabase.from("games").select("id, title, creator_studio").in("id", ids)
      : { data: [] as Array<{ id: string; title: string; creator_studio: string | null }> };
    const titles = new Map((games ?? []).map((g) => [g.id, g]));
    const items = rows.map((r) => ({ ...r, game: titles.get(r["game_id"] as string) ?? null }));
    return { content: [{ type: "text", text: JSON.stringify(items) }], structuredContent: { items } };
  },
});
