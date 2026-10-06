import { NextRequest, NextResponse } from "next/server";
import { fetchAdzunaJobs } from "@/lib/agent/sources/adzuna";
import { fetchJoobleJobs } from "@/lib/agent/sources/jooble";
import { buildApplication, evaluate } from "@/lib/agent/scoring";
import { enrichFromJobPage } from "@/lib/agent/web";
import { alreadySeen, saveJob, storeConfigured } from "@/lib/agent/store";
import { pdfFor, smtpSend } from "@/lib/agent/mailer";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const mode = (process.env.AGENT_MODE || "review").toLowerCase();
  const autoThreshold = Number(process.env.AUTO_SEND_THRESHOLD || 85);
  const maxPerRun = Number(process.env.MAX_AUTO_SEND_PER_RUN || 3);

  const raw = [...await fetchAdzunaJobs(), ...await fetchJoobleJobs()];
  const unique = dedupe(raw).map(evaluate).sort((a,b)=>b.score-a.score);
  const results:any[] = [];
  let sent = 0;

  for (const candidate of unique.slice(0, 35)) {
    if (await alreadySeen(candidate.source, candidate.sourceId)) continue;

    const enriched = await enrichFromJobPage(candidate.url, candidate.description);
    const evaluated = evaluate({ ...candidate, description: enriched.text });
    evaluated.email = enriched.email;

    let status = evaluated.score >= 70 ? "review" : "skipped";
    let note = evaluated.gaps.join(", ");

    if (evaluated.score >= autoThreshold && mode === "auto" && evaluated.email && sent < maxPerRun) {
      if (!storeConfigured()) {
        status = "blocked_no_store";
        note = "Auto-invio bloccato: configura Supabase per evitare duplicati.";
      } else {
        const app = buildApplication(evaluated);
        await smtpSend({ to: evaluated.email, subject: app.subject, message: app.message, pdf: pdfFor(app.cv) });
        sent++;
        status = "sent";
      }
    } else if (evaluated.score >= autoThreshold && !evaluated.email) {
      status = "needs_manual";
      note = "Compatibilità alta, ma nessuna email pubblica verificabile trovata.";
    }

    await saveJob(evaluated, status, evaluated.email, note);
    results.push({ source:evaluated.source, title:evaluated.title, company:evaluated.company, score:evaluated.score, status, email:evaluated.email || null, url:evaluated.url, gaps:evaluated.gaps });
  }

  return NextResponse.json({ ok:true, mode, found:raw.length, evaluated:results.length, sent, results:results.slice(0,15) });
}

function dedupe(items:any[]) {
  const seen = new Set<string>();
  return items.filter((x) => {
    const key = `${x.source}:${x.sourceId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
