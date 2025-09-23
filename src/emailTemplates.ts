// src/emailTemplates.ts
import { VoucherData } from './types'
import { CLP } from './utils'

export function correoReservaHTML(snap: VoucherData){
  const a = snap.pasajeros.filter(p=>p.categoria==='adulto').length
  const n = snap.pasajeros.filter(p=>p.categoria==='nino').length
  const i = snap.pasajeros.filter(p=>p.categoria==='infante').length
  const primer = snap.pasajeros[0]
  const servicioCM = snap.promoTipo === 'FM' ? 'Full Mármol'
                    : snap.promoTipo === 'CM' ? 'Capillas de Mármol'
                    : 'No incluye'

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="x-apple-disable-message-reformatting">
    <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
    <title>Reserva ${snap.codigo}</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f7f9;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px;">
      <tr><td align="center">
        <table role="presentation" width="100%" style="max-width:640px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
          <tr>
            <td style="padding:20px 24px;background:#0c3946;color:#fff">
              <div style="font-size:18px;font-weight:700">Valle Glaciares · Confirmación de Reserva</div>
              <div style="opacity:.9;font-size:13px;margin-top:2px">Código: <b>${snap.codigo}</b></div>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 24px">
              <p style="margin:0 0 12px 0">Hola ${primer?.nombre?.split(/\s+/)[0] ?? 'Cliente'},</p>
              <p style="margin:0 0 16px 0">Tu reserva ha sido ingresada exitosamente. Aquí va el resumen:</p>

              <h3 style="margin:20px 0 8px 0;font-size:16px">Laguna San Rafael</h3>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">
                <tr><td>Fecha LSR</td><td align="right"><b>${snap.fechaLSR || '—'}</b></td></tr>
                <tr><td>Adultos</td><td align="right">${a}</td></tr>
                <tr><td>Niños (4–12)</td><td align="right">${n}</td></tr>
                <tr><td>Menores &lt; 4</td><td align="right">${i}</td></tr>
                <tr><td style="padding-top:8px">Sub Total LSR (incluye transporte)</td><td align="right" style="padding-top:8px"><b>${CLP(snap.totalLSR)}</b></td></tr>
                <tr><td>Descuentos LSR</td><td align="right">−${CLP(snap.lsrDcto)}</td></tr>
              </table>

              <h3 style="margin:20px 0 8px 0;font-size:16px">Capillas de Mármol</h3>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">
                <tr><td>Servicio</td><td align="right"><b>${servicioCM}</b></td></tr>
                <tr><td>Sub Total Capillas</td><td align="right">${CLP(snap.promoSubtotal)}</td></tr>
                <tr><td>Descuentos Capillas</td><td align="right">−${CLP(snap.promoDcto)}</td></tr>
                <tr><td>Total Capillas</td><td align="right"><b>${CLP(snap.totalPromo)}</b></td></tr>
              </table>

              <h3 style="margin:20px 0 8px 0;font-size:16px">Totales</h3>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">
                <tr><td>Total Cotización</td><td align="right"><b>${CLP(snap.totalCotizacion)}</b></td></tr>
                <tr><td>Total Abonado</td><td align="right">${CLP(snap.pagado)}</td></tr>
                <tr><td>Saldo Pendiente</td><td align="right"><b>${CLP(snap.saldo)}</b></td></tr>
              </table>

              <h3 style="margin:20px 0 8px 0;font-size:16px">Contacto</h3>
              <div style="font-size:14px;line-height:1.5">
                ${primer?.nombre ?? '—'}<br/>
                ${primer?.email ?? '—'}
              </div>

              ${snap.observaciones ? `<div style="margin-top:16px;padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:13px"><b>Observaciones:</b><br/>${snap.observaciones}</div>` : ''}
            </td>
          </tr>
          <tr>
            <td style="padding:14px 24px;background:#f8fafc;font-size:12px;color:#475569">
              notificaciones@valleglaciares.com · Puerto Río Tranquilo · Patagonia
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`
}
