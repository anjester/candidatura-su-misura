type HunterEmail = {
  value?: string;
  type?: string;
  confidence?: number;
  position?: string | null;
  department?: string | null;
};

type HunterResponse = {
  data?: {
    domain?: string;
    organization?: string;
    emails?: HunterEmail[];
  };
};

const PRIORITY = [
  "jobs","job","careers","career","hr","recruiting","recruitment",
  "talent","people","candidature","lavoro","cv","info","hello","contact","contatti"
];

const BLOCKED = ["privacy","gdpr","dpo","abuse","security","noreply","no-reply","donotreply"];

function localPart(email: string) {
  return email.toLowerCase().split("@")[0] || "";
}

function safe(email: HunterEmail) {
  const value = email.value?.trim().toLowerCase();
  if (!value || !value.includes("@")) return false;
  const local = localPart(value);
  if (BLOCKED.some((x) => local.includes(x))) return false;
  if (email.type && email.type !== "generic") return false;
  return true;
}

function rank(email: HunterEmail) {
  const value = email.value?.toLowerCase() || "";
  const local = localPart(value);
  let score = Number(email.confidence || 0);

  const idx = PRIORITY.findIndex(
    (p) => local === p || local.startsWith(`${p}.`) || local.startsWith(`${p}-`)
  );
  if (idx >= 0) score += 300 - idx * 10;

  const dept = String(email.department || "").toLowerCase();
  const pos = String(email.position || "").toLowerCase();
  if (/human resources|hr|recruit|talent|people/.test(dept)) score += 80;
  if (/human resources|hr|recruit|talent/.test(pos)) score += 50;

  return score;
}

export async function findHunterCompanyEmail(company: string): Promise<{
  email?: string;
  domain?: string;
  organization?: string;
}> {
  const apiKey = process.env.HUNTER_API_KEY?.trim();
  const cleanCompany = company?.trim();

  if (!apiKey || !cleanCompany || cleanCompany.length < 3) return {};

  const url = new URL("https://api.hunter.io/v2/domain-search");
  url.searchParams.set("company", cleanCompany);
  url.searchParams.set("limit", "10");
  url.searchParams.set("api_key", apiKey);

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) return {};

  const payload = (await response.json()) as HunterResponse;
  const domain = payload.data?.domain?.toLowerCase();
  const organization = payload.data?.organization;
  const emails = Array.isArray(payload.data?.emails) ? payload.data!.emails! : [];

  const chosen = emails.filter(safe).sort((a, b) => rank(b) - rank(a))[0];

  if (!chosen?.value || !domain) return { domain, organization };

  const emailDomain = chosen.value.split("@")[1]?.toLowerCase();

  if (!emailDomain || !(emailDomain === domain || emailDomain.endsWith(`.${domain}`))) {
    return { domain, organization };
  }

  return {
    email: chosen.value.toLowerCase(),
    domain,
    organization,
  };
}
