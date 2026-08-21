import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "mark_played",
  title: "Mark case as played",
  description: "Add or remove a case from the signed-in user's played list on سرنخ.",
  inputSchema: {
    game_id: z.string().uuid().describe("The case id."),
    played: z.boolean().default(true).describe("True to mark as played, false to remove it."),
  },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ game_id, played }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const userId = ctx.getUserId();
    const { error } = played
      ? await supabase.from("played_games").upsert({ user_id: userId, game_id })
      : await supabase.from("played_games").delete().eq("user_id", userId!).eq("game_id", game_id);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: played ? "Marked as played." : "Removed from played list." }],
      structuredContent: { game_id, played },
    };
  },
});
