import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'

type PagoRow = {
  id: number
  created_at: string
  reserva_id: number | null
  codigo: string
  medio: string
  monto: number
  comprobante: string | null
  vendedor_uid: string | null
  conciliado: boolean
}

type Props = {
  vendorNameByUid?: Record<string, string> // opcional
}

type Tab = 'global' | 'mensual' | 'diario'

function fDDMMYY(iso: string) {
  try {
    const d = new Date(iso)
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yy = String(d.getFullYear()).slice(-2)
    return `${dd}/${mm}/${yy}`
  } catch {
    return iso
  }
}

function currencyCL(n: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n || 0)
}

export default function RegistroPagos({ vendorNameByUid = {} }: Props) {
  const [tab, setTab] = useState<Tab>('global')
  const [rows, setRows] = useState<PagoRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filtros
  const [monthRef, setMonthRef] = useState<string>(() => {
    // YYYY-MM por defecto al mes actual
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [dayRef, setDayRef] = useState<string>(() => {
    // YYYY-MM-DD por defecto al día actual
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${dd}`
  })

  async function fetchGlobal() {
    setLoading(true); setError(null)
    try {
      const { data, error } = await supabase
        .from('pagos')
        .select('id, created_at, reserva_id, codigo, medio, monto, comprobante, conciliado, reservas ( vendedor_uid )')
        .order('created_at', { ascending: false })

      if (error) throw error

      const mapped = (data ?? []).map((r: any) => ({
        id: Number(r.id),
        created_at: r.created_at,
        reserva_id: r.reserva_id ?? null,
        codigo: r.codigo ?? '',
        medio: r.medio ?? '',
        monto: Number(r.monto ?? 0),
        comprobante: r.comprobante ?? null,
        vendedor_uid: r.reservas?.vendedor_uid ?? null,
        conciliado: !!r.conciliado,
      }))
      setRows(mapped)
    } catch (e: any) {
      console.error('[RegistroPagos] fetchGlobal:', e)
      setError(e?.message ?? 'Error al cargar pagos (global)')
    } finally {
      setLoading(false)
    }
  }

  async function fetchMensual(refYYYYMM: string) {
    setLoading(true); setError(null)
    try {
      // Construimos rango [inicioMes, inicioMes+1m)
      const [y, m] = refYYYYMM.split('-').map(Number)
      const start = new Date(Date.UTC(y, (m - 1), 1, 0, 0, 0)).toISOString()
      const end = new Date(Date.UTC(y, m, 1, 0, 0, 0)).toISOString()

      const { data, error } = await supabase
        .from('pagos')
        .select('id, created_at, reserva_id, codigo, medio, monto, comprobante, conciliado, reservas ( vendedor_uid )')
        .gte('created_at', start)
        .lt('created_at', end)
        .order('created_at', { ascending: false })

      if (error) throw error

      const mapped = (data ?? []).map((r: any) => ({
        id: Number(r.id),
        created_at: r.created_at,
        reserva_id: r.reserva_id ?? null,
        codigo: r.codigo ?? '',
        medio: r.medio ?? '',
        monto: Number(r.monto ?? 0),
        comprobante: r.comprobante ?? null,
        vendedor_uid: r.reservas?.vendedor_uid ?? null,
        conciliado: !!r.conciliado,
      }))
      setRows(mapped)
    } catch (e: any) {
      console.error('[RegistroPagos] fetchMensual:', e)
      setError(e?.message ?? 'Error al cargar pagos del mes')
    } finally {
      setLoading(false)
    }
  }

  async function fetchDiario(refYYYYMMDD: string) {
    setLoading(true); setError(null)
    try {
      // Igualamos por fecha local → usamos un rango [día, día+1)
      const [y, m, d] = refYYYYMMDD.split('-').map(Number)
      const start = new Date(Date.UTC(y, (m - 1), d, 0, 0, 0)).toISOString()
      const end = new Date(Date.UTC(y, (m - 1), d + 1, 0, 0, 0)).toISOString()

      const { data, error } = await supabase
        .from('pagos')
        .select('id, created_at, reserva_id, codigo, medio, monto, comprobante, conciliado, reservas ( vendedor_uid )')
        .gte('created_at', start)
        .lt('created_at', end)
        .order('created_at', { ascending: false })

      if (error) throw error

      const mapped = (data ?? []).map((r: any) => ({
        id: Number(r.id),
        created_at: r.created_at,
        reserva_id: r.reserva_id ?? null,
        codigo: r.codigo ?? '',
        medio: r.medio ?? '',
        monto: Number(r.monto ?? 0),
        comprobante: r.comprobante ?? null,
        vendedor_uid: r.reservas?.vendedor_uid ?? null,
        conciliado: !!r.conciliado,
      }))
      setRows(mapped)
    } catch (e: any) {
      console.error('[RegistroPagos] fetchDiario:', e)
      setError(e?.message ?? 'Error al cargar pagos del día')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (tab === 'global') fetchGlobal()
    if (tab === 'mensual') fetchMensual(monthRef)
    if (tab === 'diario') fetchDiario(dayRef)

    const onUpdated = () => {
      if (tab === 'global') fetchGlobal()
      if (tab === 'mensual') fetchMensual(monthRef)
      if (tab === 'diario') fetchDiario(dayRef)
    }
    window.addEventListener('vg:pagos-updated', onUpdated)
    return () => window.removeEventListener('vg:pagos-updated', onUpdated)
  }, [tab])

  // Totales por medio
  const totalsByMedio = useMemo(() => {
    const acc: Record<string, number> = {}
    for (const r of rows) acc[r.medio || '(sin medio)'] = (acc[r.medio || '(sin medio)'] ?? 0) + (Number.isFinite(r.monto) ? r.monto : 0)
    return acc
  }, [rows])

  async function toggleConciliado(pagoId: number, nextVal: boolean) {
    try {
      // Persistimos en BD (Opción A)
      const { error } = await supabase
        .from('pagos')
        .update({ conciliado: nextVal })
        .eq('id', pagoId)

      if (error) throw error

      // Refrescamos en UI (optimista + evento global)
      setRows(prev => prev.map(r => r.id === pagoId ? { ...r, conciliado: nextVal } : r))
      window.dispatchEvent(new Event('vg:pagos-updated'))
    } catch (e) {
      console.error('[RegistroPagos] toggleConciliado:', e)
      alert('No se pudo actualizar la conciliación.')
    }
  }

  return (
    <div style={{ padding: 16, fontFamily: 'system-ui' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Registro de Pagos</h2>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={() => setTab('global')} disabled={tab==='global'}>Global</button>
          <button onClick={() => setTab('mensual')} disabled={tab==='mensual'}>Mensual</button>
          <button onClick={() => setTab('diario')} disabled={tab==='diario'}>Diario</button>
        </div>
      </div>

      {/* Filtros */}
      {tab === 'mensual' && (
        <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
          <label>Mes:&nbsp;
            <input type="month" value={monthRef}
              onChange={(e) => { setMonthRef(e.target.value); fetchMensual(e.target.value) }} />
          </label>
          <button onClick={() => fetchMensual(monthRef)} disabled={loading}>{loading ? 'Actualizando…' : 'Actualizar'}</button>
        </div>
      )}
      {tab === 'diario' && (
        <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
          <label>Día:&nbsp;
            <input type="date" value={dayRef}
              onChange={(e) => { setDayRef(e.target.value); fetchDiario(e.target.value) }} />
          </label>
          <button onClick={() => fetchDiario(dayRef)} disabled={loading}>{loading ? 'Actualizando…' : 'Actualizar'}</button>
        </div>
      )}
      {tab === 'global' && (
        <div style={{ marginBottom: 12 }}>
          <button onClick={fetchGlobal} disabled={loading}>{loading ? 'Actualizando…' : 'Actualizar'}</button>
        </div>
      )}

      {/* Resumen Totales por medio */}
      <div style={{ marginBottom: 16, padding: 12, border: '1px solid #e5e7eb', borderRadius: 8 }}>
        <strong>Totales por medio de pago</strong>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginTop: 8 }}>
          {Object.keys(totalsByMedio).length === 0 ? (
            <div style={{ gridColumn: '1 / span 2', color: '#6b7280' }}>Sin datos</div>
          ) : (
            Object.entries(totalsByMedio).map(([medio, total]) => (
              <React.Fragment key={medio}>
                <div>{medio}</div>
                <div style={{ textAlign: 'right' }}>{currencyCL(total)}</div>
              </React.Fragment>
            ))
          )}
        </div>
      </div>

      {/* Tabla */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f3f4f6' }}>
              <th style={th}>Created At (dd/mm/aa)</th>
              <th style={th}>Vendedor</th>
              <th style={th}>ID</th>
              <th style={th}>Medio de pago</th>
              <th style={th}>Monto</th>
              <th style={th}>Comprobante</th>
              <th style={th}>Conciliación</th>
            </tr>
          </thead>
          <tbody>
            {error && (
              <tr><td colSpan={7} style={{ padding: 12, color: '#b91c1c' }}>{error}</td></tr>
            )}
            {!error && rows.length === 0 && !loading && (
              <tr><td colSpan={7} style={{ padding: 12, color: '#6b7280' }}>Sin pagos para el período.</td></tr>
            )}
            {rows.map((r) => {
              const vendedor =
                (r.vendedor_uid && vendorNameByUid[r.vendedor_uid]) ||
                r.vendedor_uid || '(desconocido)'

              return (
                <tr key={r.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                  <td style={td}>{fDDMMYY(r.created_at)}</td>
                  <td style={td}>{vendedor}</td>
                  <td style={td}>{r.codigo}</td>
                  <td style={td}>{r.medio || '-'}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{currencyCL(r.monto)}</td>
                  <td style={td}>{r.comprobante || '-'}</td>

                  {/* Conciliación:
                      - Global: solo lectura (checkbox deshabilitado)
                      - Mensual: no se muestra casilla (requisito)
                      - Diario: casilla editable y persistente */}
                  {tab === 'mensual' ? (
                    <td style={td}>—</td>
                  ) : tab === 'global' ? (
                    <td style={td}>
                      <input type="checkbox" checked={!!r.conciliado} readOnly disabled />
                    </td>
                  ) : (
                    <td style={td}>
                      <input
                        type="checkbox"
                        checked={!!r.conciliado}
                        onChange={(e) => toggleConciliado(r.id, e.target.checked)}
                      />
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 8px',
  fontWeight: 600,
  borderBottom: '1px solid #e5e7eb',
  whiteSpace: 'nowrap',
}
const td: React.CSSProperties = {
  padding: '10px 8px',
  verticalAlign: 'top',
}
