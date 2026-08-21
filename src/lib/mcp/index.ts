import { auth, defineMcp } from "@lovable.dev/mcp-js";
import searchGames from "./tools/search-games";
import getGame from "./tools/get-game";
import topCases from "./tools/top-cases";
import rateGame from "./tools/rate-game";
import markPlayed from "./tools/mark-played";
import myLists from "./tools/my-lists";

const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "sarnakh",
  title: "سرنخ",
  version: "0.1.0",
  instructions:
    "Tools for سرنخ, a Persian reference for mystery/detective game cases. Search and read cases, see the weighted ranking, and manage the signed-in user's ratings, played list and wishlist.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [searchGames, getGame, topCases, rateGame, markPlayed, myLists],
});
