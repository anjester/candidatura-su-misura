import * as tls from "node:tls";
import { readFileSync } from "node:fs";
import { join } from "node:path";

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

export function pdfFor(_cv: any) {
  const cvPath = join(process.cwd(), "public", "CV_Antonio_Filippone.pdf");
  return readFileSync(cvPath);
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


export async function smtpNotify({
  to,
  subject,
  message,
}: {
  to: string;
  subject: string;
  message: string;
}) {
  const host = process.env.SMTP_HOST || "smtps.aruba.it";
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER || "";
  const pass = process.env.SMTP_PASSWORD || "";
  const from = process.env.MAIL_FROM || user;

  if (!user || !pass) throw new Error("SMTP non configurato");

  const body = [
    `From: Antonio Filippone Job Agent <${safeHeader(from)}>`,
    `To: ${safeHeader(to)}`,
    `Subject: ${safeHeader(subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    message,
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
