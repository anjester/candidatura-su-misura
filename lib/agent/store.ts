import type { EvaluatedJob } from "./types";

const table = "job_applications";

function cfg() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !key) return null;

  return {
    url: url.replace(/\/+$/, ""),
    key,
  };
}

export function storeConfigured() {
  return !!cfg();
}

function headers(key: string): Record<string, string> {
  // New Supabase secret keys (sb_secret_...) are opaque API keys:
  // send them as apikey only. Legacy service_role keys are JWTs and
  // can also be sent as Authorization Bearer.
  if (key.startsWith("sb_secret_")) {
    return {
      apikey: key,
    };
  }

  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
  };
}

async function supabaseError(prefix: string, response: Response) {
  let body = "";
  try {
    body = await response.text();
  } catch {
    body = "";
  }

  throw new Error(
    `${prefix} ${response.status} ${response.statusText}` +
      (body ? ` — ${body.slice(0, 1200)}` : "")
  );
}

export async function alreadySeen(source: string, sourceId: string) {
  const c = cfg();

  if (!c) {
    throw new Error(
      "Supabase non configurato: verifica SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY su Vercel."
    );
  }

  const u = new URL(`${c.url}/rest/v1/${table}`);
  u.searchParams.set("select", "id,status");
  u.searchParams.set("source", `eq.${source}`);
  u.searchParams.set("source_id", `eq.${sourceId}`);
  u.searchParams.set("limit", "1");

  const r = await fetch(u.toString(), {
    method: "GET",
    headers: {
      ...headers(c.key),
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!r.ok) {
    await supabaseError("Supabase check failed", r);
  }

  const rows = await r.json();

  if (!Array.isArray(rows)) {
    throw new Error(
      `Supabase check: risposta inattesa (${JSON.stringify(rows).slice(0, 500)})`
    );
  }

  return rows.length > 0;
}

export async function saveJob(
  job: EvaluatedJob,
  status: string,
  recipient?: string,
  notes?: string
) {
  const c = cfg();

  if (!c) {
    throw new Error(
      "Supabase non configurato: verifica SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY su Vercel."
    );
  }

  const r = await fetch(`${c.url}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      ...headers(c.key),
      "Content-Type": "application/json",
      Accept: "application/json",
      Prefer: "return=minimal",
    },
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

  // 409 = duplicato sulla unique(source, source_id): lo consideriamo innocuo.
  if (!r.ok && r.status !== 409) {
    await supabaseError("Supabase insert failed", r);
  }
}
