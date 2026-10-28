import nodemailer from "nodemailer";
import { Resend } from "resend";

/**
 * Envío de emails con proveedor configurable (EMAIL_PROVIDER):
 * - "console": imprime el mail en el log (desarrollo)
 * - "smtp": nodemailer con SMTP_*
 * - "resend": API de Resend con RESEND_API_KEY
 */

export interface Email {
  para: string;
  asunto: string;
  html: string;
  texto: string;
  /** URL de baja para el header List-Unsubscribe. */
  urlBaja?: string;
}

export interface EmailEnviado {
  proveedor: string;
  id?: string;
}

/** Últimos mails "enviados" con el proveedor console (lo usa el test e2e). */
export const bandejaConsola: Email[] = [];

function remitente() {
  return process.env.EMAIL_FROM || "PixelPeso <alertas@example.com>";
}

function headers(e: Email): Record<string, string> {
  return e.urlBaja
    ? { "List-Unsubscribe": `<${e.urlBaja}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
    : {};
}

export async function enviarEmail(e: Email): Promise<EmailEnviado> {
  const proveedor = (process.env.EMAIL_PROVIDER || "console").toLowerCase();
  if (proveedor === "smtp") {
    const transporte = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
    const r = await transporte.sendMail({
      from: remitente(),
      to: e.para,
      subject: e.asunto,
      html: e.html,
      text: e.texto,
      headers: headers(e),
    });
    return { proveedor, id: r.messageId };
  }
  if (proveedor === "resend") {
    if (!process.env.RESEND_API_KEY) throw new Error("Falta RESEND_API_KEY");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const r = await resend.emails.send({
      from: remitente(),
      to: e.para,
      subject: e.asunto,
      html: e.html,
      text: e.texto,
      headers: headers(e),
    });
    if (r.error) throw new Error(`Resend: ${r.error.message}`);
    return { proveedor, id: r.data?.id };
  }
  bandejaConsola.push(e);
  if (bandejaConsola.length > 50) bandejaConsola.shift();
  console.log(`[email:console] Para: ${e.para}\nAsunto: ${e.asunto}\n${e.texto}\n`);
  return { proveedor: "console" };
}
