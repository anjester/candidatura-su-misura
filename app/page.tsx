"use client";
import { useRef, useState } from "react";
import { CheckCircle2, Clipboard, FileDown, Link2, LoaderCircle, Mail, Play, Send, Sparkles, Upload } from "lucide-react";

type Result={title:string;company:string;score:number;emails:string[];recipient:string;requirements:string[];missing:string[];cvTemplate:string;cvTitle:string;cvSummary:string;cvSkills:string[];letter:string;subject:string;note:string};
type AgentJob={source:string;title:string;company:string;score:number;status:string;band?:"top"|"review";email:string|null;url:string;gaps:string[]};
type AgentResult={ok?:boolean;mode?:string;reanalyze?:boolean;found?:number;unique?:number;candidates?:number;alreadySeen?:number;evaluated?:number;top?:number;review?:number;skipped?:number;sent?:number;message?:string;results?:AgentJob[];error?:string;details?:string};

export default function Home(){
 const [url,setUrl]=useState("");const[pasted,setPasted]=useState("");const[tone,setTone]=useState("diretto");
 const[result,setResult]=useState<Result|null>(null);const[letter,setLetter]=useState("");const[subject,setSubject]=useState("");const[recipient,setRecipient]=useState("");
 const[loading,setLoading]=useState(false);const[sending,setSending]=useState(false);const[error,setError]=useState("");const[status,setStatus]=useState("");const[photo,setPhoto]=useState<string>("");const[withPhoto,setWithPhoto]=useState(false);const fileRef=useRef<HTMLInputElement>(null);
 const[agentLoading,setAgentLoading]=useState(false);const[agentMode,setAgentMode]=useState<"normal"|"reanalyze">("normal");const[agentResult,setAgentResult]=useState<AgentResult|null>(null);
 async function analyze(e:React.FormEvent){e.preventDefault();setLoading(true);setError("");setStatus("");try{const r=await fetch("/api/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url,pasted,tone})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Impossibile analizzare l’annuncio.");setResult(d);setLetter(d.letter);setSubject(d.subject);setRecipient(d.recipient||"")}catch(e){setError(e instanceof Error?e.message:"Errore imprevisto.")}finally{setLoading(false)}}
 function loadPhoto(e:React.ChangeEvent<HTMLInputElement>){const f=e.target.files?.[0];if(!f)return;const reader=new FileReader();reader.onload=()=>{setPhoto(String(reader.result));setWithPhoto(true)};reader.readAsDataURL(f)}
 async function copy(){await navigator.clipboard.writeText(subject+"\n\n"+letter);setStatus("Testo copiato negli appunti.")}
 async function send(){setSending(true);setError("");setStatus("");try{const r=await fetch("/api/send",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({to:recipient,subject,message:letter,cv:result})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Invio non riuscito.");setStatus(`Email inviata a ${recipient}.`)}catch(e){setError(e instanceof Error?e.message:"Invio non riuscito.")}finally{setSending(false)}}
 async function runAgent(reanalyze=false){setAgentLoading(true);setAgentMode(reanalyze?"reanalyze":"normal");setAgentResult(null);setError("");try{const r=await fetch("/api/agent/manual-run",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({reanalyze}),cache:"no-store"});const d=await r.json();setAgentResult(d);if(!r.ok)throw new Error(d.error||"Esecuzione agente non riuscita.")}catch(e){setError(e instanceof Error?e.message:"Esecuzione agente non riuscita.")}finally{setAgentLoading(false)}}
 function printCV(){window.print()}
 return <main className="shell">
  <header><div className="brand"><span className="logo">af.</span><div><strong>Candidatura su misura</strong><small>Antonio Filippone · CV & Application Engine</small></div></div><span className="top-note">ATS · CV · EMAIL</span></header>

  <aside className="profile" style={{marginBottom:18,alignItems:"flex-start"}}>
   <span>AI</span>
   <div style={{width:"100%"}}>
    <strong>Job Agent automatico</strong>
    <p>Ricerca Adzuna + Jooble, deduplica su Supabase e valutazione delle offerte. In modalità <b>review</b> non invia candidature.</p>
    <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:10}}>
     <button type="button" className="primary" onClick={()=>runAgent(false)} disabled={agentLoading} style={{width:"auto",marginTop:0}}>
      {agentLoading&&agentMode==="normal"?<><LoaderCircle size={18} className="spin"/>Eseguo ricerca…</>:<><Play size={18}/>Esegui agente ora</>}
     </button>
     <button type="button" className="secondary" onClick={()=>runAgent(true)} disabled={agentLoading} style={{width:"auto"}}>
      {agentLoading&&agentMode==="reanalyze"?<><LoaderCircle size={18} className="spin"/>Rianalizzo…</>:<>Rianalizza ultimi annunci</>}
     </button>
    </div>
    {agentResult&&<div style={{marginTop:14}}>
      {agentResult.error?<div><p className="error">{agentResult.error}</p>{agentResult.details&&<pre style={{whiteSpace:"pre-wrap",marginTop:8,fontSize:12,lineHeight:1.4}}>{agentResult.details}</pre>}</div>:<>
       <div className="meta">
        <span>Modalità: <b>{agentResult.mode}</b></span>
        <span>Trovati: <b>{agentResult.found ?? 0}</b></span>
        <span>Nuovi candidati: <b>{agentResult.candidates ?? 0}</b></span>
        <span>Già visti: <b>{agentResult.alreadySeen ?? 0}</b></span>
        <span>Analizzati: <b>{agentResult.evaluated ?? 0}</b></span>
        <span>Top: <b>{agentResult.top ?? 0}</b></span>
        <span>Da valutare: <b>{agentResult.review ?? 0}</b></span>
        <span>Scartati: <b>{agentResult.skipped ?? 0}</b></span>
        <span>Inviati: <b>{agentResult.sent ?? 0}</b></span>
       </div>
       {agentResult.message&&<p className="notice" style={{marginTop:10}}>{agentResult.message}</p>}
       {(agentResult.results?.length??0)>0&&<>
        {(agentResult.results?.some(j=>j.band==="top")??false)&&<div style={{marginTop:16}}>
         <strong style={{display:"block",marginBottom:8}}>TOP MATCH</strong>
         <div style={{display:"grid",gap:8}}>
          {agentResult.results!.filter(j=>j.band==="top").slice(0,10).map((j,i)=><div key={`top-${j.source}-${j.url}-${i}`} className="notice" style={{margin:0,borderLeft:"4px solid #d97706"}}>
            <b>{j.score}% · {j.title}</b>{j.company?` — ${j.company}`:""}<br/>
            <span>{j.source} · {j.status}{j.email?` · ${j.email}`:" · email non trovata"}</span><br/>
            <a href={j.url} target="_blank" rel="noreferrer">Apri annuncio</a>
          </div>)}
         </div>
        </div>}
        {(agentResult.results?.some(j=>j.band==="review")??false)&&<div style={{marginTop:16}}>
         <strong style={{display:"block",marginBottom:8}}>DA VALUTARE</strong>
         <div style={{display:"grid",gap:8}}>
          {agentResult.results!.filter(j=>j.band==="review").slice(0,12).map((j,i)=><div key={`review-${j.source}-${j.url}-${i}`} className="notice" style={{margin:0,opacity:.9}}>
            <b>{j.score}% · {j.title}</b>{j.company?` — ${j.company}`:""}<br/>
            <span>{j.source} · {j.status}{j.email?` · ${j.email}`:""}</span><br/>
            <a href={j.url} target="_blank" rel="noreferrer">Apri annuncio</a>
          </div>)}
         </div>
        </div>}
       </>}
      </>}
    </div>}
   </div>
  </aside>

  <div className="workspace">
   <section className="panel input"><span className="eyebrow">01 / ANNUNCIO</span><h1>Un annuncio entra. Una candidatura mirata esce.</h1><p className="intro">Inserisci il link oppure incolla il testo. Il sistema seleziona ciò che è realmente coerente con il tuo profilo e prepara CV, messaggio e destinatario.</p>
    <form onSubmit={analyze}><label>Link dell’annuncio</label><div className="url"><Link2 size={18}/><input type="url" placeholder="https://..." value={url} onChange={e=>setUrl(e.target.value)}/></div><div className="divider">oppure</div><label>Testo dell’annuncio</label><textarea className="ad" value={pasted} onChange={e=>setPasted(e.target.value)} placeholder="Incolla descrizione, requisiti e riferimenti..."/><div className="choices"><div><label>Tono</label><select value={tone} onChange={e=>setTone(e.target.value)}><option value="diretto">Diretto e professionale</option><option value="elegante">Elegante</option><option value="caldo">Personale</option></select></div><div><label>Foto CV</label><button type="button" className="secondary" onClick={()=>fileRef.current?.click()}><Upload size={16}/>{photo?"Cambia foto":"Carica foto"}</button><input ref={fileRef} type="file" accept="image/*" hidden onChange={loadPhoto}/></div></div>
     <button className="primary" disabled={loading||(!url.trim()&&!pasted.trim())}>{loading?<><LoaderCircle size={18} className="spin"/>Analizzo…</>:<><Sparkles size={18}/>Genera candidatura</>}</button>{error&&<p className="error">{error}</p>}{status&&<p className="success">{status}</p>}</form>
    <aside className="profile"><span>AF</span><div><strong>Profilo master</strong><p>Senior Graphic & Motion Designer · Video · 3D · Editorial/DTP. Figma e Blender esclusi. Portfolio: <a href="https://www.antoniofilippone.com" target="_blank">antoniofilippone.com</a></p></div></aside>
   </section>

   <section className="panel output">{!result?<div className="empty"><div className="empty-icon"><Mail size={30}/></div><span className="eyebrow">02 / RISULTATO</span><h2>CV, matching e mail appariranno qui.</h2><p>La candidatura viene costruita solo sulle competenze reali presenti nel profilo.</p></div>:<div className="result"><div className="result-top"><div><span className="eyebrow">02 / MATCHING</span><h2>{result.title}</h2><p className="company">{result.company}</p></div><div className="score"><b>{result.score}%</b><small>match</small></div></div>
    <div className="meta"><span>Template: <b>{result.cvTemplate}</b></span><span>{result.requirements.length} requisiti coperti</span><span>{result.missing.length} gap dichiarati</span></div>
    <div className="tags">{result.requirements.map(v=><span key={v}><CheckCircle2 size={13}/>{v}</span>)}</div>{result.missing.length>0&&<p className="notice">Da non dichiarare come competenza: {result.missing.join(", ")}.</p>}{result.note&&<p className="notice">{result.note}</p>}
    <div className="cv-toolbar"><strong>Anteprima CV</strong><div><label className="switch"><input type="checkbox" checked={withPhoto} onChange={e=>setWithPhoto(e.target.checked)} disabled={!photo}/><span/>Con foto</label><button className="smallbtn" onClick={printCV}><FileDown size={15}/>Salva PDF</button></div></div>
    <article className="cv" id="cv-preview"><aside className="cv-side">{withPhoto&&photo?<img src={photo} className="cv-photo" alt="Antonio Filippone"/>:<div className="cv-monogram">AF</div>}<h4>CONTATTI</h4><p>+39 347 50 29 169<br/>info@antoniofilippone.com<br/>antoniofilippone.com</p><h4>SOFTWARE</h4><p>Adobe InDesign<br/>Illustrator<br/>Photoshop<br/>After Effects<br/>Premiere Pro<br/>Media Encoder<br/>Cinema 4D<br/>WordPress</p><h4>LINGUE</h4><p>Italiano · Madrelingua<br/>Inglese · Intermedio</p></aside><div className="cv-main"><small>CV MIRATO · {result.cvTemplate.toUpperCase()}</small><h3>Antonio Filippone</h3><h5>{result.cvTitle}</h5><p className="summary">{result.cvSummary}</p><h4>COMPETENZE RILEVANTI</h4><ul>{result.cvSkills.map(v=><li key={v}>{v}</li>)}</ul><h4>ESPERIENZA</h4><h6>Graphic Designer & Motion Designer · Freelance <em>dal 2012</em></h6><p>Collaborazioni con aziende nazionali e internazionali, tra cui Barilla, Grappa Nonino, La Settimana Enigmistica, Parmalat, Olimpia Milano, Bitmama, Centrale del Latte Milano, Gruppo Hera e altre realtà.</p><ul><li>Progetti dal brief alla consegna esecutiva.</li><li>ADV, impaginazione, motion graphics, video e visual 3D.</li><li>Revisioni, adattamenti multi-formato e produzione finale.</li></ul><h4>FORMAZIONE</h4><p>Cinema 4D · Espero/Mohole · InDesign · Espero · 3D Studio Max · CFP G. Terragni · Photoshop, After Effects, Premiere, Avid · Officinafilm/Omnijob.</p></div></article>
    <div className="mailbox"><div className="editor-head"><strong>Invio candidatura</strong><span>Controlla sempre prima di inviare</span></div><label>Destinatario</label><input value={recipient} onChange={e=>setRecipient(e.target.value)} placeholder="hr@azienda.it"/><label>Oggetto</label><input value={subject} onChange={e=>setSubject(e.target.value)}/><label>Messaggio</label><textarea value={letter} onChange={e=>setLetter(e.target.value)}/><div className="actions"><button className="secondary" onClick={copy}><Clipboard size={16}/>Copia</button><button className="primary inline" onClick={send} disabled={sending||!recipient}>{sending?<LoaderCircle className="spin" size={17}/>:<Send size={17}/>}Invia da info@antoniofilippone.com</button></div></div>
   </div>}</section>
  </div><footer>ATS-safe: nessuna keyword invisibile, nessuna competenza inventata, nessun elemento oltre la safe area del PDF.</footer>
 </main>
}
