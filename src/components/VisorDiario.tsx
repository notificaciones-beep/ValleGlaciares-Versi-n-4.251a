// src/components/VisorDiario.tsx
import React, { useEffect, useMemo, useState } from 'react'
import { BasePasajerosRow, CategoriaLSR, LocalDB } from '../types'
import { CLP, downloadCSV } from '../utils'
import { LS_VISOR_COLWIDTHS, LS_VISOR_FECHA, loadJSON, saveJSON } from '../state'
import { th, td } from '../styles'

export default function VisorDiario({db, computeSummaryForId, onClickId}:{db:LocalDB, computeSummaryForId:(id:string)=>any, onClickId:(id:string)=>void}){
  const [fecha, setFecha] = useState<string>(loadJSON<string>(LS_VISOR_FECHA, ''))
  useEffect(()=> saveJSON(LS_VISOR_FECHA, fecha), [fecha])

  const defaultWidths: Record<string, number> = {
    numero:60, saldo:160, usuario:120, fechaReserva:140, id:90, ng:70,
    nombre:180, documento:140, nacionalidad:120, telefono:120, correo:180,
    observaciones:220, tipo:90, transporte:100, modificacion:160,
    valorLSR:120, valorTransp:130, dctoLSR:120, fechaCM:120, proveedor:140,
    valorCM:120, dctoCM:110
  }
  const [colWidths, setColWidths] = useState<Record<string, number>>(loadJSON<Record<string,number>>(LS_VISOR_COLWIDTHS, defaultWidths))
  useEffect(()=> saveJSON(LS_VISOR_COLWIDTHS, colWidths), [colWidths])
  const setWidth = (k:string, v:number)=> setColWidths(prev=> ({...prev, [k]: Math.max(60, Math.min(400, v))}))

  const baseDelDia = useMemo(()=> !fecha ? [] as BasePasajerosRow[] : db.base_pasajeros.filter(r => (r.fecha_lsr||'') === fecha), [db.base_pasajeros, fecha])

  const baseOrdenada = useMemo(()=>{
    return [...baseDelDia].sort((a,b)=>{
      const byNg = (a.ng||'').localeCompare(b.ng||'')
      if(byNg!==0) return byNg
      const byId = a.id.localeCompare(b.id)
      if(byId!==0) return byId
      return (a.createdAt < b.createdAt) ? -1 : 1
    })
  }, [baseDelDia])

  const resumen = useMemo(()=>{
    const counts = { total:0, adulto:0, nino:0, infante:0, transportes:0 }
    baseDelDia.forEach(r=>{
      counts.total++
      if(r.lsr_categoria==='adulto') counts.adulto++
      if(r.lsr_categoria==='nino') counts.nino++
      if(r.lsr_categoria==='infante') counts.infante++
      if(r.transporte==='si') counts.transportes++
    })
    return counts
  }, [baseDelDia])

  const saldoPorId = useMemo(()=>{
    const ids = Array.from(new Set(baseDelDia.map(r=>r.id)))
    const map: Record<string, number> = {}
    ids.forEach(id=>{
      const s = computeSummaryForId(id)
      map[id] = s ? (s.saldo||0) : 0
    })
    return map
  }, [baseDelDia, db.base_pagos])

  const groupInfo = useMemo(()=>{
    const map: Record<string, { lsr_desc:number, cm_desc:number, fecha_cm:string, proveedor:string }> = {}
    baseDelDia.forEach(r=>{
      if(map[r.id]) return
      map[r.id] = {
        lsr_desc: r.lsr_descuento || 0,
        cm_desc: r.cm_descuento || 0,
        fecha_cm: r.fecha_cm || '',
        proveedor: r.proveedor || ''
      }
    })
    return map
  }, [baseDelDia])

  function motivoModificacion(id: string): string {
    const pagos = db.base_pagos.filter(p=>p.id===id).sort((a,b)=> a.createdAt<b.createdAt?1:-1)
    const mod = pagos.find(p=> (p.comprobante||'').startsWith('MOD:'))
    if(mod) return mod.comprobante as string
    const neg = pagos.find(p=> (p.monto||0) < 0)
    if(neg) return neg.comprobante || 'Reembolso'
    return '-'
  }

  const [cols, setCols] = useState<Record<string, boolean>>({
    numero:true, saldo:true, usuario:true, fechaReserva:true, id:true, ng:true,
    nombre:true, documento:true, nacionalidad:true, telefono:true, correo:true,
    observaciones:true, tipo:true, transporte:true, modificacion:true,
    valorLSR:true, valorTransp:true, dctoLSR:true, fechaCM:true, proveedor:true,
    valorCM:true, dctoCM:true
  })

  // ────────────────────────────────────────────────────────────────────────────
  // Helpers de formato/estilos
  // ────────────────────────────────────────────────────────────────────────────
  const formatFechaShort = (iso?: string) => {
    if(!iso) return '-'
    const d = new Date(iso)
    const dd = String(d.getDate()).padStart(2,'0')
    const mm = String(d.getMonth()+1).padStart(2,'0')
    const yy = String(d.getFullYear()).slice(-2)
    const hh = String(d.getHours()).padStart(2,'0')
    const mi = String(d.getMinutes()).padStart(2,'0')
    return `${dd}/${mm}/${yy}, ${hh}:${mi}`
  }

  // Solo el número: >0 deuda, <0 a favor (negativo), 0 sin saldo
  const saldoBadge = (saldo:number): {text:string, style:React.CSSProperties} => {
    if(saldo > 0){
      return {
        text: CLP(saldo),
        style: {
          padding:'2px 6px', borderRadius:6, fontWeight:700,
          color: '#7f1d1d',
          background:'rgba(239,68,68,0.12)',
          border: '1px solid rgba(239,68,68,0.25)'
        }
      }
    }else if(saldo < 0){
      return {
        text: CLP(saldo), // negativo
        style: {
          padding:'2px 6px', borderRadius:6, fontWeight:700,
          color: '#713f12',
          background:'rgba(234,179,8,0.18)', // amarillo/agua
          border: '1px solid rgba(234,179,8,0.35)'
        }
      }
    }else{
      return {
        text: 'Sin saldo',
        style: {
          padding:'2px 6px', borderRadius:6, fontWeight:700,
          color: '#064e3b',
          background:'rgba(16,185,129,0.12)',
          border: '1px solid rgba(16,185,129,0.25)'
        }
      }
    }
  }

  const idButtonStyle: React.CSSProperties = {
    cursor:'pointer', padding:'2px 8px', borderRadius:8, border:'1px solid rgba(251,146,60,.35)',
    background:'rgba(251,146,60,.12)', color:'#7c2d12', fontWeight:700
  }
  const tipoBadge = (cat:CategoriaLSR): React.CSSProperties => ({
    padding:'2px 6px', borderRadius:999, fontWeight:700,
    background: cat==='adulto' ? 'rgba(59,130,246,.12)'
             : cat==='nino'   ? 'rgba(20,184,166,.12)'
                              : 'rgba(168,85,247,.12)',
    color:      cat==='adulto' ? '#1e3a8a'
             : cat==='nino'   ? '#065f46'
                              : '#581c87',
    border:     cat==='adulto' ? '1px solid rgba(59,130,246,.25)'
             : cat==='nino'   ? '1px solid rgba(20,184,166,.25)'
                              : '1px solid rgba(168,85,247,.25)'
  })
  const transpBadge = (si:boolean): React.CSSProperties => ({
    padding:'2px 6px', borderRadius:999, fontWeight:700,
    background: si ? 'rgba(16,185,129,.12)' : 'rgba(107,114,128,.12)',
    color: si ? '#065f46' : '#374151',
    border: si ? '1px solid rgba(16,185,129,.25)' : '1px solid rgba(107,114,128,.25)'
  })
  const lsrChip: React.CSSProperties = { padding:'2px 6px', borderRadius:8, background:'rgba(59,130,246,.10)', border:'1px solid rgba(59,130,246,.25)', color:'#1e3a8a', fontWeight:700 }
  const cmChip: React.CSSProperties  = { padding:'2px 6px', borderRadius:8, background:'rgba(236,72,153,.10)', border:'1px solid rgba(236,72,153,.25)', color:'#831843', fontWeight:700 }
  const ngColor = (ng:string): React.CSSProperties => {
    const n = parseInt(ng || '0', 10) || 0
  
    // Si no hay número de grupo, usar un estilo neutro y evitar crash
    if (n <= 0) {
      return {
        padding:'2px 8px', borderRadius:8,
        background:'rgba(107,114,128,.10)', // gris suave
        border:'1px solid rgba(107,114,128,.25)',
        color:'#374151', fontWeight:700, display:'inline-block'
      }
    }
  
    const palette = [
      {bg:'rgba(59,130,246,.10)', bd:'rgba(59,130,246,.25)', fg:'#1e3a8a'},
      {bg:'rgba(16,185,129,.10)', bd:'rgba(16,185,129,.25)', fg:'#065f46'},
      {bg:'rgba(234,179,8,.10)',  bd:'rgba(234,179,8,.25)',  fg:'#713f12'},
      {bg:'rgba(236,72,153,.10)', bd:'rgba(236,72,153,.25)', fg:'#831843'},
      {bg:'rgba(99,102,241,.10)', bd:'rgba(99,102,241,.25)', fg:'#3730a3'},
      {bg:'rgba(6,182,212,.10)',  bd:'rgba(6,182,212,.25)',  fg:'#155e75'},
    ]
    // Modulo positivo (evita índices negativos)
    const idx = ((n - 1) % palette.length + palette.length) % palette.length
    const c = palette[idx]
    return {
      padding:'2px 8px', borderRadius:8, background:c.bg,
      border:`1px solid ${c.bd}`, color:c.fg, fontWeight:700, display:'inline-block'
    }
  }


  function exportCSV(){
    if(!baseOrdenada.length){ alert('No hay datos del día.'); return }
    const rows:any[] = []
    baseOrdenada.forEach((r, idx)=>{
      const saldo = saldoPorId[r.id] || 0
      const g = groupInfo[r.id] || {lsr_desc:0, cm_desc:0, fecha_cm:'', proveedor:''}
      const row:any = {}
      if(cols.numero) row.numero = idx+1
      if(cols.saldo){
        row.saldo = saldo!==0 ? CLP(saldo) : 'Sin saldo' // solo número; negativo = a favor
      }
      if(cols.usuario) row.usuario = r.vendedor
      if(cols.fechaReserva) row.fecha_reserva = formatFechaShort(r.createdAt)
      if(cols.id) row.id = r.id
      if(cols.ng) row.ng = r.ng
      if(cols.nombre) row.nombre = r.nombre
      if(cols.documento) row.documento = r.doc
      if(cols.nacionalidad) row.nacionalidad = r.nacionalidad
      if(cols.telefono) row.telefono = r.telefono
      if(cols.correo) row.correo = r.email
      if(cols.observaciones) row.observaciones = r.observaciones || ''
      if(cols.tipo) row.tipo = r.lsr_categoria
      if(cols.transporte) row.transporte = r.transporte==='si'?'Sí':'No'
      if(cols.modificacion) row.modificacion = motivoModificacion(r.id)
      if(cols.valorLSR) row.valor_lsr = r.lsr_valor
      if(cols.valorTransp) row.valor_transporte = r.transp_valor
      if(cols.dctoLSR) row.dcto_lsr_grupo = g.lsr_desc
      if(cols.fechaCM) row.fecha_cm = g.fecha_cm
      if(cols.proveedor) row.proveedor = g.proveedor
      if(cols.valorCM) row.valor_cm = r.cm_valor
      if(cols.dctoCM) row.dcto_cm_grupo = g.cm_desc
      rows.push(row)
    })
    downloadCSV(`visor_diario_${fecha}.csv`, rows)
  }

  return (
    <div style={{display:'grid', gap:12}}>
      <div style={{border:'1px solid #e5e7eb', borderRadius:10}}><div style={{padding:12}}>
        <h2 style={{marginTop:0}}>Visor diario</h2>
        <div style={{display:'flex', gap:8, alignItems:'end', flexWrap:'wrap'}}>
          <div>
            <label>Fecha LSR</label><br/>
            <input type="date" value={fecha} onChange={e=>setFecha(e.target.value)} />
          </div>
          <button onClick={exportCSV} disabled={!fecha || !baseOrdenada.length}>Exportar CSV</button>
        </div>

        {fecha && (
          <div style={{border:'1px solid #e5e7eb', borderRadius:10, marginTop:12}}>
            <div style={{padding:8, display:'flex', gap:16, alignItems:'center', flexWrap:'wrap'}}>
              <div style={{display:'flex', gap:6, alignItems:'center'}}>
                <span style={{fontWeight:700}}>Pasajeros:</span>
                <span>{resumen.total} (A:{resumen.adulto} / N:{resumen.nino} / I:{resumen.infante})</span>
              </div>
              <div style={{display:'flex', gap:6, alignItems:'center'}}>
                <span style={{fontWeight:700}}>Transporte (n°):</span>
                <span>{resumen.transportes}</span>
              </div>
            </div>
          </div>
        )}

        {!fecha ? (
          <div style={{color:'#6b7280', marginTop:8}}>Selecciona una fecha para ver los pasajeros del día.</div>
        ) : !baseOrdenada.length ? (
          <div style={{color:'#6b7280', marginTop:8}}>No hay reservas registradas para {fecha}.</div>
        ) : (
          <div style={{marginTop:12, overflowX:'auto'}}>
            <table style={{minWidth:1400, width:'100%', borderCollapse:'collapse', fontSize:12}}>
              <thead>
                <tr>
                  <th style={{...th, width:colWidths.numero}}>#</th>
                  <th style={{...th, width:colWidths.saldo}}>Saldo</th>
                  <th style={{...th, width:colWidths.usuario}}>Usuario</th>
                  <th style={{...th, width:colWidths.fechaReserva}}>Fecha reserva</th>
                  <th style={{...th, width:colWidths.id}}>ID</th>
                  <th style={{...th, width:colWidths.ng}}>NG</th>
                  <th style={{...th, width:colWidths.nombre}}>Nombre</th>
                  <th style={{...th, width:colWidths.documento}}>Documento</th>
                  <th style={{...th, width:colWidths.nacionalidad}}>Nacionalidad</th>
                  <th style={{...th, width:colWidths.telefono}}>Teléfono</th>
                  <th style={{...th, width:colWidths.correo}}>Correo</th>
                  <th style={{...th, width:colWidths.observaciones}}>Observaciones</th>
                  <th style={{...th, width:colWidths.tipo}}>Tipo</th>
                  <th style={{...th, width:colWidths.transporte}}>Transporte</th>
                  <th style={{...th, width:colWidths.modificacion}}>Modificación</th>
                  <th style={{...th, width:colWidths.valorLSR}}>Valor LSR</th>
                  <th style={{...th, width:colWidths.valorTransp}}>Valor transporte</th>
                  <th style={{...th, width:colWidths.dctoLSR}}>Dcto. LSR (grupo)</th>
                  <th style={{...th, width:colWidths.fechaCM}}>Fecha CM</th>
                  <th style={{...th, width:colWidths.proveedor}}>Proveedor</th>
                  <th style={{...th, width:colWidths.valorCM}}>Valor CM</th>
                  <th style={{...th, width:colWidths.dctoCM}}>Dcto. CM (grupo)</th>
                </tr>
              </thead>
              <tbody>
                {baseOrdenada.map((r, idx)=>{
                  const saldo = saldoPorId[r.id] || 0
                  const g = groupInfo[r.id] || { lsr_desc:0, cm_desc:0, fecha_cm:'', proveedor:'' }
                  const {text: saldoTxt, style: badgeStyle} = saldoBadge(saldo)

                  const isNewGroup = idx===0 || baseOrdenada[idx-1].id !== r.id

                  return (
                    <React.Fragment key={r.id + r.createdAt}>
                      {/* Fila separadora entre grupos (cuando cambia ID) */}
                      {isNewGroup && idx>0 && (
                        <tr>
                          <td colSpan={22} style={{padding:0}}>
                            <div style={{borderTop:'2px solid #d1d5db'}} />
                          </td>
                        </tr>
                      )}

                      <tr>
                        <td style={{...td, width:colWidths.numero}}>{idx+1}</td>
                        <td style={{...td, width:colWidths.saldo}}>
                          <span style={badgeStyle}>{saldoTxt}</span>
                        </td>
                        <td style={{...td, width:colWidths.usuario}}>{r.vendedor}</td>
                        <td style={{...td, width:colWidths.fechaReserva}}>{formatFechaShort(r.createdAt)}</td>
                        <td style={{...td, width:colWidths.id}}>
                          <button style={idButtonStyle} onClick={()=> onClickId(r.id)}>{r.id}</button>
                        </td>
                        <td style={{...td, width:colWidths.ng}}><span style={ngColor(r.ng)}>{r.ng || '—'}</span></td>
                        <td style={{...td, width:colWidths.nombre}}>{r.nombre}</td>
                        <td style={{...td, width:colWidths.documento}}>{r.doc}</td>
                        <td style={{...td, width:colWidths.nacionalidad}}>{r.nacionalidad}</td>
                        <td style={{...td, width:colWidths.telefono}}>{r.telefono}</td>
                        <td style={{...td, width:colWidths.correo}}>{r.email}</td>
                        <td style={{...td, width:colWidths.observaciones}}>{r.observaciones || ''}</td>
                        <td style={{...td, width:colWidths.tipo}}><span style={tipoBadge(r.lsr_categoria)}>{r.lsr_categoria}</span></td>
                        <td style={{...td, width:colWidths.transporte}}><span style={transpBadge(r.transporte==='si')}>{r.transporte==='si'?'Sí':'No'}</span></td>
                        <td style={{...td, width:colWidths.modificacion}}>{motivoModificacion(r.id)}</td>
                        <td style={{...td, width:colWidths.valorLSR}}><span style={lsrChip}>{CLP(r.lsr_valor)}</span></td>
                        <td style={{...td, width:colWidths.valorTransp}}><span style={lsrChip}>{CLP(r.transp_valor)}</span></td>
                        <td style={{...td, width:colWidths.dctoLSR}}><span style={lsrChip}>- {CLP(g.lsr_desc)}</span></td>
                        <td style={{...td, width:colWidths.fechaCM}}><span style={cmChip}>{g.fecha_cm || '-'}</span></td>
                        <td style={{...td, width:colWidths.proveedor}}><span style={cmChip}>{g.proveedor || '-'}</span></td>
                        <td style={{...td, width:colWidths.valorCM}}><span style={cmChip}>{CLP(r.cm_valor)}</span></td>
                        <td style={{...td, width:colWidths.dctoCM}}><span style={cmChip}>- {CLP(g.cm_desc)}</span></td>
                      </tr>
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div></div>
    </div>
  )
}
