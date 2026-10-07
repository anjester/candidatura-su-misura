import type { EvaluatedJob } from "./types";

const table = "job_applications";

function cfg() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !key) return null;

  return {
    url: url
      .replace(/\/rest\/v1\/?$/i, "")
      .replace(/\/+$/, ""),
    key,
  };
}

export function storeConfigured() {
  return !!cfg();
}

function headers(key: string): Record<string, string> {
  return key.startsWith("sb_secret_")
    ? { apikey: key }
    : {
        apikey: key,
        Authorization: `Bearer ${key}`,
      };
}

async function supabaseError(
  prefix: string,
  response: Response
) {
  let body = "";

  try {
    body = await response.text();
  } catch {}

  throw new Error(
    `${prefix} ${response.status} ${response.statusText}` +
      (body ? ` - ${body.slice(0, 1200)}` : "")
  );
}

function normalize(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(srl|spa|s\.r\.l\.|s\.p\.a\.|ltd|inc)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTitle(value: unknown) {
  return normalize(value)
    .replace(
      /\b(senior|junior|jr|expert|remote|remoto|intern|internship|stage|m f d)\b/g,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();
}

export async function alreadySeen(
  source: string,
  sourceId: string
) {
  const c = cfg();

  if (!c) {
    throw new Error("Supabase non configurato.");
  }

  const u = new URL(`${c.url}/rest/v1/${table}`);
  u.searchParams.set("select", "id,status");
  u.searchParams.set("source", `eq.${source}`);
  u.searchParams.set("source_id", `eq.${sourceId}`);
  u.searchParams.set("limit", "1");

  const r = await fetch(u.toString(), {
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

  return Array.isArray(rows) && rows.length > 0;
}

export async function alreadySeenEquivalent(
  title?: string,
  company?: string,
  _location?: string
) {
  const c = cfg();

  if (!c) {
    throw new Error("Supabase non configurato.");
  }

  const nt = normalizeTitle(title);
  const nc = normalize(company);

  if (!nt || !nc) return false;

  // Recupera un piccolo gruppo recente e confronta localmente.
  // Evita differenze di localita tra aggregatori per la stessa vacancy.
  const u = new URL(`${c.url}/rest/v1/${table}`);
  u.searchParams.set(
    "select",
    "id,title,company,location,status"
  );
  u.searchParams.set("order", "created_at.desc");
  u.searchParams.set("limit", "100");

  const r = await fetch(u.toString(), {
    headers: {
      ...headers(c.key),
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!r.ok) {
    await supabaseError(
      "Supabase equivalent check failed",
      r
    );
  }

  const rows = await r.json();

  if (!Array.isArray(rows)) return false;

  return rows.some((row: any) => {
    return (
      normalizeTitle(row.title) === nt &&
      normalize(row.company) === nc
    );
  });
}

export async function alreadySentRecently(
  company: string,
  recipient: string,
  days = 30
) {
  const c = cfg();

  if (!c) {
    throw new Error("Supabase non configurato.");
  }

  const normalizedCompany = normalize(company);
  const cleanRecipient = String(recipient || "").trim().toLowerCase();

  if (!normalizedCompany || !cleanRecipient) return false;

  const since = new Date(
    Date.now() - days * 24 * 60 * 60 * 1000
  ).toISOString();

  const u = new URL(`${c.url}/rest/v1/${table}`);
  u.searchParams.set(
    "select",
    "id,company,recipient,status,created_at"
  );
  u.searchParams.set("recipient", `eq.${cleanRecipient}`);
  u.searchParams.set("status", "eq.sent");
  u.searchParams.set("created_at", `gte.${since}`);
  u.searchParams.set("order", "created_at.desc");
  u.searchParams.set("limit", "50");

  const r = await fetch(u.toString(), {
    headers: {
      ...headers(c.key),
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!r.ok) {
    await supabaseError(
      "Supabase recent-send check failed",
      r
    );
  }

  const rows = await r.json();

  if (!Array.isArray(rows)) return false;

  return rows.some(
    (row: any) =>
      normalize(row.company) === normalizedCompany &&
      String(row.recipient || "").trim().toLowerCase() ===
        cleanRecipient &&
      row.status === "sent"
  );
}

export async function saveJob(
  job: EvaluatedJob,
  status: string,
  recipient?: string,
  notes?: string
) {
  const c = cfg();

  if (!c) {
    throw new Error("Supabase non configurato.");
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

  if (!r.ok && r.status !== 409) {
    await supabaseError("Supabase insert failed", r);
  }
}
