// api/send-email.ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import nodemailer from 'nodemailer'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Method Not Allowed' })
    }

    const { to, subject, html, cc, bcc } = req.body || {}
    if (!to || !subject || !html) {
      return res.status(400).json({ ok: false, error: 'Faltan campos: to, subject, html' })
    }

    // SMTP (Google Workspace). Requiere APP PASSWORD en la cuenta notificaciones@valleglaciares.com
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT || 465),
      secure: true,
      auth: {
        user: process.env.SMTP_USER,  // notificaciones@valleglaciares.com
        pass: process.env.SMTP_PASS   // app password (16 caracteres, generado en Google)
      }
    })

    const from = process.env.SMTP_FROM || 'notificaciones@valleglaciares.com'
    const replyTo = process.env.SMTP_REPLYTO || from

    await transporter.sendMail({
      from,
      to,
      cc,
      bcc,
      subject,
      html,
      replyTo,
    })

    return res.status(200).json({ ok: true })
  } catch (e: any) {
    console.error('send-email error', e)
    return res.status(500).json({ ok: false, error: String(e?.message || e) })
  }
}
