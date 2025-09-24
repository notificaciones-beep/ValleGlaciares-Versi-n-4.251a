// src/db.ts
import { supabase } from './supabaseClient'
import type { VoucherData } from './types'

export async function saveReservaEnBD(snap: VoucherData, vendedorUid: string){
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

      // Proveedor (si lo manejas en tu app)
      proveedor: (snap as any).proveedor ?? null,

      // Capillas de Mármol
      servicio_cm: snap.promoTipo ?? null,             // 'FM' | 'CM' | null
      fecha_cm: (snap as any).fechaPromo || null,
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
      nombre: p.nombre ?? null,
      rut_pasaporte: p.rut ?? p.pasaporte ?? null,
      nacionalidad: p.nacionalidad ?? null,
      telefono: p.telefono ?? null,
      email: p.email ?? null,
      categoria: p.categoria // 'adulto' | 'nino' | 'infante'
    }))
    const { error: e2 } = await supabase.from('pasajeros').insert(rows)
    if (e2) throw e2
  }

  // (Opcional) Insertar pagos cuando tengas el detalle listo.

  return reservaId
}
 // === Helpers adicionales de persistencia ===

// Pre-reserva ligera (botón "Ingresar pre-reserva")
export async function savePreReservaEnBD(pr: {
  codigo: string;
  fecha_lsr?: string | null;
  cant_adulto: number;
  cant_nino: number;
  cant_infante: number;
  incluye_transporte: boolean;
}, vendedorUid: string) {
  const { error } = await supabase.from('prereservas').insert({
    codigo: pr.codigo,
    vendedor_uid: vendedorUid,
    fecha_lsr: pr.fecha_lsr ?? null,
    cant_adulto: pr.cant_adulto,
    cant_nino: pr.cant_nino,
    cant_infante: pr.cant_infante,
    incluye_transporte: pr.incluye_transporte,
  })
  if (error) throw error
}
