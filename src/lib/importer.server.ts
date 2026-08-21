const GATEWAY = "https://connector-gateway.lovable.dev/firecrawl/v2";

function gatewayHeaders() {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const fcKey = process.env["FIRECRAWL_API_KEY"];
  if (!lovableKey || !fcKey) throw new Error("سرویس استخراج پیکربندی نشده است.");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": fcKey,
  };
}

export async function firecrawlScrapeLinks(url: string): Promise<string[]> {
  const res = await fetch(`${GATEWAY}/scrape`, {
    method: "POST",
    headers: gatewayHeaders(),
    body: JSON.stringify({ url, formats: ["links"], onlyMainContent: true }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`خطای کشف صفحات [${res.status}]: ${body.slice(0, 300)}`);
  const json = JSON.parse(body) as { links?: string[]; data?: { links?: string[] } };
  return (json.links ?? json.data?.links ?? []).filter((l) => typeof l === "string");
}


export async function firecrawlScrape(url: string): Promise<{ markdown: string; images: string[] }> {
  const res = await fetch(`${GATEWAY}/scrape`, {
    method: "POST",
    headers: gatewayHeaders(),
    body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`خطای خواندن صفحه [${res.status}]: ${body.slice(0, 300)}`);
  const json = JSON.parse(body) as {
    markdown?: string;
    metadata?: { ogImage?: string };
    data?: { markdown?: string; metadata?: { ogImage?: string } };
  };
  const markdown = json.markdown ?? json.data?.markdown ?? "";
  const og = json.metadata?.ogImage ?? json.data?.metadata?.ogImage;
  const images: string[] = [];
  if (og) images.push(og);
  for (const m of markdown.matchAll(/!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/g)) {
    if (m[1]) images.push(m[1]);
  }
  return { markdown, images };
}

export type ExtractedCase = {
  is_case_game: boolean;
  title: string;
  description: string;
  creator_studio: string | null;
  min_players: number | null;
  max_players: number | null;
  age_rating: string | null;
  duration_minutes: number | null;
  duration_max_minutes: number | null;
  poster_url: string | null;
};

export async function extractCase(pageUrl: string, markdown: string, images: string[]): Promise<ExtractedCase> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("سرویس هوش مصنوعی پیکربندی نشده است.");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "google/gemini-3-flash",
      messages: [
        {
          role: "system",
          content:
            "تو دستیار فارسی‌زبان یک سایت معرفی «بازی‌های پرونده‌ای» (معمایی، کارآگاهی، دیداکشن، اتاق فرار جعبه‌ای) هستی. " +
            "از متن صفحه محصول، اطلاعات بازی را استخراج کن. توضیح را با زبان خودت به فارسی روان و اختصاصی بازنویسی کن (۲ تا ۴ جمله) و هرگز عین متن منبع را کپی نکن. " +
            "اگر صفحه محصول یک بازی معمایی/کارآگاهی نیست، is_case_game را false بگذار. " +
            "رده سنی فقط عدد سال باشد (مثلاً «۱۲» به شکل 12). زمان بازی برحسب دقیقه. اگر مقداری معلوم نیست null بگذار.",
        },
        {
          role: "user",
          content: `آدرس صفحه: ${pageUrl}\n\nتصاویر موجود در صفحه:\n${images.slice(0, 8).join("\n")}\n\nمتن صفحه:\n${markdown.slice(0, 12000)}`,
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "save_case",
            description: "ذخیره اطلاعات استخراج‌شده بازی",
            parameters: {
              type: "object",
              properties: {
                is_case_game: { type: "boolean" },
                title: { type: "string" },
                description: { type: "string" },
                creator_studio: { type: ["string", "null"] },
                min_players: { type: ["integer", "null"] },
                max_players: { type: ["integer", "null"] },
                age_rating: { type: ["string", "null"] },
                duration_minutes: { type: ["integer", "null"] },
                duration_max_minutes: { type: ["integer", "null"] },
                poster_url: { type: ["string", "null"], description: "بهترین تصویر پوستر از فهرست تصاویر" },
              },
              required: ["is_case_game", "title", "description"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "save_case" } },
    }),
  });

  const body = await res.text();
  if (!res.ok) throw new Error(`خطای هوش مصنوعی [${res.status}]: ${body.slice(0, 300)}`);
  const json = JSON.parse(body) as {
    choices?: Array<{ message?: { tool_calls?: Array<{ function?: { arguments?: string } }> } }>;
  };
  const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) throw new Error("هوش مصنوعی اطلاعاتی برنگرداند.");
  const parsed = JSON.parse(args) as Partial<ExtractedCase>;
  return {
    is_case_game: parsed.is_case_game ?? false,
    title: (parsed.title ?? "").trim(),
    description: (parsed.description ?? "").trim(),
    creator_studio: parsed.creator_studio ?? null,
    min_players: parsed.min_players ?? null,
    max_players: parsed.max_players ?? null,
    age_rating: parsed.age_rating ? String(parsed.age_rating).replace(/[^\d]/g, "") || null : null,
    duration_minutes: parsed.duration_minutes ?? null,
    duration_max_minutes: parsed.duration_max_minutes ?? null,
    poster_url: parsed.poster_url ?? images[0] ?? null,
  };
}

export async function uploadPoster(imageUrl: string): Promise<string | null> {
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    if (!contentType.startsWith("image/")) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > 8 * 1024 * 1024) return null;
    const ext = contentType.split("/")[1]?.split(";")[0] ?? "jpg";
    const path = `ai-import/${crypto.randomUUID()}.${ext}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.storage.from("posters").upload(path, bytes, { contentType });
    if (error) return null;
    const { data } = await supabaseAdmin.storage
      .from("posters")
      .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}
