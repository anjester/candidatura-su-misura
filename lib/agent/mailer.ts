import * as tls from "node:tls";

function ascii(s: string) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E]/g, " ");
}

function esc(s: string) {
  return ascii(s)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrap(s: string, max: number) {
  const words = ascii(s).split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let line = "";

  for (const w of words) {
    const n = (line + " " + w).trim();
    if (n.length <= max) {
      line = n;
    } else {
      if (line) out.push(line);
      line = w;
    }
  }

  if (line) out.push(line);
  return out;
}

export function pdfFor(cv: any) {
  const c: string[] = [];

  const t = (
    x: number,
    y: number,
    size: number,
    text: string,
    bold = false,
    color = "0.10 0.16 0.22"
  ) => {
    c.push(
      `${color} rg BT /${bold ? "F2" : "F1"} ${size} Tf ${x} ${y} Td (${esc(text)}) Tj ET`
    );
  };

  const line = (x1: number, y1: number, x2: number, y2: number, color = "0.84 0.86 0.88") => {
    c.push(`${color} RG 0.7 w ${x1} ${y1} m ${x2} ${y2} l S`);
  };

  const bulletBlock = (items: string[], x: number, startY: number, widthChars: number, maxItems: number) => {
    let y = startY;
    for (const item of items.slice(0, maxItems)) {
      const lines = wrap(item, widthChars).slice(0, 3);
      t(x, y, 8.1, "-", true, "0.72 0.45 0.14");
      let first = true;
      for (const l of lines) {
        t(x + 12, y, 8.0, l, false, "0.22 0.29 0.36");
        y -= 12;
        first = false;
      }
      if (!first) y -= 3;
    }
    return y;
  };

  // Left column: intentionally light. No software here.
  c.push("0.08 0.17 0.25 rg 0 0 158 842 re f");

  t(26, 792, 23, "AF", true, "1 1 1");
  t(26, 758, 8.5, "CONTATTI", true, "0.88 0.69 0.38");

  [
    "+39 347 50 29 169",
    "info@antoniofilippone.com",
    "antoniofilippone.com",
    "Milano / Brianza",
  ].forEach((x, i) => t(26, 738 - i * 17, 7.5, x, false, "0.95 0.97 0.99"));

  t(26, 646, 8.5, "FOCUS", true, "0.88 0.69 0.38");
  const leftFocus = [
    "Graphic Design",
    "Motion Design",
    "Video Editing",
    "Editorial Design",
    "Visual 3D",
  ];
  leftFocus.forEach((x, i) => t(26, 626 - i * 17, 7.7, x, false, "0.95 0.97 0.99"));

  t(26, 520, 8.5, "LINGUE", true, "0.88 0.69 0.38");
  (cv.cvLanguages || ["Italiano: madrelingua", "Inglese: intermedio"])
    .slice(0, 3)
    .forEach((x: string, i: number) =>
      t(26, 500 - i * 17, 7.5, x, false, "0.95 0.97 0.99")
    );

  t(26, 438, 8.5, "DISPONIBILITA", true, "0.88 0.69 0.38");
  (cv.cvAvailability || ["Freelance / P.IVA", "Remoto / ibrido / sede"])
    .slice(0, 4)
    .forEach((x: string, i: number) =>
      t(26, 418 - i * 17, 7.5, x, false, "0.95 0.97 0.99")
    );

  // Main column.
  const x = 190;
  const right = 568;

  t(x, 792, 7.6, `CV MIRATO - ${cv.cvTemplate || "ATS CLEAN"}`, true, "0.72 0.45 0.14");
  t(x, 757, 23, "Antonio Filippone", true);
  t(x, 731, 10.8, cv.cvTitle || "Senior Graphic Designer", true, "0.27 0.40 0.52");
  line(x, 714, right, 714);

  t(x, 692, 8.3, "PROFILO", true, "0.72 0.45 0.14");
  let y = 674;

  for (const l of wrap(
    cv.cvSummary ||
      "Senior Graphic Designer con esperienza in comunicazione visiva, editoriale, advertising e digital.",
    76
  ).slice(0, 6)) {
    t(x, y, 8.3, l, false, "0.27 0.34 0.41");
    y -= 12.5;
  }

  y -= 8;
  t(x, y, 8.3, "CORE EXPERTISE", true, "0.72 0.45 0.14");
  y -= 17;

  const skills = (cv.cvSkills || []).slice(0, 10);
  const skillLine1 = skills.slice(0, 5).join(" | ");
  const skillLine2 = skills.slice(5, 10).join(" | ");

  for (const l of wrap(skillLine1, 77).slice(0, 2)) {
    t(x, y, 7.7, l, true, "0.20 0.30 0.39");
    y -= 11.5;
  }
  for (const l of wrap(skillLine2, 77).slice(0, 2)) {
    t(x, y, 7.7, l, true, "0.20 0.30 0.39");
    y -= 11.5;
  }

  y -= 8;
  t(x, y, 8.3, "ESPERIENZA", true, "0.72 0.45 0.14");
  y -= 19;

  t(x, y, 9.2, "Senior Graphic Designer / Motion Designer / Video Editor", true);
  y -= 14;
  t(x, y, 8.0, "Freelance | dal 2012", true, "0.35 0.43 0.50");
  y -= 18;

  y = bulletBlock(
    cv.cvHighlights || [
      "Progetti di comunicazione visiva dal brief alla consegna esecutiva.",
      "ADV, impaginazione, motion graphics, video e visual 3D.",
      "Adattamenti multiformato, revisioni e produzione finale.",
    ],
    x,
    y,
    71,
    4
  );

  y -= 3;
  t(x, y, 8.3, "CLIENTI SELEZIONATI", true, "0.72 0.45 0.14");
  y -= 17;

  const clients = (cv.cvClients || [
    "Barilla",
    "Grappa Nonino",
    "La Settimana Enigmistica",
    "Parmalat",
    "Olimpia Milano",
    "Bitmama",
    "Centrale del Latte Milano",
    "Gruppo Hera",
  ]).join(" | ");

  for (const l of wrap(clients, 76).slice(0, 3)) {
    t(x, y, 7.7, l, false, "0.27 0.34 0.41");
    y -= 11.5;
  }

  y -= 7;
  t(x, y, 8.3, "SOFTWARE & TOOLS", true, "0.72 0.45 0.14");
  y -= 17;

  const software = (cv.cvSoftware || [
    "Adobe InDesign",
    "Adobe Illustrator",
    "Adobe Photoshop",
    "Adobe After Effects",
    "Adobe Premiere Pro",
    "Adobe Media Encoder",
    "Cinema 4D",
    "WordPress",
  ]).join(" | ");

  for (const l of wrap(software, 76).slice(0, 3)) {
    t(x, y, 7.7, l, false, "0.20 0.29 0.38");
    y -= 11.5;
  }

  y -= 6;
  t(x, y, 8.3, "AI & CREATIVE TOOLS", true, "0.72 0.45 0.14");
  y -= 17;

  const ai = (cv.cvAI || [
    "ChatGPT",
    "Claude",
    "Gemini",
    "Perplexity",
    "Kling",
    "Higgsfield",
    "ElevenLabs",
    "Google Flow",
  ]).join(" | ");

  for (const l of wrap(ai, 76).slice(0, 2)) {
    t(x, y, 7.6, l, false, "0.27 0.34 0.41");
    y -= 11.5;
  }

  // Footer/portfolio CTA.
  line(x, 58, right, 58, "0.84 0.86 0.88");
  t(x, 40, 7.3, "Portfolio: www.antoniofilippone.com", true, "0.27 0.40 0.52");

  const stream = c.join("\n");
  const objs: string[] = [];

  objs[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objs[2] = "<< /Type /Pages /Kids [3 0 R] /Count 1 >>";
  objs[3] =
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>";
  objs[4] = `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`;
  objs[5] =
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objs[6] =
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";

  let pdf = "%PDF-1.4\n";
  const offs = [0];

  for (let i = 1; i <= 6; i++) {
    offs[i] = Buffer.byteLength(pdf);
    pdf += `${i} 0 obj\n${objs[i]}\nendobj\n`;
  }

  const xref = Buffer.byteLength(pdf);
  pdf += "xref\n0 7\n0000000000 65535 f \n";

  for (let i = 1; i <= 6; i++) {
    pdf += String(offs[i]).padStart(10, "0") + " 00000 n \n";
  }

  pdf += `trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;

  return Buffer.from(pdf, "binary");
}

function safeHeader(value: string) {
  return ascii(value).replace(/[\r\n]+/g, " ").trim();
}

export async function smtpSend({
  to,
  subject,
  message,
  pdf,
}: {
  to: string;
  subject: string;
  message: string;
  pdf: Buffer;
}) {
  const host = process.env.SMTP_HOST || "smtps.aruba.it";
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER || "";
  const pass = process.env.SMTP_PASSWORD || "";
  const from = process.env.MAIL_FROM || user;

  if (!user || !pass) throw new Error("SMTP non configurato");

  const boundary = "----=_JobAgentAntonio_" + Date.now();

  const body = [
    `From: Antonio Filippone <${safeHeader(from)}>`,
    `To: ${safeHeader(to)}`,
    `Subject: ${safeHeader(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    message,
    "",
    `--${boundary}`,
    'Content-Type: application/pdf; name="Antonio_Filippone_CV.pdf"',
    "Content-Transfer-Encoding: base64",
    'Content-Disposition: attachment; filename="Antonio_Filippone_CV.pdf"',
    "",
    pdf.toString("base64").replace(/(.{76})/g, "$1\r\n"),
    "",
    `--${boundary}--`,
    "",
  ].join("\r\n");

  await new Promise<void>((resolve, reject) => {
    const socket = tls.connect({ host, port, servername: host });
    let buf = "";

    const wait = (code: number) =>
      new Promise<void>((res, rej) => {
        const started = Date.now();

        const poll = () => {
          if (new RegExp(`^${code} `, "m").test(buf)) {
            buf = "";
            return res();
          }

          if (Date.now() - started > 15000) {
            return rej(new Error("Timeout SMTP"));
          }

          setTimeout(poll, 20);
        };

        poll();
      });

    socket.setEncoding("utf8");
    socket.on("data", (d) => (buf += d));
    socket.on("error", reject);

    (async () => {
      try {
        await wait(220);
        socket.write("EHLO antoniofilippone.com\r\n");
        await wait(250);

        socket.write("AUTH LOGIN\r\n");
        await wait(334);

        socket.write(Buffer.from(user).toString("base64") + "\r\n");
        await wait(334);

        socket.write(Buffer.from(pass).toString("base64") + "\r\n");
        await wait(235);

        socket.write(`MAIL FROM:<${from}>\r\n`);
        await wait(250);

        socket.write(`RCPT TO:<${to}>\r\n`);
        await wait(250);

        socket.write("DATA\r\n");
        await wait(354);

        socket.write(body.replace(/\r\n\./g, "\r\n..") + "\r\n.\r\n");
        await wait(250);

        socket.write("QUIT\r\n");
        socket.end();
        resolve();
      } catch (e) {
        socket.destroy();
        reject(e);
      }
    })();
  });
}
