// src/email.ts
export type ReservationEmailData = {
  ticket_number: string
  nombre_destinatario: string
  fecha_lsr: string
  monto_abonado: string
  valor_total: string
  saldo_pendiente: string
  transporte: 'Incluido'|'No Incluido'
  servicio_cm: string
  fecha_cm: string
  destinatario: string
  usuario: string
  total_pasajeros: number
}

const OUTBOX_KEY = 'vg_outbox'

function pushOutbox(item: any){
  try{
    const arr = JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]')
    arr.unshift({ ...item, createdAt: new Date().toISOString() })
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(arr.slice(0,200)))
  }catch{}
}

function fill(html: string, d: ReservationEmailData){
  return html
    .replaceAll('{ticket_number}', d.ticket_number)
    .replaceAll('{nombre_destinatario}', d.nombre_destinatario)
    .replaceAll('{fecha_lsr}', d.fecha_lsr || '—')
    .replaceAll('{monto_abonado}', d.monto_abonado)
    .replaceAll('{valor_total}', d.valor_total)
    .replaceAll('{saldo_pendiente}', d.saldo_pendiente)
    .replaceAll('{transporte}', d.transporte)
    .replaceAll('{servicio_cm}', d.servicio_cm || '—')
    .replaceAll('{fecha_cm}', d.fecha_cm || '—')
}

export async function sendReservationEmails(data: ReservationEmailData, customerHTML: string){
  // Cliente (HTML)
  pushOutbox({
    kind: 'customer',
    to: data.destinatario,
    subject: `Confirmación de reserva ${data.ticket_number}`,
    html: fill(customerHTML, data),
  })

  // Interno (texto)
  const body =
`La información de reserva es la siguiente:
ID: ${data.ticket_number}
Nombre representante: ${data.nombre_destinatario}
Cantidad de pasajeros: ${data.total_pasajeros}
Fecha LSR: ${data.fecha_lsr || '—'}
Transporte: ${data.transporte}
Total Cotización: ${data.valor_total}
Monto abonado: ${data.monto_abonado}
Saldo pendiente: ${data.saldo_pendiente}
Usuario: ${data.usuario}`

  pushOutbox({
    kind: 'internal',
    from: 'notificaciones@valleglaciares.com',
    to: 'info@valleglaciares.com',
    cc: ['oficina@valleglaciares.com'],
    subject: `Nueva reserva código ${data.ticket_number}`,
    body,
    footer: 'Este es un correo automático, por favor no responder',
  })
}
