import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

type Skill = { key:string; label:string; pattern:RegExp; weight:number; cv:string };
const skills: Skill[] = [
  {key:"indesign",label:"Adobe InDesign",pattern:/indesign|impaginazione|editorial|catalog|brochure|manualistica|desktop publishing|\bdtp\b/i,weight:9,cv:"Adobe InDesign e impaginazione editoriale/corporate"},
  {key:"ae",label:"After Effects",pattern:/after effects|motion graphic|motion design|composit/i,weight:10,cv:"Adobe After Effects, motion graphics e compositing"},
  {key:"premiere",label:"Premiere Pro",pattern:/premiere|video edit|montaggio video|post-production|post produzione/i,weight:8,cv:"Premiere Pro e video post-production"},
  {key:"photoshop",label:"Photoshop",pattern:/photoshop|photo editing|ritocco/i,weight:7,cv:"Adobe Photoshop"},
  {key:"illustrator",label:"Illustrator",pattern:/illustrator|vector|vettorial/i,weight:7,cv:"Adobe Illustrator"},
  {key:"3d",label:"3D / Cinema 4D",pattern:/cinema 4d|\bc4d\b|\b3d\b|render|modellazione/i,weight:7,cv:"Cinema 4D, modellazione e rendering 3D"},
  {key:"adv",label:"ADV / campagne",pattern:/advertising|\badv\b|campagn|campaign|key visual|adaptation|adattament/i,weight:6,cv:"campagne ADV e adattamenti multi-formato"},
  {key:"social",label:"Social content",pattern:/social media|social content|instagram|tiktok|youtube|linkedin/i,weight:5,cv:"contenuti visual e motion per social media"},
  {key:"wordpress",label:"WordPress",pattern:/wordpress|elementor|landing page|web content/i,weight:4,cv:"WordPress, landing page e asset web"},
  {key:"mediaencoder",label:"Media Encoder / output",pattern:/media encoder|codec|render|output format|video output|image sequence/i,weight:6,cv:"render, formati di output e Media Encoder"},
];

const knownGaps = [
  {label:"Toon Boom Harmony",pattern:/toon boom|harmony/i},
  {label:"Figma",pattern:/\bfigma\b/i},
  {label:"Blender",pattern:/\bblender\b/i},
];

function decode(s:string){return s.replace(/&nbsp;|&#160;/gi," ").replace(/&amp;/gi,"&").replace(/&lt;/gi,"<").replace(/&gt;/gi,">").replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)))}
function clean(html:string){return decode(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ").replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi," ").replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi," ").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim()).slice(0,40000)}
function titleFrom(html:string){const og=html.match(/<meta\s+[^>]*property=["']og:title["'][^>]*content=["']([^"']+)/i)?.[1];const title=og||html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||"";return decode(title.replace(/<[^>]+>/g,"").trim()).slice(0,150)}
function isPublicUrl(raw:string){try{const u=new URL(raw);const h=u.hostname.toLowerCase();return ["https:","http:"].includes(u.protocol)&&!u.username&&!u.password&&!h.endsWith(".local")&&h!=="localhost"&&!h.endsWith(".localhost")&&!/^\d+\.\d+\.\d+\.\d+$/.test(h)&&!h.includes(":")&&h.includes(".")}catch{return false}}
async function readPage(raw:string){let current=raw;for(let i=0;i<3;i++){if(!isPublicUrl(current))throw new Error("Inserisci un URL pubblico valido.");const r=await fetch(current,{redirect:"manual",headers:{"User-Agent":"Mozilla/5.0 (compatible; CandidaturaSuMisura/2.0)","Accept":"text/html"},signal:AbortSignal.timeout(9000)});if([301,302,303,307,308].includes(r.status)){current=new URL(r.headers.get("location")||"",current).href;continue}if(!r.ok)throw new Error("Il sito non consente la lettura automatica. Incolla il testo dell’annuncio.");if(!(r.headers.get("content-type")||"").includes("text/html"))throw new Error("Il link non contiene una pagina HTML. Incolla il testo dell’annuncio.");const html=(await r.text()).slice(0,300000);return {text:clean(html),title:titleFrom(html),host:new URL(current).hostname.replace(/^www\./,"")}}throw new Error("Troppi reindirizzamenti. Incolla il testo dell’annuncio.")}
function findEmails(text:string){return [...new Set((text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)||[]).map(e=>e.toLowerCase()))].filter(e=>!e.includes("example.com")).slice(0,5)}
function roleFrom(text:string,title:string){const candidates=[
  /(?:looking for|seeking|cerchiamo|ricerchiamo|position[:\s-]+|ruolo[:\s-]+)(?:an?\s+|un[ao]?\s+)?([^.!\n]{4,70})/i,
  /(senior\s+graphic designer|motion designer|2d composit(?:or|ing)|video editor|editorial designer|dtp specialist|impaginatore|grafico editoriale|visual designer|content designer)/i
];for(const r of candidates){const m=(title+" "+text).match(r);if(m?.[1])return m[1].replace(/\s+/g," ").trim().slice(0,80)}return title && title.length<100?title:"Posizione creativa"}
function companyFrom(text:string,host:string){const m=text.match(/(?:company|azienda|società|studio|agency)[:\s-]+([A-Z][A-Za-z0-9&' .-]{2,55})/);return (m?.[1]?.trim()||host||"Azienda dell’annuncio").replace(/\s+/g," ").slice(0,70)}

export async function POST(request:NextRequest){try{
  const body=await request.json();const url=String(body.url||"").trim();const pasted=String(body.pasted||"").trim().slice(0,40000);
  if(!url&&!pasted)return NextResponse.json({error:"Inserisci un link o il testo dell’annuncio."},{status:400});
  if(url&&!isPublicUrl(url))return NextResponse.json({error:"Inserisci un URL pubblico valido."},{status:400});
  let page={text:"",title:"",host:""};let note="";
  if(url){try{page=await readPage(url)}catch(e){if(!pasted)throw e;note="La pagina non era leggibile automaticamente: ho usato il testo incollato."}}
  const text=(pasted||page.text).replace(/\s+/g," "); if(text.length<100)throw new Error("Il testo trovato è troppo breve. Incolla la descrizione completa dell’annuncio.");
  const title=roleFrom(text,page.title); const company=companyFrom(text,page.host);
  const required=skills.filter(s=>s.pattern.test(text)); const gaps=knownGaps.filter(s=>s.pattern.test(text)).map(s=>s.label);
  const totalPossible=Math.max(30,required.reduce((a,s)=>a+s.weight,0)+(gaps.length*8));
  const earned=required.reduce((a,s)=>a+s.weight,0); const score=Math.max(35,Math.min(96,Math.round((earned/totalPossible)*100)+(required.length>=4?20:10)));
  const top=required.sort((a,b)=>b.weight-a.weight).slice(0,8);
  const isEditorial=/editorial|impagin|indesign|catalog|manualistica|dtp|publishing|editrice|editoria/i.test(text) && !/motion|after effects|video|composit/i.test(text);
  const isMotion=/motion|after effects|video|composit|post-production|animation|animazione/i.test(text);
  const cvTemplate=isEditorial?"Editorial / DTP":(isMotion?"Motion / Video":"ATS Clean");
  const cvTitle=isEditorial?"Senior Editorial Designer · DTP · InDesign":isMotion?"Senior Motion Designer · Video & Compositing":"Senior Graphic Designer · Visual Communication";
  const focus=top.map(s=>s.cv);
  const tone=String(body.tone||"diretto"); const formal=tone==="elegante"; const warm=tone==="caldo";
  const intro=formal?"Gentile team di selezione,":warm?"Buongiorno,":"Buongiorno,";
  const opener=`vi contatto in riferimento alla posizione di ${title}.`;
  const paragraph=`Sono Antonio Filippone, Senior Graphic & Motion Designer con oltre 20 anni di esperienza nella comunicazione visiva, editoriale, pubblicitaria e digitale. Per questa posizione ritengo particolarmente rilevanti ${focus.slice(0,5).join(", ") || "la mia esperienza trasversale in grafica e produzione di contenuti"}.`;
  const honestGap=gaps.length?`Segnalo con trasparenza che ${gaps.join(" e ")} ${gaps.length>1?"non fanno":"non fa"} parte del mio workflow principale; sono però abituato ad adattarmi rapidamente a pipeline e strumenti di produzione differenti.`:"";
  const closing="Allego un CV mirato alla posizione e il mio portfolio. Sarei lieto di approfondire in un colloquio come potrei contribuire ai vostri progetti.";
  const letter=[intro,"",opener,"",paragraph,honestGap?"\n"+honestGap:"","",closing,"","Portfolio: https://www.antoniofilippone.com","","Cordiali saluti,","Antonio Filippone","info@antoniofilippone.com","+39 347 50 29 169"].filter(Boolean).join("\n");
  const emails=findEmails(text);
  return NextResponse.json({
    title,company,score,emails,recipient:emails[0]||"",requirements:top.map(s=>s.label),missing:gaps,
    cvTemplate,cvTitle,cvSummary:`Senior Graphic & Motion Designer con oltre 20 anni di esperienza. Profilo orientato a ${focus.slice(0,4).join(", ") || "grafica, motion, video e produzione esecutiva"}, con gestione autonoma dal brief alla consegna.`,
    cvSkills:focus.slice(0,7),
    letter,subject:`Candidatura ${title} – Antonio Filippone`,note:note||(!required.length?"Matching limitato: verifica che il testo dell’annuncio sia completo.":""),
    sourceText:text.slice(0,1000)
  });
}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Impossibile elaborare l’annuncio."},{status:400})}}
