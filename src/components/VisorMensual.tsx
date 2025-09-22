// src/components/VisorMensual.tsx
import React, { useEffect, useMemo, useState } from 'react'
import { LocalDB } from '../types'
import { th } from '../styles'
import { loadJSON, saveJSON } from '../state'

type Props = {
  db: LocalDB
  /** Navegar al Visor Diario con la fecha dada (YYYY-MM-DD) */
  onGoToVisorDiario: (isoDate: string) => void
}

type DayAgg = {
  pax: number
  transp: number
}

// Storage keys
const LS_MENSUAL_HIDDEN = 'vg_mensual_hidden_months' // ['YYYY-MM', ...]
const LS_MENSUAL_COMMENTS = 'vg_mensual_comments'     // Record<string, string> por día (YYYY-MM-DD)

// Utilidades de fecha
function formatYYYYMM_fromParts(year: number, month0: number) {
  const m = String(month0 + 1).padStart(2, '0')
  return `${year}-${m}`
}
function toISODate(d: Date) {
  return d.toISOString().slice(0, 10) // YYYY-MM-DD
}
function parseISODate(s?: string): Date | null {
  if (!s) return null
  const [y, m, d] = s.split('-').map((x) => parseInt(x, 10))
  if (!y || !m || !d) return null
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  return dt
}

const weekdayNames = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const fullWeekdayNames = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']
const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

// índice lunes=0 ... domingo=6
function mondayIndexOf(d: Date) {
  const jsDay = d.getUTCDay() // 0(dom) … 6(sáb) — en UTC
  return (jsDay + 6) % 7
}
function monthSpan(minDt: Date, maxDt: Date): Array<{ year: number; month0: number }> {
  const res: Array<{ year: number; month0: number }> = []
  const cur = new Date(Date.UTC(minDt.getUTCFullYear(), minDt.getUTCMonth(), 1, 12, 0, 0))
  const end = new Date(Date.UTC(maxDt.getUTCFullYear(), maxDt.getUTCMonth(), 1, 12, 0, 0))
  while (cur <= end) {
    res.push({ year: cur.getUTCFullYear(), month0: cur.getUTCMonth() })
    cur.setUTCMonth(cur.getUTCMonth() + 1)
  }
  return res
}

/** Paleta “acuarela” */
const aqua = {
  // headers de fin de semana
  yellowText: { color: '#713f12', background: 'rgba(234,179,8,.12)', border: '1px solid rgba(234,179,8,.35)' },
  redText:    { color: '#7f1d1d', background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.35)' },

  // celdas por intensidad
  greenBg:   { bg: 'rgba(16,185,129,0.15)',  bd: 'rgba(16,185,129,0.30)' },
  gyMidBg:   { bg: 'rgba(132,204,22,0.16)',  bd: 'rgba(132,204,22,0.32)' }, // verde->amarillo bisagra
  yellowBg:  { bg: 'rgba(234,179,8,0.18)',   bd: 'rgba(234,179,8,0.34)' },
  orangeBg:  { bg: 'rgba(251,146,60,0.20)',  bd: 'rgba(251,146,60,0.36)' },
  redBg:     { bg: 'rgba(239,68,68,0.24)',   bd: 'rgba(239,68,68,0.40)' }, // 1-39 (alto)
  redDeepBg: { bg: 'rgba(239,68,68,0.35)',   bd: 'rgba(239,68,68,0.55)' }, // == 40
  purpleBg:  { bg: 'rgba(168,85,247,0.30)',  bd: 'rgba(168,85,247,0.50)' }, // > 40
  blueBorder:{ bd: 'rgba(37,99,235,0.75)' } // comentarios
}

/** Mapea pax -> color de fondo/borde */
function bgForPax(n: number): { background: string; borderColor: string } {
  if (n <= 0) return { background: '#fff', borderColor: '#e5e7eb' }
  if (n > 40)  return { background: aqua.purpleBg.bg, borderColor: aqua.purpleBg.bd }
  if (n === 40) return { background: aqua.redDeepBg.bg, borderColor: aqua.redDeepBg.bd }
  // 1..39 — graduado suave verde -> amarillo -> rojo
  if (n <= 10) return { background: aqua.greenBg.bg,  borderColor: aqua.greenBg.bd }
  if (n <= 20) return { background: aqua.gyMidBg.bg,  borderColor: aqua.gyMidBg.bd }
  if (n <= 30) return { background: aqua.yellowBg.bg, borderColor: aqua.yellowBg.bd }
  return { background: aqua.orangeBg.bg, borderColor: aqua.orangeBg.bd } // 31..39
}

export default function VisorMensual({ db, onGoToVisorDiario }: Props) {
  const [hidden, setHidden] = useState<string[]>(
    loadJSON<string[]>(LS_MENSUAL_HIDDEN, [])
  )
  const hideSet = useMemo(() => new Set(hidden), [hidden])
  useEffect(() => saveJSON(LS_MENSUAL_HIDDEN, hidden), [hidden])

  const [comments, setComments] = useState<Record<string, string>>(
    loadJSON<Record<string, string>>(LS_MENSUAL_COMMENTS, {})
  )
  useEffect(()=> saveJSON(LS_MENSUAL_COMMENTS, comments), [comments])
    
  const [openDay, setOpenDay] = useState<string | null>(null)   // ISO abierto para popover
  const [draft, setDraft] = useState<string>('')                // texto temporal del comentario

   
  // Agregados por día
  const dayAgg: Record<string, DayAgg> = useMemo(() => {
    const map: Record<string, DayAgg> = {}
    for (const r of db.base_pasajeros) {
      const iso = (r.fecha_lsr || '').slice(0, 10)
      if (!iso) continue
      if (!map[iso]) map[iso] = { pax: 0, transp: 0 }
      map[iso].pax += 1
      if (r.transporte === 'si') map[iso].transp += 1
    }
    return map
  }, [db.base_pasajeros])

  // Rango de meses
  const { months } = useMemo(() => {
    const dates = db.base_pasajeros
      .map((r) => parseISODate(r.fecha_lsr))
      .filter((x): x is Date => !!x)
      .sort((a, b) => a.getTime() - b.getTime())

    if (dates.length === 0) {
      const now = new Date()
      return { months: [{ year: now.getFullYear(), month0: now.getMonth() }] }
    }
    const minDt = dates[0]
    const maxDt = dates[dates.length - 1]
    return { months: monthSpan(minDt, maxDt) }
  }, [db.base_pasajeros])

  // Estilos
  const card: React.CSSProperties = { border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }
  const header: React.CSSProperties = { padding: 8, borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, background: '#fafafa' }
  const headerTitle: React.CSSProperties = { fontSize: 14, fontWeight: 800, color: '#111827' }
  const headerMuted: React.CSSProperties = { color: '#6b7280', fontSize: 12 }
  const toggleBtn: React.CSSProperties = { padding: '6px 8px', fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff' }

  const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, padding: 8 }
  const dayHeadBase: React.CSSProperties = { ...th, padding: '6px 6px', fontSize: 11, textAlign: 'center', background:'#fff', position:'static' as any }
  const dayCellBase: React.CSSProperties = {
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    padding: 4,
    minHeight: 72,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 2,
    background: '#fff',
    position: 'relative' // para el popover
  }
  const dayNum: React.CSSProperties = { fontSize: 12, fontWeight: 800, color: '#111827', lineHeight: 1.1 }
  const mini: React.CSSProperties = { fontSize: 10, color: '#374151', lineHeight: 1.1 }
  const chipPax: React.CSSProperties = { fontSize: 10, padding: '1px 4px', borderRadius: 999, background: 'rgba(59,130,246,.10)', border: '1px solid rgba(59,130,246,.25)', color: '#1e3a8a', fontWeight: 700 }
  const chipTransp: React.CSSProperties = { fontSize: 10, padding: '1px 4px', borderRadius: 999, background: 'rgba(16,185,129,.10)', border: '1px solid rgba(16,185,129,.25)', color: '#065f46', fontWeight: 700 }
  const emptyCell: React.CSSProperties = { ...dayCellBase, background: '#f9fafb', color: '#9ca3af' }

  const actionBtn: React.CSSProperties = { padding: '6px 8px', borderRadius: 8, border: '1px solid #d1d5db', background:'#fff', fontSize:12, fontWeight:700 }
  const pop: React.CSSProperties = {
    position: 'absolute', top: 2, right: 2, zIndex: 20,
    background:'#fff', border:'1px solid #e5e7eb', borderRadius:8, padding:8,
    display:'grid', gap:6, width: 220, boxShadow:'0 10px 30px rgba(0,0,0,.08)'
  }
  const textArea: React.CSSProperties = { width:'100%', minHeight:60, fontSize:12, border:'1px solid #e5e7eb', borderRadius:6, padding:6 }

  function monthTotals(year: number, month0: number) {
    let pax = 0, transp = 0
    const daysInMonth = new Date(year, month0 + 1, 0).getUTCDate()
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(Date.UTC(year, month0, d, 12, 0, 0))
      const iso = toISODate(dt)
      const a = dayAgg[iso]
      if (a) { pax += a.pax; transp += a.transp }
    }
    return { pax, transp }
  }

  // colores para encabezados de días (Sáb = amarillo agua, Dom = rojo agua)
  const headStyleFor = (idx: number): React.CSSProperties => {
    if (idx === 5) { // sábado
      return { ...dayHeadBase, color: aqua.yellowText.color, background: aqua.yellowText.background, border: aqua.yellowText.border }
    }
    if (idx === 6) { // domingo
      return { ...dayHeadBase, color: aqua.redText.color, background: aqua.redText.background, border: aqua.redText.border }
    }
    return dayHeadBase
  }

  // abrir/cerrar popover y cargar draft
  function toggleDay(iso: string) {
    if (openDay === iso) { setOpenDay(null); return }
    setDraft(comments[iso] || '')
    setOpenDay(iso)
  }
  function saveComment(iso: string) {
    setComments(prev => ({ ...prev, [iso]: draft.trim() }))
    setOpenDay(null)
  }
  function hasComment(iso: string) {
    return !!(comments[iso] && comments[iso].trim())
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {months.map(({ year, month0 }) => {
        const first = new Date(Date.UTC(year, month0, 1, 12, 0, 0))
        const firstIdx = mondayIndexOf(first)
        const daysInMonth = new Date(Date.UTC(year, month0 + 1, 0, 12, 0, 0)).getUTCDate()
        const yyyymm = formatYYYYMM_fromParts(year, month0)
        const collapsed = hideSet.has(yyyymm)
        const totals = monthTotals(year, month0)

        return (
          <div key={yyyymm} style={card}>
            <div style={header}>
              <div>
                <div style={headerTitle}>{monthNames[month0]} {year}</div>
                <div style={headerMuted}>Pasajeros: <b>{totals.pax}</b> · Transportes: <b>{totals.transp}</b></div>
              </div>
              <div>
                <button
                  style={toggleBtn}
                  onClick={()=>{
                    setHidden(prev => {
                      const set = new Set(prev)
                      if (set.has(yyyymm)) set.delete(yyyymm)
                      else set.add(yyyymm)
                      return Array.from(set)
                    })
                  }}
                >
                  {collapsed ? 'Mostrar mes' : 'Ocultar mes'}
                </button>
              </div>
            </div>

            {!collapsed && (
              <div style={{ display:'grid', gap:6 }}>
                {/* Encabezado L a D */}
                <div style={grid}>
                  {weekdayNames.map((w, i)=>(
                    <div key={i} style={headStyleFor(i)}>{w}</div>
                  ))}
                </div>

                {/* Días */}
                <div style={grid}>
                  {/* huecos antes del día 1 */}
                  {Array.from({ length: firstIdx }).map((_, i)=>(
                    <div key={`x-${i}`} style={emptyCell} />
                  ))}
                  {/* días del mes */}
                  {Array.from({ length: daysInMonth }).map((_, i)=>{
                    const day = i + 1
                    const dt = new Date(Date.UTC(year, month0, day, 12, 0, 0))
                    const iso = toISODate(dt)
                    const a = dayAgg[iso]
                    const pax = a?.pax ?? 0
                    const transp = a?.transp ?? 0
                    const bg = bgForPax(pax)

                    const cellStyle: React.CSSProperties = {
                      ...dayCellBase,
                      background: bg.background,
                      borderColor: hasComment(iso) ? (aqua.blueBorder.bd) : bg.borderColor,
                      borderWidth: hasComment(iso) ? 2 : 1,
                      cursor: 'pointer'
                    }

                    const isOpen = openDay === iso

                    return (
                      <div
                        key={iso}
                        style={cellStyle}
                        title={`${fullWeekdayNames[mondayIndexOf(dt)]} ${day} — ${monthNames[month0]} ${year}`}
                        onClick={()=> toggleDay(iso)}
                      >
                        <div style={dayNum}>{day}</div>
                        <div style={mini}><span style={chipPax}>{pax}</span> pax</div>
                        <div style={mini}><span style={chipTransp}>{transp}</span> transp</div>

                        {/* Popover de acciones */}
                        {isOpen && (
                          <div style={pop} onClick={(e)=> e.stopPropagation()}>
                            <div style={{display:'grid', gap:6}}>
                              <button
                                style={actionBtn}
                                onClick={()=> onGoToVisorDiario(iso)}
                              >
                                Revisar detalle
                              </button>

                              <button
                              style={{...actionBtn, background:'#ecfccb', borderColor:'#bbf7d0', fontWeight:800}}
                              onClick={()=>{
                                window.dispatchEvent(new CustomEvent('vg:new-sale', { detail: { dateISO: iso } }))
                                setOpenDay(null)
                              }}
                            >
                              Ingresar venta
                            </button>                            
                                
                              <div>
                                <div style={{fontSize:12, marginBottom:4, color:'#374151'}}>Ingresar comentario</div>
                                <textarea
                                  style={textArea}
                                  value={draft}
                                  onChange={e=> setDraft(e.target.value)}
                                  placeholder="Comentario visible para todos…"
                                />
                                <div style={{display:'flex', gap:6, justifyContent:'flex-end', marginTop:6}}>
                                  <button style={actionBtn} onClick={()=> setOpenDay(null)}>Cancelar</button>
                                  <button
                                    style={{...actionBtn, background:'#f0f9ff', borderColor:'rgba(6,182,212,.35)', color:'#0c4a6e'}}
                                    onClick={()=> saveComment(iso)}
                                  >
                                    Guardar
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
