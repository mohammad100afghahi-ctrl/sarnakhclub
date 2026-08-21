import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_game",
  title: "Get case details",
  description: "Fetch the full details of one case on سرنخ by its id, including rating, votes and recent reviews.",
  inputSchema: { game_id: z.string().uuid().describe("The case id.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ game_id }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const [{ data: game, error }, { data: reviews }] = await Promise.all([
      supabase.from("game_rankings").select("*").eq("id", game_id).maybeSingle(),
      supabase
        .from("reviews")
        .select("id, text, is_spoiler, helpful_count, unhelpful_count, created_at")
        .eq("game_id", game_id)
        .order("helpful_count", { ascending: false })
        .limit(5),
    ]);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!game) return { content: [{ type: "text", text: "Case not found" }], isError: true };
    const payload = { game, reviews: reviews ?? [] };
    return { content: [{ type: "text", text: JSON.stringify(payload) }], structuredContent: payload };
  },
});
