import type { EvaluatedJob } from "./types";

const table = "job_applications";

function cfg() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return { url: url.replace(/\/rest\/v1\/?$/i, "").replace(/\/+$/, ""), key };
}
export function storeConfigured(){ return !!cfg(); }

function headers(key:string):Record<string,string>{
  return key.startsWith("sb_secret_") ? {apikey:key} : {apikey:key,Authorization:`Bearer ${key}`};
}
async function supabaseError(prefix:string,response:Response){
  let body=""; try{body=await response.text();}catch{}
  throw new Error(`${prefix} ${response.status} ${response.statusText}${body?` — ${body.slice(0,1200)}`:""}`);
}
function normalize(value:unknown){
  return String(value??"").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ");
}

export async function alreadySeen(source:string,sourceId:string){
  const c=cfg(); if(!c) throw new Error("Supabase non configurato.");
  const u=new URL(`${c.url}/rest/v1/${table}`);
  u.searchParams.set("select","id,status"); u.searchParams.set("source",`eq.${source}`);
  u.searchParams.set("source_id",`eq.${sourceId}`); u.searchParams.set("limit","1");
  const r=await fetch(u.toString(),{headers:{...headers(c.key),Accept:"application/json"},cache:"no-store"});
  if(!r.ok) await supabaseError("Supabase check failed",r);
  const rows=await r.json(); return Array.isArray(rows)&&rows.length>0;
}

export async function alreadySeenEquivalent(title?:string,company?:string,location?:string){
  const c=cfg(); if(!c) throw new Error("Supabase non configurato.");
  const nt=normalize(title), nc=normalize(company), nl=normalize(location);
  if(!nt||!nc) return false;
  const u=new URL(`${c.url}/rest/v1/${table}`);
  u.searchParams.set("select","id,title,company,location,status");
  u.searchParams.set("company",`ilike.${nc}`); u.searchParams.set("limit","25");
  const r=await fetch(u.toString(),{headers:{...headers(c.key),Accept:"application/json"},cache:"no-store"});
  if(!r.ok) await supabaseError("Supabase equivalent check failed",r);
  const rows=await r.json(); if(!Array.isArray(rows)) return false;
  return rows.some((row:any)=>{
    const sameTitle=normalize(row.title)===nt, sameCompany=normalize(row.company)===nc;
    const rl=normalize(row.location);
    return sameTitle&&sameCompany&&(!nl||!rl||rl===nl);
  });
}

export async function saveJob(job:EvaluatedJob,status:string,recipient?:string,notes?:string){
  const c=cfg(); if(!c) throw new Error("Supabase non configurato.");
  const r=await fetch(`${c.url}/rest/v1/${table}`,{
    method:"POST",
    headers:{...headers(c.key),"Content-Type":"application/json",Accept:"application/json",Prefer:"return=minimal"},
    body:JSON.stringify({
      source:job.source, source_id:job.sourceId, title:job.title, company:job.company,
      location:job.location, url:job.url, score:job.score, status,
      recipient:recipient||null, notes:notes||null,
    }),
  });
  if(!r.ok&&r.status!==409) await supabaseError("Supabase insert failed",r);
}
