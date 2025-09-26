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
      categoria: p.categoria, // 'adulto' | 'nino' | 'infante'
      cm_incluye: !!p.capillas             // ⬅️ NUEVO: persistimos si ese pasajero lleva CM
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

export async function updateReservaEnBD(params: {
  codigo: string
  fechaLSR: string | null
  valorTransporte: number              // ver nota más abajo si guardas total vs p/p
  descuentoLSR: number
  servicioCM: 'FM' | 'CM' | null
  fechaCM: string | null
  proveedorCM: string | null
  valorCMBruto: number                 // suma de cm_valor por pasajero
  descuentoCM: number
  observacionGrupo: string | null
  motivoMod: string                    // texto del modal
  pasajeros: Array<{
    nombre: string
    rut_pasaporte?: string | null
    nacionalidad?: string | null
    telefono?: string | null
    email?: string | null
    categoria: 'adulto' | 'nino' | 'infante'
    cm_incluye: boolean
  }>
}) {
  const {
    codigo,
    fechaLSR, valorTransporte, descuentoLSR,
    servicioCM, fechaCM, proveedorCM, valorCMBruto, descuentoCM,
    observacionGrupo, motivoMod,
    pasajeros
  } = params

  // 1) localizar reserva
  const { data: r, error: e1 } = await supabase
    .from('reservas')
    .select('id, observacion')
    .eq('codigo', codigo)
    .maybeSingle()
  if (e1) throw e1
  if (!r) throw new Error(`No existe reserva con código ${codigo}`)
  const reservaId = r.id

  // 2) anexar motivo a observación
  const prefix = `[Mod ${new Date().toISOString().slice(0,10)}] `
  const obsFinal = observacionGrupo && observacionGrupo.trim()
    ? `${observacionGrupo.trim()}\n${prefix}${motivoMod.trim()}`
    : `${prefix}${motivoMod.trim()}`

  // 3) actualizar cabecera
  const { error: e2 } = await supabase
    .from('reservas')
    .update({
      fecha_lsr: fechaLSR,
      valor_transporte: valorTransporte,
      descuento_lsr: descuentoLSR,
      servicio_cm: servicioCM,
      fecha_cm: fechaCM,
      proveedor: proveedorCM,
      valor_cm: valorCMBruto,
      descuento_cm: descuentoCM,
      observacion: obsFinal
    })
    .eq('id', reservaId)
  if (e2) throw e2

  // 4) reemplazar pasajeros
  const { error: eDel } = await supabase.from('pasajeros').delete().eq('reserva_id', reservaId)
  if (eDel) throw eDel

  const rows = pasajeros.map(p => ({
    reserva_id: reservaId,
    codigo,
    nombre: p.nombre || null,
    rut_pasaporte: p.rut_pasaporte || null,
    nacionalidad: p.nacionalidad || null,
    telefono: p.telefono || null,
    email: p.email || null,
    categoria: p.categoria,
    cm_incluye: !!p.cm_incluye
  }))
  if (rows.length) {
    const { error: eIns } = await supabase.from('pasajeros').insert(rows)
    if (eIns) throw eIns
  }

  // 5) log de modificación (para “Modificación” en visor)
  const { error: eLog } = await supabase
    .from('pagos')
    .insert([{ reserva_id: reservaId, id: codigo, medio: 'transferencia', monto: 0, comprobante: `MOD: ${motivoMod}` }])
  if (eLog) throw eLog

  return reservaId
}