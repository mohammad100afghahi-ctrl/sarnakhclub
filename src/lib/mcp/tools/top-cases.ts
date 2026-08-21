import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "top_cases",
  title: "Top ranked cases",
  description: "List the highest ranked cases on سرنخ, ordered by the site's weighted (Bayesian) score.",
  inputSchema: { limit: z.number().int().min(1).max(50).default(10).describe("How many cases to return.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("game_rankings")
      .select("id, title, creator_studio, weighted_score, raw_avg, votes")
      .order("weighted_score", { ascending: false })
      .limit(limit);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data ?? []) }], structuredContent: { games: data ?? [] } };
  },
});
