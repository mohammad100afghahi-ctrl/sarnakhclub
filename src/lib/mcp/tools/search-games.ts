import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "search_games",
  title: "Search cases",
  description:
    "Search published mystery/detective game cases on سرنخ by title or creator group. Returns id, title, creator, rating and rank score.",
  inputSchema: {
    query: z.string().trim().min(1).describe("Text to match against the game title or creator group."),
    limit: z.number().int().min(1).max(50).default(10).describe("Maximum number of results."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("game_rankings")
      .select("id, title, creator_studio, weighted_score, raw_avg, votes, description")
      .or(`title.ilike.%${query}%,creator_studio.ilike.%${query}%`)
      .order("weighted_score", { ascending: false })
      .limit(limit);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { games: data ?? [] },
    };
  },
});
