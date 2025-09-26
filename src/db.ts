// src/db.ts
import { supabase } from './supabaseClient'
import type { VoucherData } from './types'

export async function saveReservaEnBD(
  snap: VoucherData,
  vendedorUid: string,
  payments?: { medio: string; monto: number; comprobante?: string }[]
){
  // Normalizar/derivar campos de Capillas y proveedor (nombres alternativos seguros)
  const servicioCM =
    (snap as any).promoTipo ??
    (snap as any).servicio_cm ??
    (snap as any).capillasTipo ??
    null;  // 'FM' | 'CM' | null

  const proveedorCM =
    (snap as any).proveedor ??
    (snap as any).proveedor_cm ??
    null;

  const fechaCM =
    (snap as any).fechaPromo ??
    (snap as any).fecha_cm ??
    (snap as any).fechaCM ??
    null;

  // 1) Inserta la reserva
  const { data: reserva, error } = await supabase
    .from('reservas')
    .insert({
      codigo: snap.codigo,
      vendedor_uid: vendedorUid,

      // LSR
      fecha_lsr: snap.fechaLSR || null,
      valor_lsr: snap.lsrSubtotal ?? 0,
      valor_transporte: (snap as any).transporte ?? 0,
      descuento_lsr: snap.lsrDcto ?? 0,
      motivo_dcto_lsr: (snap as any).motivoDctoLSR ?? null,

      // Proveedor Capillas
      proveedor: servicioCM ? proveedorCM : null,

      // Capillas de Mármol
      servicio_cm: servicioCM,                         // 'FM' | 'CM' | null
      fecha_cm: servicioCM ? fechaCM : null,
      valor_cm: snap.promoSubtotal ?? 0,
      descuento_cm: snap.promoDcto ?? 0,
      motivo_dcto_cm: (snap as any).motivoDctoCM ?? null,

      // Totales
      total_lsr: snap.totalLSR ?? 0,
      total_promo: snap.totalPromo ?? 0,
      total_cotizacion: snap.totalCotizacion ?? 0,
      pagado: snap.pagado ?? 0,
      saldo: snap.saldo ?? 0,

      // Observación
      observacion: snap.observaciones ?? null
    })
    .select('id')
    .single()

  if (error) throw error
  const reservaId = reserva.id

  // 2) Inserta pasajeros
  if (Array.isArray(snap.pasajeros) && snap.pasajeros.length){
    const rows = snap.pasajeros.map((p:any)=>({
      reserva_id: reservaId,
      codigo: snap.codigo,
      nombre: p.nombre ?? null,
      rut_pasaporte: p.doc ?? p.rut ?? p.pasaporte ?? null,
      nacionalidad: p.nacionalidad ?? null,
      telefono: p.telefono ?? null,
      email: p.email ?? null,
      categoria: p.categoria // 'adulto' | 'nino' | 'infante'
    }))
    const { error: e2 } = await supabase.from('pasajeros').insert(rows)
    if (e2) throw e2
  }

  // 3) Si hay pagos iniciales, insertarlos en BD
  if (payments && payments.length) {
    const rowsPay = payments
      .filter(p => (p.monto || 0) !== 0) // acepta positivos (pago) y negativos (reembolso)
      .map(p => ({
        reserva_id: reservaId,
        codigo: snap.codigo,
        medio: p.medio,
        monto: p.monto,
        comprobante: p.comprobante || null
      }))

    if (rowsPay.length) {
      const { error: ePay } = await supabase.from('pagos').insert(rowsPay)
      if (ePay) throw ePay
    }
  }

  return reservaId
}