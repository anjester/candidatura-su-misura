import type { EvaluatedJob, Job } from "./types";

const positive = [
  [/after effects|motion design|motion graphic|composit/i, 18, "After Effects / Motion"],
  [/indesign|impagin|editorial|catalog|manualistica|\bdtp\b/i, 18, "InDesign / Editorial"],
  [/video edit|premiere|post[- ]production|montaggio/i, 14, "Video editing"],
  [/photoshop/i, 8, "Photoshop"],
  [/illustrator/i, 8, "Illustrator"],
  [/cinema 4d|\bc4d\b|3d|render/i, 8, "3D / Cinema 4D"],
  [/adv|advertising|campaign|campagn|key visual/i, 7, "ADV"],
  [/remote|remoto|ibrid|hybrid/i, 5, "Remote / hybrid"],
  [/senior|esperienza|years of experience|anni di esperienza/i, 4, "Seniorità"],
] as const;

const exclusions = [
  [/internship|stage|tirocinio|junior\b/i, -30, "Stage/junior"],
  [/figma/i, 0, "Figma richiesto"],
  [/blender/i, 0, "Blender richiesto"],
  [/toon boom|harmony/i, -7, "Toon Boom/Harmony"],
  [/advanced english|english c1|inglese c1|fluent english/i, -7, "Inglese avanzato"],
] as const;

export function evaluate(job: Job): EvaluatedJob {
  const text = `${job.title} ${job.company} ${job.location} ${job.description}`;
  let score = 48;
  const reasons: string[] = [];
  const gaps: string[] = [];

  for (const [re, pts, label] of positive) {
    if (re.test(text)) { score += pts; reasons.push(label); }
  }
  for (const [re, pts, label] of exclusions) {
    if (re.test(text)) {
      score += pts;
      if (label === "Figma richiesto" || label === "Blender richiesto" || pts < 0) gaps.push(label);
    }
  }

  if (/milano|monza|brianza|como|lecco|lombardia|remote|remoto|italy|italia/i.test(text)) score += 7;
  if (/partita iva|freelance|contract|collaborazione|full[- ]time|tempo indeterminato|tempo determinato/i.test(text)) score += 4;

  score = Math.max(0, Math.min(98, score));
  const editorial = /indesign|impagin|editorial|catalog|manualistica|\bdtp\b/i.test(text) && !/after effects|motion|video|composit/i.test(text);
  const motion = /after effects|motion|video|composit|animation|animazione/i.test(text);

  return {
    ...job,
    score,
    reasons: [...new Set(reasons)],
    gaps: [...new Set(gaps)],
    cvTemplate: editorial ? "Editorial / DTP" : motion ? "Motion / Video" : "ATS Clean",
  };
}

export function buildApplication(job: EvaluatedJob) {
  const role = job.title || "posizione creativa";
  const focus = job.reasons.slice(0, 5).join(", ") || "grafica, motion, video e produzione esecutiva";
  const cvTitle = job.cvTemplate === "Editorial / DTP"
    ? "Senior Editorial Designer · DTP · InDesign"
    : job.cvTemplate === "Motion / Video"
      ? "Senior Motion Designer · Video & Compositing"
      : "Senior Graphic Designer · Visual Communication";

  const gapLine = job.gaps.length
    ? `Segnalo con trasparenza alcuni requisiti non centrali nel mio workflow attuale (${job.gaps.join(", ")}); il resto del profilo è invece fortemente allineato alla posizione.`
    : "";

  const message = [
    "Buongiorno,",
    "",
    `vi contatto in riferimento alla posizione di ${role}.`,
    "",
    `Sono Antonio Filippone, Senior Graphic & Motion Designer con oltre 20 anni di esperienza nella comunicazione visiva, editoriale, pubblicitaria e digitale. Per questa posizione ritengo particolarmente rilevanti: ${focus}.`,
    gapLine ? `\n${gapLine}` : "",
    "",
    "Allego un CV mirato alla posizione e il mio portfolio. Sarei lieto di approfondire in un colloquio come potrei contribuire ai vostri progetti.",
    "",
    "Portfolio: https://www.antoniofilippone.com",
    "",
    "Cordiali saluti,",
    "Antonio Filippone",
    "info@antoniofilippone.com",
    "+39 347 50 29 169",
  ].filter(Boolean).join("\n");

  return {
    subject: `Candidatura ${role} – Antonio Filippone`,
    message,
    cv: {
      cvTemplate: job.cvTemplate,
      cvTitle,
      cvSummary: `Senior Graphic & Motion Designer con oltre 20 anni di esperienza. Profilo mirato a ${focus}, con gestione autonoma dal brief alla consegna esecutiva.`,
      cvSkills: job.reasons.slice(0, 7),
    },
  };
}
