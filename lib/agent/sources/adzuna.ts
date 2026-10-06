import type { Job } from "../types";

const queries = [
  "graphic designer",
  "motion designer",
  "video editor",
  "editorial designer",
  "impaginatore",
  "DTP specialist",
  "InDesign",
  "artworker",
  "grafico editoriale",
];

export async function fetchAdzunaJobs(): Promise<Job[]> {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) return [];

  const jobs: Job[] = [];
  for (const what of queries) {
    const u = new URL("https://api.adzuna.com/v1/api/jobs/it/search/1");
    u.searchParams.set("app_id", appId);
    u.searchParams.set("app_key", appKey);
    u.searchParams.set("results_per_page", "20");
    u.searchParams.set("what", what);
    u.searchParams.set("where", "Lombardia");
    u.searchParams.set("sort_by", "date");
    u.searchParams.set("content-type", "application/json");

    const r = await fetch(u, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!r.ok) continue;
    const data = await r.json();
    for (const j of data.results ?? []) {
      jobs.push({
        source: "adzuna",
        sourceId: String(j.id ?? j.redirect_url ?? `${j.title}-${j.created}`),
        title: String(j.title ?? ""),
        company: String(j.company?.display_name ?? ""),
        location: String(j.location?.display_name ?? ""),
        description: String(j.description ?? ""),
        url: String(j.redirect_url ?? ""),
        createdAt: j.created ? String(j.created) : undefined,
        salary: j.salary_min || j.salary_max ? `${j.salary_min ?? ""}-${j.salary_max ?? ""}` : undefined,
      });
    }
  }
  return dedupe(jobs);
}

function dedupe(items: Job[]) {
  const seen = new Set<string>();
  return items.filter((x) => {
    const k = `${x.source}:${x.sourceId}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
