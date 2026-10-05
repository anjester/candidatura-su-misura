import { NextRequest, NextResponse } from "next/server";
import * as tls from "node:tls";

export const runtime = "nodejs";

function ascii(s:string){return s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^\x20-\x7E]/g," ")}
function esc(s:string){return ascii(s).replace(/\\/g,"\\\\").replace(/\(/g,"\\(").replace(/\)/g,"\\)")}
function wrap(s:string,max:number){const words=ascii(s).split(/\s+/);const out:string[]=[];let line="";for(const w of words){const n=(line+" "+w).trim();if(n.length<=max)line=n;else{if(line)out.push(line);line=w}}if(line)out.push(line);return out}
function pdfFor(cv:any){
 const c:string[]=[]; const t=(x:number,y:number,size:number,text:string,bold=false,color="0.12 0.20 0.29")=>{c.push(`${color} rg BT /${bold?"F2":"F1"} ${size} Tf ${x} ${y} Td (${esc(text)}) Tj ET`)};
 c.push("0.09 0.20 0.31 rg 0 0 170 842 re f");
 t(28,790,22,"AF",true,"1 1 1"); t(28,748,8,"CONTATTI",true,"0.86 0.66 0.35");
 ["+39 347 50 29 169","info@antoniofilippone.com","antoniofilippone.com"].forEach((x,i)=>t(28,728-i*16,7.5,x,false,"0.94 0.96 0.98"));
 t(28,660,8,"SOFTWARE",true,"0.86 0.66 0.35");["Adobe InDesign","Adobe Illustrator","Adobe Photoshop","Adobe After Effects","Adobe Premiere Pro","Adobe Media Encoder","Cinema 4D","WordPress"].forEach((x,i)=>t(28,640-i*16,7.5,x,false,"0.94 0.96 0.98"));
 t(205,790,8,`CV MIRATO - ${cv.cvTemplate||"ATS CLEAN"}`,true,"0.72 0.45 0.14");t(205,756,24,"Antonio Filippone",true);t(205,731,11,cv.cvTitle||"Senior Graphic Designer",true,"0.27 0.40 0.52");
 let y=698;for(const l of wrap(cv.cvSummary||"Senior Graphic & Motion Designer con esperienza in comunicazione visiva, editoriale, pubblicitaria e digitale.",76).slice(0,5)){t(205,y,8.5,l,false,"0.34 0.42 0.50");y-=13}
 y-=16;t(205,y,8,"COMPETENZE RILEVANTI",true,"0.72 0.45 0.14");y-=20;for(const s of (cv.cvSkills||[]).slice(0,7)){for(const l of wrap("- "+s,72).slice(0,2)){t(215,y,8.2,l);y-=13}}
 y-=10;t(205,y,8,"ESPERIENZA",true,"0.72 0.45 0.14");y-=20;t(205,y,9,"Graphic Designer & Motion Designer - Freelance | dal 2012",true);y-=17;
 const exp="Collaborazioni con aziende nazionali e internazionali tra cui Barilla, Grappa Nonino, La Settimana Enigmistica, Parmalat, Olimpia Milano, Bitmama, Centrale del Latte Milano e Gruppo Hera.";for(const l of wrap(exp,76).slice(0,4)){t(205,y,8,l,false,"0.34 0.42 0.50");y-=13}
 y-=6;["Progetti dal brief alla consegna esecutiva.","ADV, impaginazione, motion graphics, video e visual 3D.","Revisioni, adattamenti multi-formato e produzione finale."].forEach(s=>{t(215,y,8,"- "+s);y-=15});
 y-=10;t(205,y,8,"FORMAZIONE",true,"0.72 0.45 0.14");y-=18;for(const l of wrap("Cinema 4D - Espero/Mohole; InDesign - Espero; 3D Studio Max - CFP G. Terragni; Photoshop, After Effects, Premiere, Avid - Officinafilm/Omnijob.",76).slice(0,4)){t(205,y,8,l,false,"0.34 0.42 0.50");y-=13}
 const stream=c.join("\n"); const objs:string[]=[];
 objs[1]="<< /Type /Catalog /Pages 2 0 R >>";objs[2]="<< /Type /Pages /Kids [3 0 R] /Count 1 >>";objs[3]="<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>";objs[4]=`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`;objs[5]="<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";objs[6]="<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
 let pdf="%PDF-1.4\n";const offs=[0];for(let i=1;i<=6;i++){offs[i]=Buffer.byteLength(pdf);pdf+=`${i} 0 obj\n${objs[i]}\nendobj\n`}const xref=Buffer.byteLength(pdf);pdf+="xref\n0 7\n0000000000 65535 f \n";for(let i=1;i<=6;i++)pdf+=String(offs[i]).padStart(10,"0")+" 00000 n \n";pdf+=`trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;return Buffer.from(pdf,"binary")
}

async function smtpSend({to,subject,message,pdf}: {to:string;subject:string;message:string;pdf:Buffer}){
 const host=process.env.SMTP_HOST||"smtps.aruba.it", port=Number(process.env.SMTP_PORT||465), user=process.env.SMTP_USER||"", pass=process.env.SMTP_PASSWORD||"", from=process.env.MAIL_FROM||user;
 if(!user||!pass)throw new Error("SMTP non configurato. Inserisci SMTP_USER e SMTP_PASSWORD nelle variabili ambiente.");
 const boundary="----=_CandidaturaAntonio_"+Date.now();
 const body=[`From: Antonio Filippone <${from}>`,`To: ${to}`,`Subject: ${subject}`,"MIME-Version: 1.0",`Content-Type: multipart/mixed; boundary=\"${boundary}\"`,"",`--${boundary}`,"Content-Type: text/plain; charset=UTF-8","Content-Transfer-Encoding: 8bit","",message,"",`--${boundary}`,"Content-Type: application/pdf; name=\"Antonio_Filippone_CV.pdf\"","Content-Transfer-Encoding: base64","Content-Disposition: attachment; filename=\"Antonio_Filippone_CV.pdf\"","",pdf.toString("base64").replace(/(.{76})/g,"$1\r\n"),"",`--${boundary}--`,""].join("\r\n");
 await new Promise<void>((resolve,reject)=>{const socket=tls.connect({host,port,servername:host},()=>{});let buf="";const wait=(code:number)=>new Promise<string>((res,rej)=>{const check=()=>{const lines=buf.split(/\r?\n/);let idx=lines.findIndex(l=>new RegExp(`^${code} `).test(l));if(idx>=0){const s=buf;buf="";res(s)}else setTimeout(check,10)};check();setTimeout(()=>rej(new Error("Timeout SMTP")),12000)});socket.setEncoding("utf8");socket.on("data",d=>buf+=d);socket.on("error",reject);(async()=>{try{await wait(220);socket.write(`EHLO antoniofilippone.com\r\n`);await wait(250);socket.write("AUTH LOGIN\r\n");await wait(334);socket.write(Buffer.from(user).toString("base64")+"\r\n");await wait(334);socket.write(Buffer.from(pass).toString("base64")+"\r\n");await wait(235);socket.write(`MAIL FROM:<${from}>\r\n`);await wait(250);socket.write(`RCPT TO:<${to}>\r\n`);await wait(250);socket.write("DATA\r\n");await wait(354);socket.write(body.replace(/\r\n\./g,"\r\n..")+"\r\n.\r\n");await wait(250);socket.write("QUIT\r\n");socket.end();resolve()}catch(e){socket.destroy();reject(e)}})()})
}

export async function POST(req:NextRequest){try{const {to,subject,message,cv}=await req.json();if(!to||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(to)))return NextResponse.json({error:"Inserisci un destinatario email valido."},{status:400});const pdf=pdfFor(cv||{});await smtpSend({to:String(to),subject:String(subject||"Candidatura - Antonio Filippone"),message:String(message||""),pdf});return NextResponse.json({ok:true})}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Invio non riuscito."},{status:500})}}
