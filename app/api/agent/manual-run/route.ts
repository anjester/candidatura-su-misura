import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const STRONG_ROLES = [
  /graphic\s*designer/i, /senior\s*graphic/i, /motion\s*(graphic\s*)?designer/i,
  /motion\s*graphics?/i, /video\s*editor/i, /video\s*editing/i,
  /editorial\s*designer/i, /grafico\s*editoriale/i, /impaginat/i,
  /\bdtp\b/i, /desktop\s*publish/i, /artworker/i, /prepress/i, /prestampa/i,
  /grafico\s*esecutiv/i, /presentation\s*designer/i, /visual\s*designer/i,
  /2d\s*composit/i, /compositor/i, /3d\s*artist/i, /3d\s*designer/i,
];

const HARD_NEGATIVE_ROLES = [
  /digital\s*marketing\s*specialist/i, /marketing\s*(specialist|manager|assistant|executive)/i,
  /impiegat[oa].*marketing/i, /social\s*media\s*(manager|specialist)/i,
  /community\s*manager/i, /\bseo\b.*specialist/i, /\bsem\b.*specialist/i,
  /performance\s*marketing/i, /sales/i, /commerciale/i,
  /account\s*(manager|executive)/i, /project\s*manager/i, /product\s*manager/i,
  /architect/i, /architett[oa]/i, /renderista/i, /interior\s*designer/i,
  /ux\s*research/i, /developer/i, /programmat/i,
];

const CORE_SKILLS = [
  /after\s*effects/i, /\bindesign\b/i, /premiere(\s*pro)?/i, /photoshop/i,
  /illustrator/i, /cinema\s*4d/i, /motion\s*graphics?/i, /video\s*edit/i,
  /impagin/i, /editorial/i, /\bdtp\b/i, /composit/i, /prepress|prestampa/i,
  /catalog/i, /brochure/i, /manualistic/i, /adobe/i,
];

const EXCLUDED_PROFILE_SKILLS = [/\bfigma\b/i, /\bblender\b/i];
type AnyJob = Record<string, any>;

const clean = (v: unknown) => String(v ?? "").trim();
const normalize = (v: unknown) => clean(v).toLowerCase().normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/\b(srl|spa|s\.r\.l\.|s\.p\.a\.|ltd|inc)\b/g, "")
  .replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();

function strictEvaluate(base: AnyJob): AnyJob {
  const title = clean(base.title);
  const text = `${title}\n${clean(base.description)}`;
  const strongRole = STRONG_ROLES.some(r => r.test(title)) || STRONG_ROLES.some(r => r.test(text));
  const hardNegative = HARD_NEGATIVE_ROLES.some(r => r.test(title));
  const skills = CORE_SKILLS.reduce((n, r) => n + (r.test(text) ? 1 : 0), 0);
  const excludedSkills = EXCLUDED_PROFILE_SKILLS.reduce((n, r) => n + (r.test(text) ? 1 : 0), 0);

  let score = Number(base.score ?? 0);
  const gaps = Array.isArray(base.gaps) ? [...base.gaps] : [];

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

  const autoEligible = strongRole && !hardNegative && skills >= 2;
  if (!autoEligible) score = Math.min(score, 77);
  if (hardNegative && !strongRole) score = Math.min(score, 64);
  score = Math.max(0, Math.min(100, Math.round(score)));

  return { ...base, score, gaps, strict: { strongRole, hardNegative, skills, autoEligible } };
}

function crossSourceKey(item: AnyJob) {
  const title = normalize(item.title)
    .replace(/\b(senior|junior|expert|remote|remoto|m f d|m\/f\/d)\b/g, "")
    .replace(/\s+/g, " ").trim();
  return `${title}|${normalize(item.company)}|${normalize(item.location)}`;
}

function dedupeCrossSource(items: AnyJob[]) {
  const seenSourceId = new Set<string>();
  const seenEquivalent = new Set<string>();
  return items.filter(item => {
    const sourceKey = `${clean(item.source)}:${clean(item.sourceId)}`;
    const equivalentKey = crossSourceKey(item);
    if (seenSourceId.has(sourceKey)) return false;
    seenSourceId.add(sourceKey);
    if (equivalentKey !== "||" && seenEquivalent.has(equivalentKey)) return false;
    if (equivalentKey !== "||") seenEquivalent.add(equivalentKey);
    return true;
  });
}

export async function POST() {
  try {
    const [
      { fetchAdzunaJobs }, { fetchJoobleJobs }, { buildApplication, evaluate },
      { enrichFromJobPage }, { alreadySeen, alreadySeenEquivalent, saveJob, storeConfigured },
      { pdfFor, smtpSend },
    ] = await Promise.all([
      import("@/lib/agent/sources/adzuna"), import("@/lib/agent/sources/jooble"),
      import("@/lib/agent/scoring"), import("@/lib/agent/web"),
      import("@/lib/agent/store"), import("@/lib/agent/mailer"),
    ]);

    const mode = (process.env.AGENT_MODE || "review").toLowerCase();
    const autoThreshold = Number(process.env.AUTO_SEND_THRESHOLD || 88);
    const maxPerRun = Number(process.env.MAX_AUTO_SEND_PER_RUN || 3);

    let adzunaJobs: AnyJob[] = [];
    let joobleJobs: AnyJob[] = [];
    try { adzunaJobs = await fetchAdzunaJobs(); }
    catch (e) { return NextResponse.json({error:"Errore Adzuna",details:e instanceof Error?e.message:String(e)},{status:500}); }
    try { joobleJobs = await fetchJoobleJobs(); }
    catch (e) { return NextResponse.json({error:"Errore Jooble",details:e instanceof Error?e.message:String(e)},{status:500}); }

    const raw = [...adzunaJobs, ...joobleJobs];
    const unique = dedupeCrossSource(raw).map((x:AnyJob)=>strictEvaluate(evaluate(x))).sort((a:AnyJob,b:AnyJob)=>b.score-a.score);
    const results: AnyJob[] = [];
    let sent = 0;

    for (const candidate of unique.slice(0, 50)) {
      try {
        if (await alreadySeen(candidate.source, candidate.sourceId)) continue;
        if (await alreadySeenEquivalent(candidate.title, candidate.company, candidate.location)) continue;
      } catch (e) {
        return NextResponse.json({error:"Errore Supabase durante controllo duplicati",details:e instanceof Error?e.message:String(e)},{status:500});
      }

      let enriched: { text: string; email?: string } = { text: clean(candidate.description), email: undefined };
      try { enriched = await enrichFromJobPage(candidate.url, candidate.description); } catch {}

      const evaluated = strictEvaluate(evaluate({...candidate, description: enriched.text || candidate.description}));
      evaluated.email = enriched.email;

      let status = evaluated.score >= 78 && evaluated.strict?.autoEligible ? "review" : "skipped";
      let note = Array.isArray(evaluated.gaps) ? evaluated.gaps.join(", ") : "";

      if (evaluated.score >= autoThreshold && evaluated.strict?.autoEligible && mode === "auto" && evaluated.email && sent < maxPerRun) {
        if (!storeConfigured()) {
          status = "blocked_no_store";
          note = "Auto-invio bloccato: Supabase non configurato.";
        } else {
          try {
            const app = buildApplication(evaluated);
            await smtpSend({to:evaluated.email,subject:app.subject,message:app.message,pdf:pdfFor(app.cv)});
            sent++; status = "sent";
          } catch (e) {
            status = "send_error";
            note = e instanceof Error ? e.message : "Errore durante l'invio email.";
          }
        }
      } else if (evaluated.score >= autoThreshold && evaluated.strict?.autoEligible && !evaluated.email) {
        status = "needs_manual";
        note = "Compatibilità alta, ma nessuna email pubblica verificabile trovata.";
      }

      try { await saveJob(evaluated,status,evaluated.email,note); }
      catch (e) { return NextResponse.json({error:"Errore Supabase durante salvataggio",details:e instanceof Error?e.message:String(e)},{status:500}); }

      results.push({source:evaluated.source,title:evaluated.title,company:evaluated.company,location:evaluated.location,score:evaluated.score,status,email:evaluated.email||null,url:evaluated.url,gaps:evaluated.gaps||[],strict:evaluated.strict});
    }

    return NextResponse.json({
      ok:true, mode, found:raw.length, unique:unique.length, adzuna:adzunaJobs.length, jooble:joobleJobs.length,
      evaluated:results.length, review:results.filter(x=>x.status==="review").length,
      needsManual:results.filter(x=>x.status==="needs_manual").length,
      skipped:results.filter(x=>x.status==="skipped").length, sent,
      results:results.filter(x=>x.status!=="skipped").slice(0,20),
    });
  } catch (e) {
    return NextResponse.json({error:"Errore interno agente",details:e instanceof Error?e.message:String(e)},{status:500});
  }
}
