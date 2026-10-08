import { createHash } from "node:crypto";
import type { Job } from "../types";
import {
  COMPANY_TARGETS,
  getExtraCompanyTargets,
  type CompanyTarget,
} from "../companyTargets";

const CAREER_HINT =
  /(careers?|jobs?|lavora[\s-]*con[\s-]*noi|lavoraconnoi|posizioni[\s-]*aperte|opportunit[aà]|work[\s-]*with[\s-]*us|join[\s-]*(us|our[\s-]*team)|vacanc(?:y|ies)|open[\s-]*positions?)/i;

const JOB_HINT =
  /(graphic\s*designer|grafico|motion\s*(graphics?|designer)|video\s*editor|editorial\s*designer|grafico\s*editoriale|impaginat|impaginazione|\bdtp\b|desktop\s*publisher|artworker|prepress|prestampa|esecutivista|indesign|layout\s*designer|catalog(?:ue)?\s*designer|cataloghi?|manualistica|technical\s*publication|presentation\s*designer|visual\s*designer|content\s*creator|2d\s*composit|compositor|3d\s*artist|creative\s*designer|brand\s*designer)/i;

const ATS_HOST =
  /(greenhouse\.io|lever\.co|smartrecruiters\.com|teamtailor\.com|workable\.com|personio\.(?:de|com)|myworkdayjobs\.com|workdayjobs\.com|successfactors\.com|recruitee\.com)/i;

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripHtml(value: string) {
  return decodeEntities(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function stableId(url: string) {
  return createHash("sha1").update(url).digest("hex").slice(0, 24);
}

function safeUrl(href: string, base: string) {
  try {
    const u = new URL(href, base);
    if (!/^https?:$/i.test(u.protocol)) return null;

    const h = u.hostname.toLowerCase();
    if (
      h === "localhost" ||
      h === "127.0.0.1" ||
      h === "::1" ||
      h.startsWith("10.") ||
      h.startsWith("192.168.") ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
      h.startsWith("169.254.")
    ) {
      return null;
    }

    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

async function fetchHtml(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6500);

  try {
    const r = await fetch(url, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent":
          "Mozilla/5.0 (compatible; JobCareerScanner/1.0; +https://www.antoniofilippone.com)",
      },
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
    });

    if (!r.ok) return null;

    const type = r.headers.get("content-type") || "";
    if (!type.includes("text/html") && !type.includes("application/xhtml")) {
      return null;
    }

    const html = await r.text();
    return {
      html: html.slice(0, 900_000),
      finalUrl: r.url || url,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

type Anchor = {
  href: string;
  text: string;
  context: string;
};

function anchorsFromHtml(html: string, base: string): Anchor[] {
  const out: Anchor[] = [];
  const re = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  for (const m of html.matchAll(re)) {
    const href = safeUrl(m[1], base);
    if (!href) continue;

    const text = stripHtml(m[2]).slice(0, 220);
    const index = m.index ?? 0;
    const context = stripHtml(
      html.slice(Math.max(0, index - 260), Math.min(html.length, index + m[0].length + 260))
    ).slice(0, 520);

    out.push({ href, text, context });
  }

  return out;
}

function careerLinks(html: string, base: string) {
  const baseHost = (() => {
    try {
      return new URL(base).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  })();

  return anchorsFromHtml(html, base)
    .map((a) => {
      const host = (() => {
        try {
          return new URL(a.href).hostname.replace(/^www\./, "");
        } catch {
          return "";
        }
      })();

      let score = 0;
      if (CAREER_HINT.test(a.text)) score += 6;
      if (CAREER_HINT.test(a.href)) score += 5;
      if (host === baseHost || host.endsWith(`.${baseHost}`)) score += 2;
      if (ATS_HOST.test(host)) score += 6;

      return { ...a, score };
    })
    .filter((a) => a.score >= 5)
    .sort((a, b) => b.score - a.score)
    .filter(
      (a, index, arr) =>
        arr.findIndex((x) => x.href === a.href) === index
    )
    .slice(0, 2);
}

function locationFromText(text: string) {
  const candidates = [
    /milano|milan/i,
    /monza/i,
    /brianza/i,
    /como/i,
    /lecco/i,
    /lombardia|lombardy/i,
    /remote|remoto/i,
    /italia|italy/i,
  ];

  for (const re of candidates) {
    const m = text.match(re);
    if (m) return m[0];
  }

  return "Italia / Career site";
}

function jsonLdJobs(
  html: string,
  pageUrl: string,
  fallbackCompany: string
): Job[] {
  const jobs: Job[] = [];
  const re =
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  const visit = (value: any) => {
    if (!value) return;

    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }

    if (typeof value !== "object") return;

    const type = value["@type"];
    const types = Array.isArray(type) ? type : [type];

    if (types.some((x) => String(x).toLowerCase() === "jobposting")) {
      const title = stripHtml(String(value.title || ""));
      if (!title || !JOB_HINT.test(`${title} ${stripHtml(String(value.description || ""))}`)) {
        return;
      }

      const canonical =
        safeUrl(
          String(value.url || value.sameAs || pageUrl),
          pageUrl
        ) || pageUrl;

      const organization =
        typeof value.hiringOrganization === "object"
          ? String(value.hiringOrganization?.name || fallbackCompany)
          : fallbackCompany;

      let location = "Italia / Career site";
      try {
        const loc = Array.isArray(value.jobLocation)
          ? value.jobLocation[0]
          : value.jobLocation;
        const addr = loc?.address || {};
        location =
          [
            addr.addressLocality,
            addr.addressRegion,
            addr.addressCountry,
          ]
            .filter(Boolean)
            .join(", ") || location;
      } catch {}

      jobs.push({
        source: "company_careers",
        sourceId: stableId(canonical),
        title,
        company: organization || fallbackCompany,
        location,
        description: stripHtml(String(value.description || "")).slice(0, 3500),
        url: canonical,
        createdAt: value.datePosted ? String(value.datePosted) : undefined,
      });
    }

    Object.values(value).forEach(visit);
  };

  for (const m of html.matchAll(re)) {
    try {
      visit(JSON.parse(m[1].trim()));
    } catch {
      // JSON-LD non valido: continua con gli anchor.
    }
  }

  return jobs;
}

function anchorJobs(
  html: string,
  pageUrl: string,
  company: string
): Job[] {
  return anchorsFromHtml(html, pageUrl)
    .filter((a) => {
      const combined = `${a.text} ${a.context}`;
      if (!JOB_HINT.test(combined)) return false;

      const hrefLooksLikeJob =
        /\/jobs?\b|\/careers?\b|\/vacanc|\/positions?\b|\/opportunit/i.test(a.href) ||
        ATS_HOST.test(a.href);

      return hrefLooksLikeJob || JOB_HINT.test(a.text);
    })
    .map((a) => {
      const title =
        JOB_HINT.test(a.text) && a.text.length >= 4
          ? a.text
          : a.context.match(JOB_HINT)?.[0] || "Posizione creativa";

      return {
        source: "company_careers" as const,
        sourceId: stableId(a.href),
        title: title.slice(0, 180),
        company,
        location: locationFromText(a.context),
        description: a.context.slice(0, 1800),
        url: a.href,
      };
    });
}

function dedupe(items: Job[]) {
  const seen = new Set<string>();

  return items.filter((job) => {
    const key = `${job.company.toLowerCase()}|${job.url.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function selectTargets(targets: CompanyTarget[], limit: number) {
  if (targets.length <= limit) return targets;

  const dayIndex = Math.floor(Date.now() / 86_400_000);
  const start = (dayIndex * limit) % targets.length;

  return Array.from(
    { length: limit },
    (_, i) => targets[(start + i) % targets.length]
  );
}

async function scanCompany(target: CompanyTarget): Promise<Job[]> {
  const home = await fetchHtml(target.website);
  if (!home) return [];

  const directJobs = jsonLdJobs(
    home.html,
    home.finalUrl,
    target.name
  );

  const links = careerLinks(home.html, home.finalUrl);

  // Se la homepage e gia una pagina career/ATS, analizzala direttamente.
  if (CAREER_HINT.test(home.finalUrl) || ATS_HOST.test(home.finalUrl)) {
    links.unshift({
      href: home.finalUrl,
      text: "Careers",
      context: "",
      score: 10,
    });
  }

  const pages = await Promise.all(
    links.slice(0, 2).map((link) => fetchHtml(link.href))
  );

  const jobs = [...directJobs];

  for (const page of pages) {
    if (!page) continue;

    jobs.push(
      ...jsonLdJobs(page.html, page.finalUrl, target.name),
      ...anchorJobs(page.html, page.finalUrl, target.name)
    );
  }

  return dedupe(jobs).slice(0, 12);
}

export async function fetchCompanyCareerJobs(): Promise<Job[]> {
  if (
    String(process.env.COMPANY_CAREER_ENABLED || "true").toLowerCase() ===
    "false"
  ) {
    return [];
  }

  const scanLimit = Math.min(
    12,
    Math.max(1, Number(process.env.COMPANY_CAREER_SCAN_LIMIT || 6))
  );

  const allTargets = [
    ...COMPANY_TARGETS,
    ...getExtraCompanyTargets(),
  ];

  const selected = selectTargets(allTargets, scanLimit);

  // Parallelismo limitato: pochi siti per run per restare sotto i limiti Vercel.
  const batches: CompanyTarget[][] = [];
  for (let i = 0; i < selected.length; i += 3) {
    batches.push(selected.slice(i, i + 3));
  }

  const jobs: Job[] = [];

  for (const batch of batches) {
    const results = await Promise.all(batch.map(scanCompany));
    results.forEach((group) => jobs.push(...group));
  }

  return dedupe(jobs);
}
