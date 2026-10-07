import { NextResponse } from "next/server";
import type { Job, EvaluatedJob } from "@/lib/agent/types";

export const runtime = "nodejs";
export const maxDuration = 60;

type StrictEvaluatedJob = EvaluatedJob & {
  strict: {
    strongRole: boolean;
    hardNegative: boolean;
    juniorLike: boolean;
    skills: number;
    autoEligible: boolean;
  };
};

const STRONG_ROLES = [
  /graphic\\s*designer/i, /senior\\s*graphic/i, /motion\\s*(graphic\\s*)?designer/i,
  /motion\\s*graphics?/i, /video\\s*editor/i, /video\\s*editing/i,
  /editorial\\s*designer/i, /grafico\\s*editoriale/i, /impaginat/i,
  /\\bdtp\\b/i, /desktop\\s*publish/i, /artworker/i, /prepress/i, /prestampa/i,
  /grafico\\s*esecutiv/i, /presentation\\s*designer/i, /visual\\s*designer/i,
  /2d\\s*composit/i, /compositor/i, /3d\\s*artist/i, /3d\\s*designer/i,
  /content\\s*creator/i,
];

const NEGATIVE_ROLES = [
  /digital\\s*marketing\\s*specialist/i, /marketing\\s*(specialist|manager|assistant|executive)/i,
  /impiegat[oa].*marketing/i, /social\\s*media\\s*(manager|specialist)/i,
  /community\\s*manager/i, /\\bseo\\b.*specialist/i, /\\bsem\\b.*specialist/i,
  /performance\\s*marketing/i, /sales/i, /commerciale/i,
  /account\\s*(manager|executive)/i, /project\\s*manager/i, /product\\s*manager/i,
  /architect/i, /architett[oa]/i, /renderista/i, /interior\\s*designer/i,
  /developer/i, /programmat/i,
];

const JUNIOR = [
  /\\bjunior\\b/i, /\\bjr\\.?\\b/i, /\\bintern(ship)?\\b/i,
  /\\bstage\\b/i, /\\btirocin/i, /\\bapprendistat/i, /\\btrainee\\b/i,
];

const CORE_SKILLS = [
  /after\\s*effects/i, /\\bindesign\\b/i, /premiere(\\s*pro)?/i, /photoshop/i,
  /illustrator/i, /cinema\\s*4d/i, /motion\\s*graphics?/i, /video\\s*edit/i,
  /impagin/i, /editorial/i, /\\bdtp\\b/i, /composit/i, /prepress|prestampa/i,
  /catalog/i, /brochure/i, /manualistic/i, /adobe/i, /visual\\s*design/i,
  /content\\s*creation/i,
];

function strictEvaluate(base: EvaluatedJob): StrictEvaluatedJob {
  const title = String(base.title || "");
  const text = `${title}\n${String(base.description || "")}`;
  const strongRole = STRONG_ROLES.some(r => r.test(title)) || STRONG_ROLES.some(r => r.test(text));
  const hardNegative = NEGATIVE_ROLES.some(r => r.test(title));
  const juniorLike = JUNIOR.some(r => r.test(title));
  const skills = CORE_SKILLS.reduce((n, r) => n + (r.test(text) ? 1 : 0), 0);

  let score = base.score;
  if (strongRole) score += 8;
  if (hardNegative) score -= 35;
  if (skills >= 5) score += 10;
  else if (skills >= 3) score += 6;
  else if (skills >= 2) score += 2;
  else score -= 12;
  if (juniorLike) score = Math.min(score - 25, 69);

  const autoEligible = strongRole && !hardNegative && !juniorLike && skills >= 2;
  if (!autoEligible) score = Math.min(score, 77);
  score = Math.max(0, Math.min(100, Math.round(score)));

  return { ...base, score, strict: { strongRole, hardNegative, juniorLike, skills, autoEligible } };
}

function normalize(v: unknown) {
  return String(v ?? "").toLowerCase().normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "").replace(/[^a-z0-9]+/g, " ")
    .replace(/\\s+/g, " ").trim();
}

function dedupe(items: Job[]) {
  const seen = new Set<string>();
  return items.filter(item => {
    const title = normalize(item.title)
      .replace(/\\b(senior|junior|jr|expert|remote|remoto|intern|internship|stage)\\b/g, "")
      .replace(/\\s+/g, " ").trim();
    const key = `${title}|${normalize(item.company)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function POST() {
  try {
    const testMode = String(process.env.EMAIL_TEST_MODE || "").toLowerCase() === "true";
    const testRecipient = process.env.TEST_RECIPIENT?.trim();

    if (!testMode) {
      return NextResponse.json({ error: "EMAIL_TEST_MODE non attivo su Vercel." }, { status: 400 });
    }
    if (!testRecipient) {
      return NextResponse.json({ error: "TEST_RECIPIENT non configurato su Vercel." }, { status: 400 });
    }

    const [
      { fetchAdzunaJobs },
      { fetchJoobleJobs },
      { evaluate, buildApplication },
      { enrichFromJobPage },
      { findHunterCompanyEmail },
      { smtpSend, pdfFor },
    ] = await Promise.all([
      import("@/lib/agent/sources/adzuna"),
      import("@/lib/agent/sources/jooble"),
      import("@/lib/agent/scoring"),
      import("@/lib/agent/web"),
      import("@/lib/agent/hunter"),
      import("@/lib/agent/mailer"),
    ]);

    const [adzuna, jooble] = await Promise.all([fetchAdzunaJobs(), fetchJoobleJobs()]);

    const ranked = dedupe([...adzuna, ...jooble])
      .map(job => strictEvaluate(evaluate(job)))
      .filter(job => job.score >= 88 && job.strict.autoEligible)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    for (const candidate of ranked) {
      let email: string | undefined;
      let description = candidate.description;

      try {
        const enriched = await enrichFromJobPage(candidate.url, candidate.description);
        description = enriched.text || description;
        email = enriched.email;
      } catch {}

      if (!email && process.env.HUNTER_API_KEY) {
        try {
          const hunter = await findHunterCompanyEmail(candidate.company);
          email = hunter.email;
        } catch {}
      }

      if (!email) continue;

      const jobForApplication: Job = {
        source: candidate.source,
        sourceId: candidate.sourceId,
        title: candidate.title,
        company: candidate.company,
        location: candidate.location,
        description,
        url: candidate.url,
        createdAt: candidate.createdAt,
        salary: candidate.salary,
      };

      const finalCandidate = strictEvaluate(evaluate(jobForApplication));
      finalCandidate.email = email;

      if (finalCandidate.score < 88 || !finalCandidate.strict.autoEligible) continue;

      const app = buildApplication(finalCandidate);

      await smtpSend({
        to: testRecipient,
        subject: `[TEST → ${email}] ${app.subject}`,
        message:
          `TEST MODE\nAzienda: ${finalCandidate.company}\nPosizione: ${finalCandidate.title}\n` +
          `Destinatario reale previsto: ${email}\nMatch: ${finalCandidate.score}%\n\n${app.message}`,
        pdf: pdfFor(app.cv),
      });

      return NextResponse.json({
        ok: true,
        testRecipient,
        realRecipient: email,
        company: finalCandidate.company,
        title: finalCandidate.title,
        score: finalCandidate.score,
        subject: app.subject,
        message: "Email di test inviata. Nessuna candidatura è stata inviata all'azienda.",
      });
    }

    return NextResponse.json(
      { error: "Nessun TOP MATCH con email verificata disponibile per il test." },
      { status: 404 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "Errore durante l'invio della candidatura di test.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
