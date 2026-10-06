export function findEmails(text: string) {
  return [...new Set((text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []).map((x) => x.toLowerCase()))]
    .filter((x) => !/example\.(com|org)|noreply|no-reply/.test(x));
}

export async function enrichFromJobPage(url: string, fallback = "") {
  if (!url) return { text: fallback, email: findEmails(fallback)[0] };
  try {
    const r = await fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; JobAgentAntonio/1.0)", Accept: "text/html" },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!r.ok) throw new Error("page blocked");
    const html = (await r.text()).slice(0, 350000);
    const clean = html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;|&#160;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/\s+/g, " ")
      .trim();
    return { text: `${fallback} ${clean}`.slice(0, 50000), email: findEmails(clean)[0] || findEmails(fallback)[0] };
  } catch {
    return { text: fallback, email: findEmails(fallback)[0] };
  }
}
