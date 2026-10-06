import type { EvaluatedJob } from "./types";

const table = "job_applications";

function cfg() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ""), key };
}

export function storeConfigured() { return !!cfg(); }

export async function alreadySeen(source: string, sourceId: string) {
  const c = cfg(); if (!c) return false;
  const u = new URL(`${c.url}/rest/v1/${table}`);
  u.searchParams.set("select", "id,status");
  u.searchParams.set("source", `eq.${source}`);
  u.searchParams.set("source_id", `eq.${sourceId}`);
  u.searchParams.set("limit", "1");
  const r = await fetch(u, { headers: headers(c.key), cache: "no-store" });
  if (!r.ok) throw new Error(`Supabase check failed ${r.status}`);
  const rows = await r.json();
  return rows.length > 0;
}

export async function saveJob(job: EvaluatedJob, status: string, recipient?: string, notes?: string) {
  const c = cfg(); if (!c) return;
  const r = await fetch(`${c.url}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...headers(c.key), "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({
      source: job.source,
      source_id: job.sourceId,
      title: job.title,
      company: job.company,
      location: job.location,
      url: job.url,
      score: job.score,
      status,
      recipient: recipient || null,
      notes: notes || null,
    }),
  });
  if (!r.ok && r.status !== 409) throw new Error(`Supabase insert failed ${r.status}`);
}

function headers(key: string) {
  return { apikey: key };
}
