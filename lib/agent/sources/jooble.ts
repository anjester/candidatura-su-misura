import type { Job } from "../types";

const queries = [
  "graphic designer",
  "motion designer",
  "video editor",
  "editorial designer",
  "impaginatore",
  "DTP specialist",
  "InDesign",
  "grafico editoriale",
];

export async function fetchJoobleJobs(): Promise<Job[]> {
  const key = process.env.JOOBLE_API_KEY;
  if (!key) return [];

  const jobs: Job[] = [];
  for (const keywords of queries) {
    const r = await fetch(`https://it.jooble.org/api/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keywords, location: "Lombardia", radius: "80", page: 1, ResultOnPage: 20 }),
      cache: "no-store",
    });
    if (!r.ok) continue;
    const data = await r.json();
    for (const j of data.jobs ?? []) {
      jobs.push({
        source: "jooble",
        sourceId: String(j.id ?? j.link ?? `${j.title}-${j.updated}`),
        title: String(j.title ?? ""),
        company: String(j.company ?? ""),
        location: String(j.location ?? ""),
        description: String(j.snippet ?? ""),
        url: String(j.link ?? ""),
        createdAt: j.updated ? String(j.updated) : undefined,
        salary: j.salary ? String(j.salary) : undefined,
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
