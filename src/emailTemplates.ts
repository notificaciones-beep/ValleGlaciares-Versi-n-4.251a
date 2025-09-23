// src/emailTemplates.ts
import { VoucherData } from './types'
import { CLP } from './utils'

// Ajusta esta URL a tu logo real (PNG/JPG/SVG público)
const LOGO_URL = 'https://valleglaciares.com/wp-content/uploads/2025/08/logo-valleglaciares-vertical-300-ppp.png'

// Fecha "12 de diciembre de 2025" (robusta para YYYY-MM-DD)
function fechaLarga(fecha?: string){
  if(!fecha) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha)
  const d = m ? new Date(Date.UTC(+m[1], +m[2]-1, +m[3])) : new Date(fecha)
  if (isNaN(d.getTime())) return fecha
  return new Intl.DateTimeFormat('es-CL', { day:'numeric', month:'long', year:'numeric', timeZone:'UTC' }).format(d)
}

export function correoReservaHTML(snap: VoucherData){
  const a = snap.pasajeros.filter(p=>p.categoria==='adulto').length
  const n = snap.pasajeros.filter(p=>p.categoria==='nino').length
  const i = snap.pasajeros.filter(p=>p.categoria==='infante').length
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

          <!-- Header con logo -->
          <tr>
            <td style="padding:0;background:#0c3946;color:#ffffff">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:14px 18px" valign="middle">
                    <img src="${LOGO_URL}" alt="Valle Glaciares" style="display:block;height:36px;max-width:200px;">
                  </td>
                  <td align="right" style="padding:14px 18px;font-size:12px;opacity:.95">
                    Código: <b>${snap.codigo}</b>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Welcome -->
          <tr>
            <td style="padding:22px 28px">
              <p style="margin:0 0 6px 0;font-size:18px;font-weight:800;color:#0c3946">Bienvenido a la Patagonia</p>
              <p style="margin:0 0 16px 0;color:#334155">Tu reserva se ha gestionado con éxito. A continuación encontrarás el detalle.</p>

              <!-- Laguna San Rafael -->
              <div style="margin:12px 0 6px 0;font-weight:700;color:#0c3946;font-size:15px">Laguna San Rafael</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.6">
                <tr><td>Fecha Laguna San Rafael</td><td align="right"><b>${fechaLarga(snap.fechaLSR)}</b></td></tr>
                <tr><td>Personas mayores de 12 años</td><td align="right">${a}</td></tr>
                <tr><td>Niños entre 4 y 12 años</td><td align="right">${n}</td></tr>
                <tr><td>Menores de 4 años</td><td align="right">${i}</td></tr>
                <tr><td>Servicio de transporte</td><td align="right"><b>${transporteIncluido}</b></td></tr>
                <!-- Solo un monto: Total LSR (con descuentos y transporte) -->
                <tr><td style="padding-top:8px">Total Laguna San Rafael</td><td align="right" style="padding-top:8px"><b>${CLP(snap.totalLSR)}</b></td></tr>
              </table>

              <!-- Capillas de Mármol -->
              <div style="margin:18px 0 6px 0;font-weight:700;color:#0c3946;font-size:15px">Capillas de Mármol</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.6">
                <tr><td>Servicio</td><td align="right"><b>${servicioCM}</b></td></tr>
                ${snap.fechaPromo ? `<tr><td>Fecha Capillas de Mármol</td><td align="right"><b>${fechaLarga(snap.fechaPromo)}</b></td></tr>` : ''}
                <!-- Solo un monto: Total Capillas (con descuentos aplicados) -->
                <tr><td style="padding-top:8px">Total Capillas de Mármol</td><td align="right" style="padding-top:8px"><b>${CLP(snap.totalPromo)}</b></td></tr>
              </table>

              <!-- Totales -->
              <div style="margin:18px 0 6px 0;font-weight:700;color:#0c3946;font-size:15px">Totales</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.6">
                <tr><td>Total Cotización</td><td align="right"><b>${CLP(snap.totalCotizacion)}</b></td></tr>
                <tr><td>Total Abonado</td><td align="right">${CLP(snap.pagado)}</td></tr>
                <tr><td>Saldo Pendiente</td><td align="right"><b>${CLP(snap.saldo)}</b></td></tr>
              </table>

              <!-- Textos adicionales -->
              <div style="margin-top:16px;color:#334155;font-size:13.5px;line-height:1.6">
                <p style="margin:0 0 10px 0">
                  1) El saldo pendiente deberá ser cancelado al menos un día antes de su excursión, no realizamos pagos el día de excursión para no generar retrasos en el programa y demás pasajeros.
                </p>
                <p style="margin:0">
                  2) Si ha contratado el servicio de Capillas de Mármol, le informamos que nuestro equipo se comunicará con usted el día anterior a su viaje para coordinar el horario más adecuado, teniendo en cuenta las condiciones climáticas previstas para la fecha de su tour.
                </p>
              </div>

              <!-- Aviso importante -->
              <div style="margin-top:16px;padding:12px 14px;background:#FFF9C4;border:1px solid #FDE68A;border-radius:10px;color:#7c5200;font-size:13.5px">
                <b>Aspectos importantes a considerar:</b>
                <div style="margin-top:6px">
                  Nuestra navegación puede ser cancelada por condiciones climáticas adversas y/o por razones de fuerza mayor. En caso de cancelación Ud. podrá: (a) reagendar para otro día, sujeto a disponibilidad, o (b) solicitar el reembolso del 100% del valor pagado.
                </div>
              </div>

              <!-- Botón Google Maps -->
              <div style="text-align:center;margin:22px 0 6px 0">
                <a href="https://www.google.com/maps/place/ValleGlaciares/@-46.6227271,-72.6744651,376m/data=!3m2!1e3!4b1!4m6!3m5!1s0xbd925716df268bdb:0xe9755e9d923d8e95!8m2!3d-46.6227271!4d-72.6744651!16s%2Fg%2F11fy9mcjwb?entry=ttu&g_ep=EgoyMDI1MDkyMS4wIKXMDSoASAFQAw%3D%3D"
                   style="display:inline-block;padding:12px 18px;border-radius:10px;text-decoration:none;background:#0c3946;color:#ffffff;font-weight:700;font-size:14px">
                  Revisa aquí cómo llegar a nuestra oficina
                </a>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:14px 26px;background:#f8fafc;font-size:12px;color:#475569;line-height:1.6">
              Este e-mail es generado de manera automática, por favor no respondas a este mensaje.<br/>
              Puede ponerse en contacto al correo <a href="mailto:info@valleglaciares.com">info@valleglaciares.com</a><br/>
              Desde Chile (+56 9) 6669 3266 / (+56 9) 6299 9006
              <div style="margin-top:8px;color:#64748b">notificaciones@valleglaciares.com · Puerto Río Tranquilo · Patagonia</div>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`
}
