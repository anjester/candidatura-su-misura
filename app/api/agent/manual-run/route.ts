import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  try {
    const [
      { fetchAdzunaJobs },
      { fetchJoobleJobs },
      { buildApplication, evaluate },
      { enrichFromJobPage },
      { alreadySeen, saveJob, storeConfigured },
      { pdfFor, smtpSend },
    ] = await Promise.all([
      import("@/lib/agent/sources/adzuna"),
      import("@/lib/agent/sources/jooble"),
      import("@/lib/agent/scoring"),
      import("@/lib/agent/web"),
      import("@/lib/agent/store"),
      import("@/lib/agent/mailer"),
    ]);

    const mode = (process.env.AGENT_MODE || "review").toLowerCase();
    const autoThreshold = Number(process.env.AUTO_SEND_THRESHOLD || 85);
    const maxPerRun = Number(process.env.MAX_AUTO_SEND_PER_RUN || 3);

    let adzunaJobs: any[] = [];
    let joobleJobs: any[] = [];

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

    const raw = [...adzunaJobs, ...joobleJobs];

    const unique = dedupe(raw)
      .map((item: any) => evaluate(item))
      .sort((a: any, b: any) => b.score - a.score);

    const results: any[] = [];
    let sent = 0;

    for (const candidate of unique.slice(0, 35)) {
      let seen = false;

      try {
        seen = await alreadySeen(candidate.source, candidate.sourceId);
      } catch (error) {
        return NextResponse.json(
          {
            error: "Errore Supabase durante controllo duplicati",
            details: error instanceof Error ? error.message : String(error),
          },
          { status: 500 }
        );
      }

      if (seen) continue;

      let enriched = {
        text: candidate.description || "",
        email: undefined as string | undefined,
      };

      try {
        enriched = await enrichFromJobPage(
          candidate.url,
          candidate.description
        );
      } catch (error) {
        // Se la pagina originale non è raggiungibile, continuiamo con
        // la descrizione fornita dalla sorgente.
        enriched = {
          text: candidate.description || "",
          email: undefined,
        };
      }

      const evaluated = evaluate({
        ...candidate,
        description: enriched.text,
      });

      evaluated.email = enriched.email;

      let status = evaluated.score >= 70 ? "review" : "skipped";
      let note = Array.isArray(evaluated.gaps)
        ? evaluated.gaps.join(", ")
        : "";

      if (
        evaluated.score >= autoThreshold &&
        mode === "auto" &&
        evaluated.email &&
        sent < maxPerRun
      ) {
        if (!storeConfigured()) {
          status = "blocked_no_store";
          note =
            "Auto-invio bloccato: configura Supabase per evitare duplicati.";
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
        !evaluated.email
      ) {
        status = "needs_manual";
        note =
          "Compatibilità alta, ma nessuna email pubblica verificabile trovata.";
      }

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

      results.push({
        source: evaluated.source,
        title: evaluated.title,
        company: evaluated.company,
        score: evaluated.score,
        status,
        email: evaluated.email || null,
        url: evaluated.url,
        gaps: evaluated.gaps || [],
      });
    }

    return NextResponse.json({
      ok: true,
      mode,
      found: raw.length,
      adzuna: adzunaJobs.length,
      jooble: joobleJobs.length,
      evaluated: results.length,
      sent,
      results: results.slice(0, 15),
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

function dedupe(items: any[]) {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = `${item.source}:${item.sourceId}`;

    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}
