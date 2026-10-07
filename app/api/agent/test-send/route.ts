import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

function safeSubject(value: string) {
  return String(value || "")
    .replace(/→/g, "->")
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7EÀ-ÿ]/g, "");
}

export async function POST() {
  try {
    const testMode =
      String(process.env.EMAIL_TEST_MODE || "").toLowerCase() === "true";

    const testRecipient = process.env.TEST_RECIPIENT?.trim();

    if (!testMode) {
      return NextResponse.json(
        { error: "EMAIL_TEST_MODE non attivo su Vercel." },
        { status: 400 }
      );
    }

    if (!testRecipient) {
      return NextResponse.json(
        { error: "TEST_RECIPIENT non configurato su Vercel." },
        { status: 400 }
      );
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

    const [adzuna, jooble] = await Promise.all([
      fetchAdzunaJobs(),
      fetchJoobleJobs(),
    ]);

    const jobs = [...adzuna, ...jooble]
      .map((job: any) => evaluate(job))
      .filter((job: any) => {
        const title = String(job.title || "").toLowerCase();

        const relevant =
          /graphic designer|motion designer|motion graphics|video editor|editorial designer|impagin|dtp|artworker|prepress|prestampa|visual designer|2d composit|3d artist|content creator/i.test(
            title
          );

        const excluded =
          /junior|jr\b|intern|internship|stage|tirocin|apprendistat|marketing specialist|sales|commerciale|architect|developer/i.test(
            title
          );

        return relevant && !excluded && Number(job.score || 0) >= 80;
      })
      .sort((a: any, b: any) => Number(b.score || 0) - Number(a.score || 0))
      .slice(0, 12);

    for (const candidate of jobs) {
      let email: string | undefined;
      let description = String(candidate.description || "");

      try {
        const enriched = await enrichFromJobPage(
          candidate.url,
          candidate.description
        );

        description = enriched.text || description;
        email = enriched.email;
      } catch {
        // Hunter fallback below.
      }

      if (!email && process.env.HUNTER_API_KEY) {
        try {
          const hunter = await findHunterCompanyEmail(candidate.company);
          email = hunter.email;
        } catch {
          // Try next candidate.
        }
      }

      if (!email) continue;

      const finalJob: any = {
        ...candidate,
        description,
        email,
      };

      const app = buildApplication(finalJob);

      await smtpSend({
        to: testRecipient,
        subject: safeSubject(`[TEST -> ${email}] ${app.subject}`),
        message:
          `TEST MODE\n` +
          `Azienda: ${candidate.company}\n` +
          `Posizione: ${candidate.title}\n` +
          `Destinatario reale previsto: ${email}\n` +
          `Match indicativo: ${candidate.score}%\n\n` +
          app.message,
        pdf: pdfFor(app.cv),
      });

      return NextResponse.json({
        ok: true,
        testRecipient,
        realRecipient: email,
        company: candidate.company,
        title: candidate.title,
        score: candidate.score,
        subject: app.subject,
        message:
          "Email di test inviata. Nessuna candidatura è stata inviata all'azienda.",
      });
    }

    return NextResponse.json(
      {
        error:
          "Nessun annuncio pertinente con email verificata disponibile per il test.",
      },
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
