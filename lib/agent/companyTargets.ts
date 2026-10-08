export type CompanyTarget = {
  name: string;
  website: string;
  category:
    | "editoria"
    | "agenzia"
    | "design"
    | "produzione"
    | "fashion"
    | "corporate"
    | "stampa";
};

export const COMPANY_TARGETS: CompanyTarget[] = [
  { name: "Mondadori Group", website: "https://www.mondadorigroup.com", category: "editoria" },
  { name: "RCS MediaGroup", website: "https://www.rcsmediagroup.it", category: "editoria" },
  { name: "Cairo Communication", website: "https://www.cairocommunication.it", category: "editoria" },
  { name: "Editoriale Domus", website: "https://www.edidomus.it", category: "editoria" },
  { name: "Hearst Italia", website: "https://www.hearst.it", category: "editoria" },
  { name: "De Agostini", website: "https://www.deagostini.com", category: "editoria" },

  { name: "Publicis Groupe", website: "https://www.publicisgroupe.com", category: "agenzia" },
  { name: "Dentsu", website: "https://www.dentsu.com", category: "agenzia" },
  { name: "Havas", website: "https://www.havas.com", category: "agenzia" },
  { name: "Ogilvy", website: "https://www.ogilvy.com", category: "agenzia" },
  { name: "TBWA", website: "https://www.tbwa.it", category: "agenzia" },
  { name: "JAKALA", website: "https://www.jakala.com", category: "agenzia" },
  { name: "Alkemy", website: "https://www.alkemy.com", category: "agenzia" },
  { name: "Caffeina", website: "https://caffeina.com", category: "agenzia" },

  { name: "Flos", website: "https://flos.com", category: "design" },
  { name: "Artemide", website: "https://www.artemide.com", category: "design" },
  { name: "Kartell", website: "https://www.kartell.com", category: "design" },
  { name: "Poliform", website: "https://www.poliform.it", category: "design" },
  { name: "Molteni&C", website: "https://www.molteni.it", category: "design" },
  { name: "Cassina", website: "https://www.cassina.com", category: "design" },

  { name: "Mantero", website: "https://www.mantero.com", category: "fashion" },
  { name: "Fedrigoni", website: "https://fedrigoni.com", category: "stampa" },
  { name: "Rotolito", website: "https://www.rotolito.com", category: "stampa" },

  { name: "Sky Italia", website: "https://www.sky.it", category: "produzione" },
  { name: "Mediaset", website: "https://www.mediaset.it", category: "produzione" },
  { name: "Technogym", website: "https://www.technogym.com", category: "corporate" },
];

export function getExtraCompanyTargets(): CompanyTarget[] {
  const raw = process.env.COMPANY_EXTRA_TARGETS?.trim();
  if (!raw) return [];

  const out: CompanyTarget[] = [];

  for (const rawEntry of raw.split(";")) {
    const entry = rawEntry.trim();
    if (!entry) continue;

    const [rawName, rawWebsite] = entry.split("|");
    const name = rawName?.trim();
    const website = rawWebsite?.trim();

    if (!name || !website) continue;
    if (!/^https?:\/\//i.test(website)) continue;

    out.push({
      name,
      website,
      category: "corporate",
    });
  }

  return out;
}
