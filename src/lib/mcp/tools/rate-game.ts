import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "rate_game",
  title: "Rate a case",
  description: "Set or update the signed-in user's score (1-10) for a case on سرنخ.",
  inputSchema: {
    game_id: z.string().uuid().describe("The case id."),
    score: z.number().int().min(1).max(10).describe("Score from 1 to 10."),
  },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ game_id, score }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const userId = ctx.getUserId();
    const { data, error } = await supabase
      .from("ratings")
      .upsert({ user_id: userId, game_id, score }, { onConflict: "user_id,game_id" })
      .select()
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: { rating: data } };
  },
});
