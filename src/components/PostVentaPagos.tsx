import React, { useEffect, useMemo, useState } from 'react'
import { BasePagosRow, LocalDB, MedioPago } from '../types'
import { CLP, nowISO } from '../utils'
import { supabase } from '../supabaseClient'

export default function PostVentaPagos(
  {db, onAddPago, vendedorActual, computeSummaryForId, initialId, onConsumedInitial, mediosPago} : {
    db:LocalDB;
    onAddPago:(r:BasePagosRow)=>void;
    vendedorActual:string;
    computeSummaryForId:(id:string)=>any;
    initialId?: string;
    onConsumedInitial?: ()=>void;
    mediosPago: string[];
  }
){
  const [queryId, setQueryId] = useState('')
  const [found, setFound] = useState<any>(null)
  const pagosDelId = useMemo(()=> db.base_pagos.filter(p=> p.id === (found?.id||'')).sort((a,b)=> a.createdAt<b.createdAt?1:-1), [db.base_pagos, found?.id])

  const [medio, setMedio] = useState<MedioPago>('efectivo')
  const [monto, setMonto] = useState<number>(0)
  const [comprobante, setComprobante] = useState<string>('')

  useEffect(()=>{
    if(initialId){
      setQueryId(initialId.toUpperCase())
      const s = computeSummaryForId(initialId.toUpperCase())
      if(s) setFound(s); else setFound(null)
      onConsumedInitial && onConsumedInitial()
    }
  }, [initialId])

  function buscar(){
    const s = computeSummaryForId(queryId.trim().toUpperCase())
    if(!s){ alert('No se encuentra ese ID en base de pasajeros.'); setFound(null); return }
    setFound(s)
  }
  async function agregarMovimiento(){
    if(!found){ alert('Busca y selecciona un ID primero.'); return }
    if(!Number.isFinite(monto) || monto===0){
      alert('Ingresa un monto distinto de 0. Para reembolso usa monto negativo.'); return
    }
    const row: BasePagosRow = {
      createdAt: nowISO(),
      vendedor: vendedorActual,
      id: found.id,
      medio, monto, comprobante: (((comprobante || '').trim() ? ((comprobante || '').trim() + ' · ') : '') + 'vend:' + vendedorActual)
    }
    // === Persistir pago en Supabase ===
    try{
      const { data: { user: u } } = await supabase.auth.getUser()
      if(!u) throw new Error('Sin sesión (Supabase)')
    
      // Buscar la reserva por su código escrito (found.id)
      const code = (found?.id ?? '').toString().trim().toUpperCase();
      if (!code) { alert('Ingresa un código válido.'); return; }
      
      // Buscar la reserva por su código y traer también el propio código
      const { data: rsv, error: eFind } = await supabase
        .from('reservas')
        .select('id,codigo')
        .eq('codigo', code)
        .maybeSingle();
      
      if (eFind || !rsv?.id) {
        alert('No se encontró esa reserva en la BD. ¿La creaste con “Ingresar reserva + correo”?');
        return;
      }
    
      const { error: eIns } = await supabase.from('pagos').insert({
        reserva_id: rsv.id,
        codigo: rsv.codigo,           // <- requerido por tu esquema (NOT NULL)
        medio, monto,
        comprobante: (((comprobante || '').trim() ? ((comprobante || '').trim() + ' · ') : '') + 'vend:' + vendedorActual)
        
      });
      if (eIns) throw eIns;
      window.dispatchEvent(new Event('vg:pagos-updated'))

    } catch(e:any){
      alert('No se pudo guardar el pago en la BD: ' + (e?.message || e))
      return
    }
    onAddPago(row)
    setMonto(0); setComprobante('')
    const s = computeSummaryForId(found.id); setFound(s)
    alert('Movimiento registrado.')
  }

  return (
    <div style={{display:'grid', gap:12}}>
      <div style={{display:'grid', gridTemplateColumns:'1fr auto', gap:8}}>
        <input value={queryId} onChange={e=>setQueryId(e.target.value.toUpperCase())} placeholder="ID de reserva (ej. A0001 / B0123 ...)" />
        <button onClick={buscar}>Buscar</button>
      </div>

      {found && (
        <>
          <div style={{border:'1px solid #e5e7eb', borderRadius:10}}><div style={{padding:12}}>
            <h3 style={{marginTop:0}}>Resumen de la venta</h3>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
              <div style={{color:'#6b7280'}}>ID: <b>{found.id}</b></div>
              <div style={{color:'#6b7280'}}>Vendedor original: <b>{found.vendedorOriginal||'-'}</b></div>
              <div style={{color:'#6b7280'}}>Fecha LSR: <b>{found.fechaLSR || '-'}</b></div>
              <div style={{color:'#6b7280'}}>Transporte: <b>{CLP(found.transp)}</b></div>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'1fr auto', gap:6, marginTop:10}}>
              <div>LSR bruto</div><div>{CLP(found.lsrBruto)}</div>
              <div>Descuento LSR</div><div>- {CLP(found.lsrDesc)}</div>
              <div><b>Total LSR</b></div><div><b>{CLP(found.totalLSR)}</b></div>
              <div style={{gridColumn:'1 / span 2', borderTop:'1px solid #e5e7eb'}}></div>
              <div>Capillas bruto</div><div>{CLP(found.cmBruto)}</div>
              <div>Descuento Capillas</div><div>- {CLP(found.cmDesc)}</div>
              <div><b>Total Capillas</b></div><div><b>{CLP(found.totalCapillas)}</b></div>
              <div style={{gridColumn:'1 / span 2', borderTop:'1px solid #e5e7eb'}}></div>
              <div style={{fontWeight:800}}>Total Cotización</div><div style={{fontWeight:800}}>{CLP(found.totalCot)}</div>
              <div>Pagado</div><div>{CLP(found.pagado)}</div>
              <div style={{fontWeight:700}}>Saldo</div><div style={{fontWeight:700}}>{CLP(found.saldo)}</div>
            </div>
          </div></div>

          <div style={{border:'1px solid #e5e7eb', borderRadius:10}}><div style={{padding:12}}>
            <h3 style={{marginTop:0}}>Historial de movimientos</h3>
            {pagosDelId.length ? (
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:6, marginTop:8}}>
                <div className="muted">Fecha</div>
                <div className="muted">Medio</div>
                <div className="muted">Monto</div>
                <div className="muted">Comprobante</div>
                {pagosDelId.map((p,idx)=>(
                  <React.Fragment key={idx+p.createdAt}>
                    <div>{new Date(p.createdAt).toLocaleString('es-CL')}</div>
                    <div>{p.medio}</div>
                    <div style={{fontWeight:600}}>{CLP(p.monto)}</div>
                    <div>{p.comprobante || '-'}</div>
                  </React.Fragment>
                ))}
              </div>
            ) : <div style={{color:'#6b7280', marginTop:6}}>Sin movimientos aún.</div>}
          </div></div>

          <div style={{border:'1px solid #e5e7eb', borderRadius:10}}><div style={{padding:12}}>
            <h3 style={{marginTop:0}}>Agregar pago / reembolso</h3>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr auto', gap:8}}>
              <div>
                <label>Medio</label>
                <select value={medio} onChange={e=>setMedio(e.target.value as MedioPago)}>
                  {mediosPago.map((m,i)=> <option key={i} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label>Monto (CLP)</label>
                <input
                type="number"
                step="1"
                value={Number.isFinite(monto) ? monto : 0}
                onChange={e=>{

                // permite escribir '-', vacío, etc. sin romper el input
                const v = e.target.value;
                if (v === '' || v === '-') { setMonto(0 as any); return; }
                setMonto(Number(v));
              }}
              />
                <div style={{color:'#6b7280', fontSize:12, marginTop:4}}>Para <b>reembolso</b>, usa <b>monto negativo</b>.</div>
              </div>
              <div>
                <label>Comprobante / Nota</label>
                <input value={comprobante} onChange={e=>setComprobante(e.target.value)} placeholder="Ej: boleta #123 / motivo del reembolso" />
              </div>
              <div style={{display:'flex', alignItems:'end'}}>
                <button onClick={agregarMovimiento}>Registrar</button>
              </div>
            </div>
          </div></div>
        </>
      )}
    </div>
  )
}
