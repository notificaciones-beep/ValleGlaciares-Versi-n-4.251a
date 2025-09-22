// src/components/BaseDatos.tsx
import React, { useMemo } from 'react'
import { LocalDB } from '../types'

type Props = { db: LocalDB }

// Local, minimal styles to avoid relying on external style module.
// (Esto reduce el riesgo de pantalla en blanco por imports rotos)
const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '6px 10px',
  borderBottom: '1px solid #f3f4f6',
  position: 'sticky',
  top: 0,
  background: '#fff',
  whiteSpace: 'nowrap'
}
const td: React.CSSProperties = {
  padding: '6px 10px',
  borderBottom: '1px solid #f3f4f6',
  verticalAlign: 'top',
  whiteSpace: 'nowrap'
}

const card: React.CSSProperties = { border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }
const header: React.CSSProperties = { padding: 12, borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }
const pad: React.CSSProperties = { padding: 12 }

const CLP = (n: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n || 0)

function exportJSON(filename: string, rows: any[]) {
  const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function exportCSV(filename: string, rows: any[]) {
  if (!rows.length) { alert('No hay filas para exportar.'); return }
  // claves: unión de todas las keys observadas (simple)
  const keysSet = new Set<string>()
  rows.forEach(r => Object.keys(r ?? {}).forEach(k => keysSet.add(k)))
  const keys = Array.from(keysSet)
  const csvEscape = (val: any) => {
    const s = String(val ?? '')
    if (s.includes('"') || s.includes(',') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const lines = [
    keys.join(','),
    ...rows.map(r => keys.map(k => csvEscape((r as any)[k])).join(','))
  ].join('\n')
  const blob = new Blob([lines], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export default function BaseDatos({ db }: Props) {
  const pasajeros = db.base_pasajeros || []
  const pagos = db.base_pagos || []
  const history = db.history || []

  const totals = useMemo(() => ({
    pasajeros: pasajeros.length,
    pagos: pagos.length,
    history: history.length
  }), [pasajeros, pagos, history])

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Base pasajeros */}
      <div style={card}>
        <div style={header}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0 }}>base_pasajeros</h3>
            <span style={{ color: '#6b7280' }}>({totals.pasajeros} filas)</span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => exportCSV('base_pasajeros.csv', pasajeros)}>Exportar CSV</button>
            <button onClick={() => exportJSON('base_pasajeros.json', pasajeros)}>Exportar JSON</button>
          </div>
        </div>
        <div style={{ padding: 0, overflowX: 'auto' }}>
          {pasajeros.length ? (
            <table style={{ minWidth: 1300, width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={th}>createdAt</th>
                  <th style={th}>vendedor</th>
                  <th style={th}>id</th>
                  <th style={th}>nombre</th>
                  <th style={th}>doc</th>
                  <th style={th}>nacionalidad</th>
                  <th style={th}>telefono</th>
                  <th style={th}>email</th>
                  <th style={th}>grupo</th>
                  <th style={th}>lsr_categoria</th>
                  <th style={th}>transporte</th>
                  <th style={th}>lsr_valor</th>
                  <th style={th}>transp_valor</th>
                  <th style={th}>lsr_descuento</th>
                  <th style={th}>cm_categoria</th>
                  <th style={th}>proveedor</th>
                  <th style={th}>fecha_cm</th>
                  <th style={th}>cm_valor</th>
                  <th style={th}>cm_descuento</th>
                  <th style={th}>observaciones</th>
                  <th style={th}>fecha_lsr</th>
                </tr>
              </thead>
              <tbody>
                {pasajeros.map((p: any, i: number) => (
                  <tr key={i}>
                    <td style={td}>{p.createdAt || ''}</td>
                    <td style={td}>{p.vendedor || ''}</td>
                    <td style={td}>{p.id || ''}</td>
                    <td style={td}>{p.nombre || ''}</td>
                    <td style={td}>{p.doc || ''}</td>
                    <td style={td}>{p.nacionalidad || ''}</td>
                    <td style={td}>{p.telefono || ''}</td>
                    <td style={td}>{p.email || ''}</td>
                    <td style={td}>{p.grupo || ''}</td>
                    <td style={td}>{p.lsr_categoria || ''}</td>
                    <td style={td}>{p.transporte || ''}</td>
                    <td style={td}>{CLP(p.lsr_valor || 0)}</td>
                    <td style={td}>{CLP(p.transp_valor || 0)}</td>
                    <td style={td}>{CLP(p.lsr_descuento || 0)}</td>
                    <td style={td}>{p.cm_categoria || ''}</td>
                    <td style={td}>{p.proveedor || ''}</td>
                    <td style={td}>{p.fecha_cm || ''}</td>
                    <td style={td}>{CLP(p.cm_valor || 0)}</td>
                    <td style={td}>{CLP(p.cm_descuento || 0)}</td>
                    <td style={td}>{p.observaciones || ''}</td>
                    <td style={td}>{p.fecha_lsr || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ ...pad, color: '#6b7280' }}>No hay filas.</div>
          )}
        </div>
      </div>

      {/* Base pagos */}
      <div style={card}>
        <div style={header}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0 }}>base_pagos</h3>
            <span style={{ color: '#6b7280' }}>({totals.pagos} filas)</span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => exportCSV('base_pagos.csv', pagos)}>Exportar CSV</button>
            <button onClick={() => exportJSON('base_pagos.json', pagos)}>Exportar JSON</button>
          </div>
        </div>
        <div style={{ padding: 0, overflowX: 'auto' }}>
          {pagos.length ? (
            <table style={{ minWidth: 900, width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={th}>createdAt</th>
                  <th style={th}>vendedor</th>
                  <th style={th}>id</th>
                  <th style={th}>medio</th>
                  <th style={th}>monto</th>
                  <th style={th}>comprobante</th>
                </tr>
              </thead>
              <tbody>
                {pagos.map((p: any, i: number) => (
                  <tr key={i}>
                    <td style={td}>{p.createdAt || ''}</td>
                    <td style={td}>{p.vendedor || ''}</td>
                    <td style={td}>{p.id || ''}</td>
                    <td style={td}>{p.medio || ''}</td>
                    <td style={td}>{CLP(p.monto || 0)}</td>
                    <td style={td}>{p.comprobante || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ ...pad, color: '#6b7280' }}>No hay filas.</div>
          )}
        </div>
      </div>

      {/* History (snapshots) */}
      <div style={card}>
        <div style={header}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0 }}>history (snapshots de voucher)</h3>
            <span style={{ color: '#6b7280' }}>({totals.history} filas)</span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => exportCSV('history.csv', history)}>Exportar CSV</button>
            <button onClick={() => exportJSON('history.json', history)}>Exportar JSON</button>
          </div>
        </div>
        <div style={{ padding: 0, overflowX: 'auto' }}>
          {history.length ? (
            <table style={{ minWidth: 1300, width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={th}>createdAt</th>
                  <th style={th}>vendedor</th>
                  <th style={th}>id</th>
                  <th style={th}>codigo</th>
                  <th style={th}>fechaLSR</th>
                  <th style={th}>lsrSubtotal</th>
                  <th style={th}>lsrDcto</th>
                  <th style={th}>transporte</th>
                  <th style={th}>totalLSR</th>
                  <th style={th}>promoTipo</th>
                  <th style={th}>fechaPromo</th>
                  <th style={th}>proveedor</th>
                  <th style={th}>promoSubtotal</th>
                  <th style={th}>promoDcto</th>
                  <th style={th}>promoTotal</th>
                  <th style={th}>totalCotizacion</th>
                  <th style={th}>saldo</th>
                  <th style={th}>pasajeros</th>
                  <th style={th}>observaciones</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h: any, i: number) => (
                  <tr key={i}>
                    <td style={td}>{h.createdAt || ''}</td>
                    <td style={td}>{h.vendedor || ''}</td>
                    <td style={td}>{h.id || ''}</td>
                    <td style={td}>{h.snapshot?.codigo || ''}</td>
                    <td style={td}>{h.snapshot?.fechaLSR || ''}</td>
                    <td style={td}>{CLP(h.snapshot?.lsrSubtotal || 0)}</td>
                    <td style={td}>{CLP(h.snapshot?.lsrDcto || 0)}</td>
                    <td style={td}>{CLP(h.snapshot?.transporte || 0)}</td>
                    <td style={td}>{CLP(h.snapshot?.totalLSR || 0)}</td>
                    <td style={td}>{h.snapshot?.promoTipo || ''}</td>
                    <td style={td}>{h.snapshot?.fechaPromo || ''}</td>
                    <td style={td}>{h.snapshot?.proveedor || ''}</td>
                    <td style={td}>{CLP(h.snapshot?.promoSubtotal || 0)}</td>
                    <td style={td}>{CLP(h.snapshot?.promoDcto || 0)}</td>
                    <td style={td}>{CLP(h.snapshot?.promoTotal || 0)}</td>
                    <td style={td}>{CLP(h.snapshot?.totalCotizacion || 0)}</td>
                    <td style={td}>{CLP(h.snapshot?.saldo || 0)}</td>
                    <td style={td}>{h.snapshot?.pasajeros?.length ?? 0}</td>
                    <td style={td}>{h.snapshot?.observaciones || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ ...pad, color: '#6b7280' }}>No hay filas.</div>
          )}
        </div>
      </div>
    </div>
  )
}
