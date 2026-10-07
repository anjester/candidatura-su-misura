type EnrichedJobPage = {
  text: string;
  email?: string;
};

const EMAIL_RE =
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

const BAD_EMAIL_PARTS = [
  "example.",
  "sentry.",
  "wixpress.",
  "cloudflare.",
  "wordpress.",
  "noreply",
  "no-reply",
  "donotreply",
  "privacy@",
  "gdpr@",
  "dpo@",
  "abuse@",
  "security@",
];

const CONTACT_HINTS = [
  "contact",
  "contacts",
  "contatti",
  "careers",
  "career",
  "jobs",
  "job",
  "lavora-con-noi",
  "lavora_con_noi",
  "lavora",
  "candidature",
  "recruiting",
  "recruitment",
];

function decodeEntities(s: string) {
  return s
    .replace(/&commat;/gi, "@")
    .replace(/&#64;/gi, "@")
    .replace(/&#x40;/gi, "@")
    .replace(/&period;/gi, ".")
    .replace(/&#46;/gi, ".")
    .replace(/&#x2e;/gi, ".");
}

function deobfuscateEmailText(s: string) {
  return s
    .replace(/\s*(?:\[|\()?\s*at\s*(?:\]|\))?\s*/gi, "@")
    .replace(/\s*(?:\[|\()?\s*dot\s*(?:\]|\))?\s*/gi, ".")
    .replace(/\s+/g, " ");
}

function stripHtml(html: string) {
  return decodeEntities(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function validEmail(email: string) {
  const e = email.toLowerCase().trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return false;
  if (BAD_EMAIL_PARTS.some((x) => e.includes(x))) return false;

  return true;
}

function rootHost(hostname: string) {
  const h = hostname.toLowerCase().replace(/^www\./, "");
  const parts = h.split(".").filter(Boolean);
  if (parts.length <= 2) return h;
  return parts.slice(-2).join(".");
}

function emailMatchesPage(email: string, pageUrl: string) {
  try {
    const emailDomain = email.split("@")[1]?.toLowerCase();
    const pageHost = new URL(pageUrl).hostname.toLowerCase();
    if (!emailDomain) return false;
    return rootHost(emailDomain) === rootHost(pageHost);
  } catch {
    return false;
  }
}

function rankEmail(email: string) {
  const e = email.toLowerCase();

  let score = 0;

  if (/^(jobs?|careers?|career|hr|recruiting|recruitment|talent|people|candidature|lavoro|cv)@/.test(e)) {
    score += 100;
  }

  if (/^(info|hello|ciao|contact|contatti)@/.test(e)) {
    score += 35;
  }

  if (/gmail\.com$|outlook\.com$|hotmail\.com$|yahoo\./.test(e)) {
    score -= 20;
  }

  return score;
}

function extractEmails(htmlOrText: string) {
  const decoded = deobfuscateEmailText(decodeEntities(htmlOrText));

  const mailtos = [
    ...decoded.matchAll(/mailto:([^"'?\s>]+)/gi),
  ].map((m) => decodeURIComponent(m[1]));

  const normal = decoded.match(EMAIL_RE) || [];

  return [...new Set([...mailtos, ...normal].map((x) => x.toLowerCase()))]
    .filter(validEmail)
    .sort((a, b) => rankEmail(b) - rankEmail(a));
}

function extractCandidateLinks(html: string, baseUrl: string) {
  const result: string[] = [];

  for (const match of html.matchAll(/href\s*=\s*["']([^"'#]+)["']/gi)) {
    const href = match[1];

    try {
      const u = new URL(href, baseUrl);

      if (!["http:", "https:"].includes(u.protocol)) continue;

      const haystack = `${u.pathname} ${u.search}`.toLowerCase();

      if (CONTACT_HINTS.some((hint) => haystack.includes(hint))) {
        result.push(u.toString());
      }
    } catch {
      // URL non valida
    }
  }

  return [...new Set(result)].slice(0, 5);
}

async function fetchHtml(url: string, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; AntonioJobAgent/1.0; +https://www.antoniofilippone.com)",
        Accept:
          "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        "Accept-Language": "it-IT,it;q=0.9,en;q=0.7",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("text/html")) {
      return {
        html: "",
        finalUrl: response.url || url,
      };
    }

    return {
      html: await response.text(),
      finalUrl: response.url || url,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function sameSite(a: string, b: string) {
  try {
    const ah = new URL(a).hostname.replace(/^www\./, "");
    const bh = new URL(b).hostname.replace(/^www\./, "");

    return ah === bh || ah.endsWith(`.${bh}`) || bh.endsWith(`.${ah}`);
  } catch {
    return false;
  }
}

export async function enrichFromJobPage(
  url: string,
  fallbackDescription = ""
): Promise<EnrichedJobPage> {
  if (!url) {
    return {
      text: fallbackDescription,
      email: extractEmails(fallbackDescription)[0],
    };
  }

  let mainHtml = "";
  let finalUrl = url;

  try {
    const main = await fetchHtml(url);
    mainHtml = main.html;
    finalUrl = main.finalUrl;
  } catch {
    return {
      text: fallbackDescription,
      email: extractEmails(fallbackDescription)[0],
    };
  }

  const mainText = stripHtml(mainHtml);
  const combinedText =
    mainText.length > fallbackDescription.length
      ? mainText
      : fallbackDescription;

  const directEmails = extractEmails(`${mainHtml}\n${fallbackDescription}`);

  if (directEmails.length) {
    return {
      text: combinedText,
      email: directEmails[0],
    };
  }

  // Se non c'è una mail nell'annuncio, controlliamo solo poche pagine
  // pubbliche e pertinenti dello stesso sito, senza inventare indirizzi.
  const candidateLinks = extractCandidateLinks(mainHtml, finalUrl)
    .filter((x) => sameSite(x, finalUrl))
    .slice(0, 3);

  for (const candidateUrl of candidateLinks) {
    try {
      const page = await fetchHtml(candidateUrl, 6000);
      const emails = extractEmails(page.html)
        .filter((email) => emailMatchesPage(email, page.finalUrl));

      if (emails.length) {
        return {
          text: combinedText,
          email: emails[0],
        };
      }
    } catch {
      // Passa al link successivo
    }
  }

  return {
    text: combinedText,
    email: undefined,
  };
}
