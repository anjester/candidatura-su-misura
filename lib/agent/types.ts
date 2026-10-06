export type JobSource = "adzuna" | "jooble";

export type Job = {
  source: JobSource;
  sourceId: string;
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  createdAt?: string;
  salary?: string;
};

export type EvaluatedJob = Job & {
  score: number;
  reasons: string[];
  gaps: string[];
  email?: string;
  cvTemplate: "Motion / Video" | "Editorial / DTP" | "ATS Clean";
};
