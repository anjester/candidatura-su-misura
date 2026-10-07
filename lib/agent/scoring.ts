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
  [/senior|esperienza|years of experience|anni di esperienza/i, 4, "Seniorita"],
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
    if (re.test(text)) {
      score += pts;
      reasons.push(label);
    }
  }

  for (const [re, pts, label] of exclusions) {
    if (re.test(text)) {
      score += pts;
      if (label === "Figma richiesto" || label === "Blender richiesto" || pts < 0) {
        gaps.push(label);
      }
    }
  }

  if (/milano|monza|brianza|como|lecco|lombardia|remote|remoto|italy|italia/i.test(text)) score += 7;
  if (/partita iva|freelance|contract|collaborazione|full[- ]time|tempo indeterminato|tempo determinato/i.test(text)) score += 4;

  score = Math.max(0, Math.min(98, score));

  const editorial =
    /indesign|impagin|editorial|catalog|manualistica|\bdtp\b/i.test(text) &&
    !/after effects|motion|video|composit/i.test(text);

  const motion =
    /after effects|motion|video|composit|animation|animazione/i.test(text);

  return {
    ...job,
    score,
    reasons: [...new Set(reasons)],
    gaps: [...new Set(gaps)],
    cvTemplate: editorial ? "Editorial / DTP" : motion ? "Motion / Video" : "ATS Clean",
  };
}

function uniq(items: string[]) {
  return [...new Set(items.filter(Boolean))];
}

export function buildApplication(job: EvaluatedJob) {
  const role = job.title || "posizione creativa";
  const focus =
    job.reasons.slice(0, 5).join(", ") ||
    "graphic design, motion design, video editing e produzione esecutiva";

  const isEditorial = job.cvTemplate === "Editorial / DTP";
  const isMotion = job.cvTemplate === "Motion / Video";

  const cvTitle = isEditorial
    ? "Senior Editorial Designer | DTP | InDesign"
    : isMotion
      ? "Senior Motion Designer | Video Editor | Graphic Designer"
      : "Senior Graphic Designer | Visual Communication";

  const baseCore = isEditorial
    ? [
        "Editorial Design",
        "Impaginazione",
        "Adobe InDesign",
        "Cataloghi e brochure",
        "Company profile",
        "DTP e prestampa",
        "Graphic Design",
        "Adobe Illustrator",
        "Adobe Photoshop",
      ]
    : isMotion
      ? [
          "Motion Graphics",
          "Video Editing",
          "Adobe After Effects",
          "Adobe Premiere Pro",
          "Compositing 2D",
          "Kinetic Typography",
          "Social Video e Reel",
          "Graphic Design",
          "Cinema 4D",
        ]
      : [
          "Graphic Design",
          "Visual Communication",
          "ADV e campagne",
          "Adobe Creative Cloud",
          "Editorial Design",
          "Motion Graphics",
          "Video Editing",
          "Social Content",
          "Presentation Design",
        ];

  const reasonSkills = job.reasons
    .map((x) => x.replace(" / ", " & "))
    .filter((x) => !/remote|seniorita/i.test(x));

  const cvCore = uniq([...reasonSkills, ...baseCore]).slice(0, 10);

  const cvHighlights = isEditorial
    ? [
        "Progettazione e impaginazione di brochure, cataloghi, company profile, presentazioni e materiali corporate.",
        "Gestione di layout complessi, gerarchie tipografiche, immagini e adattamenti multiformato fino all'esecutivo finale.",
        "Produzione grafica per ADV, materiali commerciali, comunicazione istituzionale e progetti editoriali.",
        "Gestione autonoma del progetto dal brief alla consegna, con attenzione a coerenza visiva, precisione e scadenze.",
      ]
    : isMotion
      ? [
          "Ideazione e produzione di motion graphics, kinetic typography, reel, video istituzionali e contenuti digitali.",
          "Montaggio e post-produzione video con After Effects e Premiere Pro, dalla struttura narrativa all'output finale.",
          "Sviluppo di visual, campagne ADV e contenuti coordinati per social, web e presentazioni.",
          "Gestione autonoma dal brief alla consegna, collaborando con agenzie, aziende e team multidisciplinari.",
        ]
      : [
          "Sviluppo di progetti di comunicazione visiva per advertising, digital, editoria e materiali corporate.",
          "Produzione di visual, brochure, presentazioni, contenuti social, landing page e materiali multiformato.",
          "Integrazione di graphic design, motion, video e 3D per costruire output coerenti su canali diversi.",
          "Gestione autonoma del progetto dal brief alla consegna esecutiva, nel rispetto di brand guideline e scadenze.",
        ];

  const cvSummary = isEditorial
    ? "Senior Graphic ed Editorial Designer con oltre 20 anni di esperienza nella comunicazione visiva, editoriale, advertising e digital. Specializzato in impaginazione, produzione esecutiva e materiali corporate, con forte autonomia nella gestione del progetto dal brief alla consegna."
    : isMotion
      ? "Senior Graphic Designer, Motion Designer e Video Editor con oltre 20 anni di esperienza nella comunicazione visiva, advertising e digital. Unisco graphic design, motion graphics, montaggio e post-produzione per trasformare brief e contenuti in visual chiari, dinamici e coerenti con il brand."
      : "Senior Graphic Designer con oltre 20 anni di esperienza nella comunicazione visiva, editoriale, advertising e digital. Seguo progetti dal concept alla produzione esecutiva, integrando grafica, motion, video, contenuti digitali e visual 3D con un approccio concreto e orientato alla qualità.";

  const gapLine = job.gaps.length
    ? `Segnalo con trasparenza alcuni requisiti non centrali nel mio workflow attuale (${job.gaps.join(", ")}); il resto del profilo e invece fortemente allineato alla posizione.`
    : "";

  const message = [
    "Buongiorno,",
    "",
    `vi contatto in riferimento alla posizione di ${role}.`,
    "",
    `Sono Antonio Filippone, Senior Graphic Designer, Motion Designer e Video Editor con oltre 20 anni di esperienza nella comunicazione visiva, editoriale, pubblicitaria e digitale. Per questa posizione ritengo particolarmente rilevanti: ${focus}.`,
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
    subject: `Candidatura ${role} - Antonio Filippone`,
    message,
    cv: {
      cvTemplate: job.cvTemplate,
      cvTitle,
      cvSummary,
      cvSkills: cvCore,
      cvHighlights,
      cvClients: [
        "Barilla",
        "Grappa Nonino",
        "La Settimana Enigmistica",
        "Parmalat",
        "Olimpia Milano",
        "Bitmama",
        "Centrale del Latte Milano",
        "Frigosystem",
        "Gruppo Hera",
      ],
      cvSoftware: [
        "Adobe InDesign",
        "Adobe Illustrator",
        "Adobe Photoshop",
        "Adobe After Effects",
        "Adobe Premiere Pro",
        "Adobe Media Encoder",
        "Cinema 4D",
        "WordPress",
      ],
      cvAI: [
        "ChatGPT",
        "Claude",
        "Gemini",
        "Perplexity",
        "Kling",
        "Higgsfield",
        "ElevenLabs",
        "Google Flow",
      ],
      cvLanguages: ["Italiano: madrelingua", "Inglese: intermedio"],
      cvAvailability: [
        "Milano / Brianza",
        "Freelance / P.IVA",
        "Remoto / ibrido / sede",
      ],
    },
  };
}
