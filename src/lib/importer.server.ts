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


const BAD_IMAGE = /(logo|icon|sprite|avatar|placeholder|favicon|banner|loading|spinner|blank)/i;

function absolutize(src: string, base: string): string | null {
  try {
    return new URL(src, base).toString();
  } catch {
    return null;
  }
}

export async function firecrawlScrape(url: string): Promise<{ markdown: string; images: string[] }> {
  const res = await fetch(`${GATEWAY}/scrape`, {
    method: "POST",
    headers: gatewayHeaders(),
    body: JSON.stringify({ url, formats: ["markdown", "html"], onlyMainContent: false }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`خطای خواندن صفحه [${res.status}]: ${body.slice(0, 300)}`);
  const json = JSON.parse(body) as Record<string, unknown>;
  const d = ((json["data"] as Record<string, unknown>) ?? json) as {
    markdown?: string;
    html?: string;
    metadata?: Record<string, unknown>;
  };
  const markdown = d.markdown ?? "";
  const html = d.html ?? "";
  const meta = d.metadata ?? {};

  const ordered: string[] = [];
  const push = (raw?: unknown) => {
    if (typeof raw !== "string" || !raw.trim()) return;
    const abs = absolutize(raw.trim(), url);
    if (!abs || !/^https?:/i.test(abs)) return;
    if (abs.startsWith("data:") || /\.svg(\?|$)/i.test(abs)) return;
    if (!ordered.includes(abs)) ordered.push(abs);
  };

  // 1) social/meta images (firecrawl returns raw meta keys like "og:image")
  for (const key of ["og:image", "ogImage", "og:image:secure_url", "twitter:image", "twitter:image:src", "image"]) {
    const v = meta[key];
    if (Array.isArray(v)) v.forEach(push);
    else push(v);
  }

  // 2) JSON-LD product images
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const raw = JSON.parse(m[1] ?? "");
      const walk = (node: unknown) => {
        if (!node) return;
        if (Array.isArray(node)) return node.forEach(walk);
        if (typeof node === "object") {
          const o = node as Record<string, unknown>;
          if (o["image"]) {
            if (Array.isArray(o["image"])) o["image"].forEach((i) => push(typeof i === "string" ? i : (i as Record<string, unknown>)?.["url"]));
            else if (typeof o["image"] === "string") push(o["image"]);
            else push((o["image"] as Record<string, unknown>)?.["url"]);
          }
          Object.values(o).forEach(walk);
        }
      };
      walk(raw);
    } catch {
      /* ignore */
    }
  }

  // 3) <img> tags — prefer large / non-icon sources
  const imgs: Array<{ src: string; score: number }> = [];
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    const attr = (name: string) => tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i"))?.[1];
    let src = attr("data-src") ?? attr("data-original") ?? attr("data-lazy-src") ?? attr("src");
    const srcset = attr("srcset") ?? attr("data-srcset");
    if (srcset) {
      const last = srcset.split(",").map((s) => s.trim()).filter(Boolean).pop();
      if (last) src = last.split(/\s+/)[0] ?? src;
    }
    if (!src) continue;
    const w = Number(attr("width") ?? 0);
    const h = Number(attr("height") ?? 0);
    if ((w && w < 120) || (h && h < 120)) continue;
    if (BAD_IMAGE.test(src)) continue;
    imgs.push({ src, score: (w || 0) * (h || 0) });
  }
  imgs.sort((a, b) => b.score - a.score);
  imgs.forEach((i) => push(i.src));

  // 4) markdown images as last resort
  for (const m of markdown.matchAll(/!\[[^\]]*\]\((\S+?)(?:\s+"[^"]*")?\)/g)) {
    if (m[1] && !BAD_IMAGE.test(m[1])) push(m[1]);
  }

  return { markdown, images: ordered.slice(0, 12) };
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
      model: "google/gemini-3.7-flash",
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

export async function uploadPoster(imageUrl: string, fallbacks: string[] = []): Promise<string | null> {
  const candidates = [imageUrl, ...fallbacks].filter((u, i, a) => u && a.indexOf(u) === i).slice(0, 6);
  for (const candidate of candidates) {
    try {
      const res = await fetch(candidate, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          Accept: "image/avif,image/webp,image/*,*/*;q=0.8",
          Referer: new URL(candidate).origin,
        },
      });
      if (!res.ok) continue;
      const contentType = (res.headers.get("content-type") ?? "image/jpeg").split(";")[0]!.trim();
      if (!contentType.startsWith("image/")) continue;
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.byteLength < 2048 || bytes.byteLength > 8 * 1024 * 1024) continue;
      const ext = contentType.split("/")[1] ?? "jpg";
      const path = `ai-import/${crypto.randomUUID()}.${ext}`;
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await supabaseAdmin.storage.from("posters").upload(path, bytes, { contentType });
      if (error) continue;
      const { data } = await supabaseAdmin.storage
        .from("posters")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (data?.signedUrl) return data.signedUrl;
    } catch {
      /* try next candidate */
    }
  }
  return null;
}
