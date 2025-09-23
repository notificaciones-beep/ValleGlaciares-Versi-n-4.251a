// src/emailTemplates.ts
import { VoucherData } from './types'
import { CLP } from './utils'

// Fecha "12 de diciembre de 2025" (robusta para YYYY-MM-DD)
function fechaLarga(fecha?: string){
  if(!fecha) return '—'
  // Parseo seguro para ISO simple (YYYY-MM-DD) en UTC, evitando desfases por tz
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha)
  const d = m ? new Date(Date.UTC(+m[1], +m[2]-1, +m[3])) : new Date(fecha)
  if (isNaN(d.getTime())) return fecha
  return new Intl.DateTimeFormat('es-CL', { day:'numeric', month:'long', year:'numeric', timeZone:'UTC' }).format(d)
}

export function correoReservaHTML(snap: VoucherData){
  const a = snap.pasajeros.filter(p=>p.categoria==='adulto').length
  const n = snap.pasajeros.filter(p=>p.categoria==='nino').length
  const i = snap.pasajeros.filter(p=>p.categoria==='infante').length
  const primer = snap.pasajeros[0]
  const servicioCM = snap.promoTipo === 'FM' ? 'Full Mármol'
                    : snap.promoTipo === 'CM' ? 'Capillas de Mármol'
                    : 'No incluye'
  const transporteIncluido = Number(snap.transporte || 0) > 0 ? 'Incluido' : 'No Incluido'

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="x-apple-disable-message-reformatting">
    <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
    <title>Reserva ${snap.codigo}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f6f8;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px;">
      <tr><td align="center">
        <table role="presentation" width="100%" style="max-width:720px;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden">
          <!-- Header -->
          <tr>
            <td style="padding:22px 26px;background:#0c3946;color:#ffffff">
              <div style="font-size:18px;font-weight:800;letter-spacing:.2px">Valle Glaciares · Confirmación de Reserva</div>
              <div style="opacity:.95;font-size:13px;margin-top:4px">Código: <b>${snap.codigo}</b></div>
            </td>
          </tr>

          <!-- Welcome -->
          <tr>
            <td style="padding:20px 26px">
              <p style="margin:0 0 6px 0;font-size:18px;font-weight:700;color:#0c3946">Bienvenido a la Patagonia</p>
              <p style="margin:0 0 16px 0;color:#334155">Tu reserva se ha gestionado con éxito. A continuación encontrarás el detalle.</p>

              <!-- LSR -->
              <div style="margin:12px 0 6px 0;font-weight:700;color:#0c3946;font-size:15px">Laguna San Rafael</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.6">
                <tr><td>Fecha Laguna San Rafael</td><td align="right"><b>${fechaLarga(snap.fechaLSR)}</b></td></tr>
                <tr><td>Personas mayores de 12 años</td><td align="right">${a}</td></tr>
                <tr><td>Niños entre 4 y 12 años</td><td align="right">${n}</td></tr>
                <tr><td>Menores de 4 años</td><td align="right">${i}</td></tr>
                <tr><td>Servicio de transporte</td><td align="right"><b>${transporteIncluido}</b></td></tr>
                <tr><td style="padding-top:8px">Sub Total Laguna San Rafael</td><td align="right" style="padding-top:8px"><b>${CLP(snap.totalLSR)}</b></td></tr>
                <tr><td>Descuentos aplicados a Laguna San Rafael</td><td align="right">−${CLP(snap.lsrDcto)}</td></tr>
              </table>

              <!-- Capillas -->
              <div style="margin:18px 0 6px 0;font-weight:700;color:#0c3946;font-size:15px">Capillas de Mármol</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.6">
                <tr><td>Servicio</td><td align="right"><b>${servicioCM}</b></td></tr>
                ${snap.fechaPromo ? `<tr><td>Fecha Capillas de Mármol</td><td align="right"><b>${fechaLarga(snap.fechaPromo)}</b></td></tr>` : ''}
                <tr><td>Sub Total Capillas</td><td align="right">${CLP(snap.promoSubtotal)}</td></tr>
                <tr><td>Descuentos Capillas</td><td align="right">−${CLP(snap.promoDcto)}</td></tr>
                <tr><td>Total Capillas</td><td align="right"><b>${CLP(snap.totalPromo)}</b></td></tr>
              </table>

              <!-- Totales -->
              <div style="margin:18px 0 6px 0;font-weight:700;color:#0c3946;font-size:15px">Totales</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.6">
                <tr><td>Total Cotización</td><td align="right"><b>${CLP(snap.totalCotizacion)}</b></td></tr>
                <tr><td>Total Abonado</td><td align="right">${CLP(snap.pagado)}</td></tr>
                <tr><td>Saldo Pendiente</td><td align="right"><b>${CLP(snap.saldo)}</b></td></tr>
              </table>

              ${snap.observaciones ? `<div style="margin-top:16px;padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;font-size:13px"><b>Observaciones:</b><br/>${snap.observaciones}</div>` : ''}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:14px 26px;background:#f8fafc;font-size:12px;color:#475569">
              notificaciones@valleglaciares.com · Puerto Río Tranquilo · Patagonia
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`
}
