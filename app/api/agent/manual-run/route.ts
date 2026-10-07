import { NextResponse } from "next/server";
import type { Job, EvaluatedJob } from "@/lib/agent/types";

export const runtime = "nodejs";
export const maxDuration = 60;

type StrictMeta = {
  strongRole: boolean;
  hardNegative: boolean;
  juniorLike: boolean;
  skills: number;
  autoEligible: boolean;
};

type StrictEvaluatedJob = EvaluatedJob & {
  strict: StrictMeta;
};

const STRONG_ROLES = [
  /graphic\s*designer/i,
  /senior\s*graphic/i,
  /motion\s*(graphic\s*)?designer/i,
  /motion\s*graphics?/i,
  /video\s*editor/i,
  /video\s*editing/i,
  /editorial\s*designer/i,
  /grafico\s*editoriale/i,
  /impaginat/i,
  /\bdtp\b/i,
  /desktop\s*publish/i,
  /artworker/i,
  /prepress/i,
  /prestampa/i,
  /grafico\s*esecutiv/i,
  /presentation\s*designer/i,
  /visual\s*designer/i,
  /2d\s*composit/i,
  /compositor/i,
  /3d\s*artist/i,
  /3d\s*designer/i,
  /content\s*creator/i,
];

const HARD_NEGATIVE_ROLES = [
  /digital\s*marketing\s*specialist/i,
  /marketing\s*(specialist|manager|assistant|executive)/i,
  /impiegat[oa].*marketing/i,
  /social\s*media\s*(manager|specialist)/i,
  /community\s*manager/i,
  /\bseo\b.*specialist/i,
  /\bsem\b.*specialist/i,
  /performance\s*marketing/i,
  /sales/i,
  /commerciale/i,
  /account\s*(manager|executive)/i,
  /project\s*manager/i,
  /product\s*manager/i,
  /architect/i,
  /architett[oa]/i,
  /renderista/i,
  /interior\s*designer/i,
  /ux\s*research/i,
  /developer/i,
  /programmat/i,
];

const JUNIOR_OR_TRAINING = [
  /\bjunior\b/i,
  /\bjr\.?\b/i,
  /\bintern(ship)?\b/i,
  /\bstage\b/i,
  /\btirocin/i,
  /\bapprendistat/i,
  /\btrainee\b/i,
];

const CORE_SKILLS = [
  /after\s*effects/i,
  /\bindesign\b/i,
  /premiere(\s*pro)?/i,
  /photoshop/i,
  /illustrator/i,
  /cinema\s*4d/i,
  /motion\s*graphics?/i,
  /video\s*edit/i,
  /impagin/i,
  /editorial/i,
  /\bdtp\b/i,
  /composit/i,
  /prepress|prestampa/i,
  /catalog/i,
  /brochure/i,
  /manualistic/i,
  /adobe/i,
  /visual\s*design/i,
  /content\s*creation/i,
];

const EXCLUDED_PROFILE_SKILLS = [/\bfigma\b/i, /\bblender\b/i];

function clean(v: unknown) {
  return String(v ?? "").trim();
}

function normalize(v: unknown) {
  return clean(v)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(srl|spa|s\.r\.l\.|s\.p\.a\.|ltd|inc)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function strictEvaluate(base: EvaluatedJob): StrictEvaluatedJob {
  const title = clean(base.title);
  const text = `${title}\n${clean(base.description)}`;

  const strongRole =
    STRONG_ROLES.some((r) => r.test(title)) ||
    STRONG_ROLES.some((r) => r.test(text));

  const hardNegative = HARD_NEGATIVE_ROLES.some((r) => r.test(title));
  const juniorLike = JUNIOR_OR_TRAINING.some((r) => r.test(title));

  const skills = CORE_SKILLS.reduce(
    (n, r) => n + (r.test(text) ? 1 : 0),
    0
  );

  const excludedSkills = EXCLUDED_PROFILE_SKILLS.reduce(
    (n, r) => n + (r.test(text) ? 1 : 0),
    0
  );

  let score = base.score;
  const gaps = [...base.gaps];

  if (strongRole) score += 8;
  if (hardNegative) score -= 35;

  if (skills >= 5) score += 10;
  else if (skills >= 3) score += 6;
  else if (skills >= 2) score += 2;
  else score -= 12;

  if (excludedSkills > 0) {
    gaps.push("Figma/Blender richiesti: non presenti nel profilo master");
    score -= Math.min(10, excludedSkills * 5);
  }

  if (juniorLike) {
    gaps.push("Ruolo Junior/Intern/Stage: escluso dall'invio automatico");
    score = Math.min(score - 25, 69);
  }

  const autoEligible =
    strongRole &&
    !hardNegative &&
    !juniorLike &&
    skills >= 2;

  if (!autoEligible) score = Math.min(score, 77);
  if (hardNegative && !strongRole) score = Math.min(score, 64);

  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    ...base,
    score,
    gaps: [...new Set(gaps)],
    strict: {
      strongRole,
      hardNegative,
      juniorLike,
      skills,
      autoEligible,
    },
  };
}

function crossSourceKey(item: Job) {
  const title = normalize(item.title)
    .replace(
      /\b(senior|junior|jr|expert|remote|remoto|intern|internship|stage|m f d|m\/f\/d)\b/g,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();

  return `${title}|${normalize(item.company)}|${normalize(item.location)}`;
}

function dedupeCrossSource(items: Job[]): Job[] {
  const seenSourceId = new Set<string>();
  const seenEquivalent = new Set<string>();

  return items.filter((item) => {
    const sourceKey = `${item.source}:${item.sourceId}`;
    const equivalentKey = crossSourceKey(item);

    if (seenSourceId.has(sourceKey)) return false;
    seenSourceId.add(sourceKey);

    if (equivalentKey !== "||" && seenEquivalent.has(equivalentKey)) {
      return false;
    }

    if (equivalentKey !== "||") {
      seenEquivalent.add(equivalentKey);
    }

    return true;
  });
}

export async function POST(req: Request) {
  try {
    let reanalyze = false;
    try {
      const body = await req.json();
      reanalyze = body?.reanalyze === true;
    } catch {
      reanalyze = false;
    }
    const [
      { fetchAdzunaJobs },
      { fetchJoobleJobs },
      { buildApplication, evaluate },
      { enrichFromJobPage },
      { alreadySeen, alreadySeenEquivalent, saveJob, storeConfigured },
      { pdfFor, smtpSend },
      { findHunterCompanyEmail },
    ] = await Promise.all([
      import("@/lib/agent/sources/adzuna"),
      import("@/lib/agent/sources/jooble"),
      import("@/lib/agent/scoring"),
      import("@/lib/agent/web"),
      import("@/lib/agent/store"),
      import("@/lib/agent/mailer"),
      import("@/lib/agent/hunter"),
    ]);

    const configuredMode = (process.env.AGENT_MODE || "review").toLowerCase();
    const mode = reanalyze ? "review" : configuredMode;
    const autoThreshold = Number(process.env.AUTO_SEND_THRESHOLD || 88);
    const maxPerRun = Number(process.env.MAX_AUTO_SEND_PER_RUN || 3);

    let adzunaJobs: Job[] = [];
    let joobleJobs: Job[] = [];

    try {
      adzunaJobs = await fetchAdzunaJobs();
    } catch (error) {
      return NextResponse.json(
        {
          error: "Errore Adzuna",
          details: error instanceof Error ? error.message : String(error),
        },
        { status: 500 }
      );
    }

    try {
      joobleJobs = await fetchJoobleJobs();
    } catch (error) {
      return NextResponse.json(
        {
          error: "Errore Jooble",
          details: error instanceof Error ? error.message : String(error),
        },
        { status: 500 }
      );
    }

    const raw: Job[] = [...adzunaJobs, ...joobleJobs];

    const unique: StrictEvaluatedJob[] = dedupeCrossSource(raw)
      .map((job) => strictEvaluate(evaluate(job)))
      .sort((a, b) => b.score - a.score);

    // Limita il lavoro "pesante" ai candidati più promettenti per evitare
    // timeout su Vercel Hobby.
    const candidates = unique
      .filter((x) => x.strict.strongRole && !x.strict.hardNegative && x.score >= 68)
      .slice(0, 15);

    const results: Array<{
      job: StrictEvaluatedJob;
      status: string;
      note: string;
    }> = [];

    let sent = 0;
    let alreadySeenCount = 0;

    for (const candidate of candidates) {
      if (!reanalyze) {
        try {
          if (await alreadySeen(candidate.source, candidate.sourceId)) {
            alreadySeenCount++;
            continue;
          }

          if (
            await alreadySeenEquivalent(
              candidate.title,
              candidate.company,
              candidate.location
            )
          ) {
            alreadySeenCount++;
            continue;
          }
        } catch (error) {
          return NextResponse.json(
            {
              error: "Errore Supabase durante controllo duplicati",
              details: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
          );
        }
      }

      let enriched: { text: string; email?: string; companyUrl?: string } = {
        text: candidate.description,
        email: undefined,
        companyUrl: undefined,
      };

      if (candidate.score >= 72) {
        try {
          enriched = await enrichFromJobPage(
            candidate.url,
            candidate.description
          );
        } catch {
          // Continua con la descrizione originale.
        }
      }

      if (
        !enriched.email &&
        candidate.score >= 88 &&
        candidate.strict.autoEligible &&
        process.env.HUNTER_API_KEY
      ) {
        try {
          const hunter = await findHunterCompanyEmail(candidate.company);
          if (hunter.email) {
            enriched.email = hunter.email;
            enriched.companyUrl = hunter.domain ? `https://${hunter.domain}` : undefined;
          }
        } catch {}
      }

      const recheckJob: Job = {
        source: candidate.source,
        sourceId: candidate.sourceId,
        title: candidate.title,
        company: candidate.company,
        location: candidate.location,
        description: enriched.text || candidate.description,
        url: candidate.url,
        createdAt: candidate.createdAt,
        salary: candidate.salary,
      };

      const evaluated = strictEvaluate(evaluate(recheckJob));
      evaluated.email = enriched.email;

      let status =
        evaluated.score >= 88 && evaluated.strict.autoEligible
          ? "top"
          : evaluated.score >= 72 && evaluated.strict.strongRole
            ? "review"
            : "skipped";

      let note = evaluated.gaps.join(", ");

      if (
        evaluated.score >= autoThreshold &&
        evaluated.strict.autoEligible &&
        !reanalyze &&
        mode === "auto" &&
        evaluated.email &&
        sent < maxPerRun
      ) {
        if (!storeConfigured()) {
          status = "blocked_no_store";
          note = "Auto-invio bloccato: Supabase non configurato.";
        } else {
          try {
            const app = buildApplication(evaluated);

            await smtpSend({
              to: evaluated.email,
              subject: app.subject,
              message: app.message,
              pdf: pdfFor(app.cv),
            });

            sent++;
            status = "sent";
          } catch (error) {
            status = "send_error";
            note =
              error instanceof Error
                ? error.message
                : "Errore durante l'invio email.";
          }
        }
      } else if (
        evaluated.score >= autoThreshold &&
        evaluated.strict.autoEligible &&
        !evaluated.email
      ) {
        status = "needs_manual";
        note =
          "Compatibilità alta, ma nessuna email pubblica verificabile trovata.";
      } else if (
        status === "top" &&
        mode === "review"
      ) {
        status = "top";
      }

      if (!reanalyze) {
        try {
          await saveJob(
            evaluated,
            status,
            evaluated.email,
            note
          );
        } catch (error) {
          return NextResponse.json(
            {
              error: "Errore Supabase durante salvataggio",
              details: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
          );
        }
      }

      results.push({ job: evaluated, status, note });
    }

    const visibleResults = results
      .filter(({ status }) => status !== "skipped")
      .slice(0, 30)
      .map(({ job, status }) => ({
        source: job.source,
        title: job.title,
        company: job.company,
        location: job.location,
        score: job.score,
        status,
        band:
          job.score >= 88 && job.strict.autoEligible
            ? "top"
            : "review",
        email: job.email || null,
        url: job.url,
        gaps: job.gaps,
        strict: job.strict,
      }));

    const topCount = visibleResults.filter((x) => x.band === "top").length;
    const reviewCount = visibleResults.filter((x) => x.band === "review").length;
    const skippedInsideCandidates = results.filter(
      ({ status }) => status === "skipped"
    ).length;
    const filteredOut = Math.max(0, unique.length - candidates.length);
    const skippedCount = skippedInsideCandidates + filteredOut;

    return NextResponse.json({
      ok: true,
      mode,
      reanalyze,
      found: raw.length,
      unique: unique.length,
      candidates: candidates.length,
      alreadySeen: alreadySeenCount,
      adzuna: adzunaJobs.length,
      jooble: joobleJobs.length,
      evaluated: results.length,
      top: topCount,
      review: reviewCount,
      skipped: skippedCount,
      sent,
      message:
        reanalyze
          ? "Rianalisi completata: deduplica e salvataggio ignorati, nessuna candidatura inviata."
          : results.length === 0 && alreadySeenCount > 0
            ? "Nessun nuovo annuncio pertinente: i candidati migliori erano già presenti nello storico."
            : undefined,
      results: visibleResults,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Errore interno agente",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
