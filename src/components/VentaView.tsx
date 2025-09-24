import React, { useEffect, useMemo } from 'react'
import { CLP, nInt } from '../utils'
import { MedioPago, Passenger } from '../types'

type Props = {
  fechaLSR:string, setFechaLSR:(v:string)=>void
  cantAdulto:number, setCantAdulto:(n:number)=>void
  cantNino:number, setCantNino:(n:number)=>void
  cantInfante:number, setCantInfante:(n:number)=>void
  descuentoLSR:number, setDescuentoLSR:(n:number)=>void
  incluyeTransporte:boolean, setIncluyeTransporte:(b:boolean)=>void
  promoTipo: 'FM'|'CM'|undefined, setPromoTipo:(v:'FM'|'CM'|undefined)=>void
  fechaPromo:string, setFechaPromo:(v:string)=>void
  proveedor:string|undefined, setProveedor:(v:string|undefined)=>void
  descuentoPromo:number, setDescuentoPromo:(n:number)=>void
  payments:{ medio:MedioPago, monto:number, comprobante?:string }[], setPayments:(p:any)=>void
  observaciones:string, setObservaciones:(v:string)=>void
  pasajeros:Passenger[], setPasajeros:(p:Passenger[])=>void
  totalPersonas:number
  season:'alta'|'baja'
  snapshotVoucher:()=>any
  ingresarPreReserva:()=>void
  ingresarReserva:()=>void
  ingresarReservaConCorreo: () => void
  totalPagado:number
  lsrSubtotal:number
  transporteTotal:number
  lsrDctoAplicado:number
  totalLSRConTransporte:number
  promoSubtotal:number
  promoDctoAplicado:number
  promoTotal:number
  totalCotizacion:number
  saldo:number
  ngPreview:string
  ratesLSR: any
  transportPerPerson:number
  proveedores?: string[]
  mediosPago?: string[]
  /** nuevo: mover “Limpiar” aquí */
  openClearConfirm: ()=>void
}

export default function VentaView(props:Props){
  const {
    fechaLSR, setFechaLSR, cantAdulto, setCantAdulto, cantNino, setCantNino, cantInfante, setCantInfante,
    descuentoLSR, setDescuentoLSR, incluyeTransporte, setIncluyeTransporte,
    promoTipo, setPromoTipo, fechaPromo, setFechaPromo, proveedor, setProveedor, descuentoPromo, setDescuentoPromo,
    payments, setPayments, observaciones, setObservaciones, pasajeros, setPasajeros, totalPersonas, season,
    ingresarPreReserva, ingresarReserva, ingresarReservaConCorreo, totalPagado,
    lsrSubtotal, transporteTotal, lsrDctoAplicado, totalLSRConTransporte,
    promoSubtotal, promoDctoAplicado, promoTotal, totalCotizacion, saldo, ngPreview, ratesLSR, transportPerPerson,
    openClearConfirm, proveedores,
    mediosPago = ['tarjeta','efectivo','efx','transferencia']
  } = props

  /** ====== Estilos “agua” ====== */
  const cardBase: React.CSSProperties = { border:'1px solid #e5e7eb', borderRadius:10 }
  const pad: React.CSSProperties = { padding:12 }

  const aquaBlueCard   = { ...cardBase, borderColor:'rgba(6,182,212,.35)',  background:'rgba(6,182,212,.08)'  }   // celeste agua
  const aquaYellowCard = { ...cardBase, borderColor:'rgba(234,179,8,.35)',  background:'rgba(234,179,8,.10)'  }  // amarillo agua
  const aquaPurpleCard = { ...cardBase, borderColor:'rgba(168,85,247,.35)', background:'rgba(168,85,247,.10)' }  // morado agua
  const aquaRedCard    = { ...cardBase, borderColor:'rgba(239,68,68,.35)',  background:'rgba(239,68,68,.10)'  }  // rojo agua
  const quoteCard      = { ...cardBase, background:'#fff' } // contenedor de cotización con chips por línea

  const chipBlue:   React.CSSProperties = { padding:'2px 6px', borderRadius:8, background:'rgba(6,182,212,.10)',  border:'1px solid rgba(6,182,212,.35)',  color:'#0c4a6e',  fontWeight:700 }
  const chipYellow: React.CSSProperties = { padding:'2px 6px', borderRadius:8, background:'rgba(234,179,8,.12)', border:'1px solid rgba(234,179,8,.35)', color:'#713f12', fontWeight:700 }
  const chipRed:    React.CSSProperties = { padding:'2px 6px', borderRadius:8, background:'rgba(239,68,68,.12)', border:'1px solid rgba(239,68,68,.35)', color:'#7f1d1d', fontWeight:800 }

  const actionBtn: React.CSSProperties = { padding:'10px 14px', borderRadius:10, border:'1px solid #d1d5db', fontSize:15, fontWeight:700, display:'inline-flex', gap:8, alignItems:'center' }
  const btnPrimary: React.CSSProperties = { ...actionBtn, background:'#f0f9ff', borderColor:'rgba(6,182,212,.35)', color:'#0c4a6e' }   // pre-reserva
  const btnSuccess: React.CSSProperties = { ...actionBtn, background:'#ecfccb', borderColor:'rgba(132,204,22,.35)', color:'#14532d' } // reserva + correo
  const btnGhost:   React.CSSProperties = { ...actionBtn, background:'#fff',    borderColor:'#e5e7eb', color:'#374151' }                // limpiar

  const smallCheckbox: React.CSSProperties = {
    width: 16,
    height: 16,
    padding: 0,
    margin: 0,
    appearance: 'auto' as any, // asegura tamaño nativo
    verticalAlign: 'middle'
  }

  /** ====== Email único (primer pasajero) ======
   * Los demás se rellenan automáticamente y quedan bloqueados.
   * CORRECCIÓN: setPasajeros recibe el ARRAY final (no updater).
   */
  useEffect(()=>{
    if(!pasajeros.length) return
    const first = pasajeros[0]?.email || ''
    const mismatch = pasajeros.some((p,i)=> i>0 && p.email !== first)
    if(mismatch){
      const next = pasajeros.map((p,idx)=> idx===0 ? p : ({...p, email:first}))
      setPasajeros(next)
    }
  }, [pasajeros[0]?.email, pasajeros.length])

  // Para asegurar que al crear nuevos pasajeros hereden el email del 1°
  // CORRECCIÓN: setPasajeros recibe el ARRAY final (no updater).
  useEffect(()=>{
    if(!pasajeros.length) return
    const first = pasajeros[0]?.email || ''
    const need = pasajeros.some((p,i)=> i>0 && p.email !== first)
    if(need){
      const next = pasajeros.map((p,idx)=> idx===0 ? p : ({...p, email:first}))
      setPasajeros(next)
    }
  }, [totalPersonas])

  return (
    <div style={{display:'grid', gridTemplateColumns:'1fr 380px', gap:12}}>
      <div style={{display:'grid', gap:12}}>
        {/* LSR */}
        <div style={aquaBlueCard}>
          <div style={pad}>
            <h2 style={{marginTop:0}}>
            Laguna San Rafael
            <span style={{fontSize:12, background:'#eef2ff', padding:'2px 6px', borderRadius:999}}>
            Temporada: {season.toUpperCase()}
            </span>
            </h2>

            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
              <div>
                <label>Fecha LSR</label>
                <input type="date" value={fechaLSR} onChange={e=>setFechaLSR(e.target.value)} />
              </div>
              <div>
                <label>Descuento LSR (CLP)</label>
                <input type="number" min={0} value={descuentoLSR} onChange={e=>setDescuentoLSR(nInt(e.target.value))}/>
              </div>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginTop:8}}>
              <div><label>Adultos (≥12)</label><input type="number" min={0} value={cantAdulto} onChange={e=>setCantAdulto(nInt(e.target.value))}/></div>
              <div><label>Niños (4–12)</label><input type="number" min={0} value={cantNino} onChange={e=>setCantNino(nInt(e.target.value))}/></div>
              <div><label>Menores de 4</label><input type="number" min={0} value={cantInfante} onChange={e=>setCantInfante(nInt(e.target.value))}/></div>
            </div>
            <div style={{color:'#0c4a6e', marginTop:8, display:'flex', gap:8, flexWrap:'wrap', fontWeight:600}}>
              <span style={chipBlue}>Adulto: {CLP(ratesLSR[season].adulto)}</span>
              <span style={chipBlue}>Niños (4–12): {CLP(ratesLSR[season].nino)}</span>
              <span style={chipBlue}>Menores de 4: {CLP(ratesLSR[season].infante)}</span>
            </div>
          </div>
        </div>

        {/* Transporte */}
        <div style={aquaBlueCard}>
          <div style={pad}>
            <h2 style={{marginTop:0}}>Transporte</h2>
            <div>
              <label>Agregar transporte (+ {CLP(transportPerPerson)} p/p)</label>
              <select value={incluyeTransporte ? 'si':'no'} onChange={e=>setIncluyeTransporte(e.target.value==='si')}>
                <option value="no">No</option><option value="si">Sí</option>
              </select>
            </div>
          </div>
        </div>

        {/* Capillas (config) */}
        <div style={aquaYellowCard}>
          <div style={pad}>
            <h2 style={{marginTop:0}}>Capillas de Mármol (configuración general)</h2>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8}}>
              <div>
                <label>Tipo</label>
                <select value={promoTipo || ''} onChange={e=>props.setPromoTipo((e.target.value||undefined) as any)}>
                  <option value="">—</option>
                  <option value="FM">Full Mármol (FM)</option>
                  <option value="CM">Capillas de Mármol (CM)</option>
                </select>
              </div>
              <div>
                <label>Fecha Capillas</label>
                <input type="date" value={fechaPromo} onChange={e=>setFechaPromo(e.target.value)} />
              </div>
              <div>
                <label>Proveedor</label>
                <select value={proveedor || ''} onChange={e=>setProveedor(e.target.value || undefined)}>
                  <option value="">—</option>
                  {(props.proveedores?.length ? props.proveedores : ['marmol-expediciones','marmol-patagonia'])
                  .map((p)=> <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div style={{marginTop:8}}>
              <label>Descuento Capillas (CLP)</label>
              <input type="number" min={0} value={descuentoPromo} onChange={e=>setDescuentoPromo(nInt(e.target.value))}/>
            </div>
          </div>
        </div>

        {/* Pasajeros */}
        <div style={aquaPurpleCard}>
          <div style={pad}>
            <h2 style={{marginTop:0}}>Pasajeros ({totalPersonas})</h2>
            <div style={{color:'#6b7280', margin:'8px 0 0'}}>
              Número de grupo (NG) para esta reserva: <b>{fechaLSR ? ngPreview : '—'}</b> {fechaLSR ? `· Fecha ${fechaLSR}` : '· Define Fecha LSR para calcular'}
            </div>
            <div style={{display:'grid', gap:8, marginTop:8}}>
              {pasajeros.map((p,i)=> (
                <div key={i} style={{display:'grid', gridTemplateColumns:'repeat(6, 1fr)', gap:6}}>
                  <input placeholder={`Nombre pasajero ${i+1}`} value={p.nombre} onChange={e=>setPasajeros(pasajeros.map((x,idx)=> idx===i? {...x, nombre:e.target.value} : x ))}/>
                  <input placeholder="RUT/Pasaporte" value={p.doc} onChange={e=>setPasajeros(pasajeros.map((x,idx)=> idx===i? {...x, doc:e.target.value} : x ))}/>
                  <input placeholder="Nacionalidad" value={p.nacionalidad} onChange={e=>setPasajeros(pasajeros.map((x,idx)=> idx===i? {...x, nacionalidad:e.target.value} : x ))}/>
                  <input placeholder="Teléfono" value={p.telefono} onChange={e=>setPasajeros(pasajeros.map((x,idx)=> idx===i? {...x, telefono:e.target.value} : x ))}/>
                  {/* Email: solo editable para el primer pasajero; el resto es espejo y bloqueado */}
                  {i===0 ? (
                    <input placeholder="Email (se aplicará a todos)" value={p.email} onChange={e=>setPasajeros(pasajeros.map((x,idx)=> ({...x, email: e.target.value})))} />
                  ) : (
                    <input placeholder="Email (heredado)" value={pasajeros[0]?.email || ''} readOnly style={{background:'rgba(229,231,235,.5)'}} />
                  )}
                  <div style={{display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(168,85,247,.20)',border:'1px solid rgba(168,85,247,.35)',borderRadius:6,fontSize:12,fontWeight:700,color:'#581c87'}}>
                    {p.categoria.toUpperCase()}
                  </div>
                  {promoTipo && (
  <label
    style={{display:'flex', alignItems:'center', gap:6, gridColumn:'1 / span 2'}}
  >
    <input
      type="checkbox"
      style={smallCheckbox}
      checked={p.capillas}
      onChange={e=>setPasajeros(
        pasajeros.map((x,idx)=> idx===i? {...x, capillas:e.target.checked} : x )
      )}
    />
    <span style={{fontSize:12}}>Capillas</span>
  </label>
)}
                </div>
              ))}
            </div>
            <div style={{marginTop:10}}>
              <label>Observaciones</label>
              <input placeholder="Ej: esperan en km 10" value={observaciones} onChange={e=>setObservaciones(e.target.value)}/>
            </div>
          </div>
        </div>

        {/* Pagos */}
        <div style={aquaRedCard}>
          <div style={pad}>
            <h2 style={{marginTop:0}}>Pagos</h2>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:6, alignItems:'center'}}>
              <div className="muted">Medio</div>
              <div className="muted">Monto (CLP)</div>
              <div className="muted">Comprobante</div>
              <div></div>
              {payments.map((p, i)=>(
                <React.Fragment key={i}>
                  <select value={p.medio} onChange={e=>setPayments(payments.map((x,idx)=> idx===i? {...x, medio: e.target.value as any} : x ))}>
                    {mediosPago.map((m,i)=> <option key={i} value={m}>{m}</option>)}
                  </select>
                  <input type="number" min={0} value={p.monto} onChange={e=>setPayments(payments.map((x,idx)=> idx===i? {...x, monto: Number(e.target.value||0)} : x ))} />
                  <input placeholder="N° voucher/comprobante" value={p.comprobante || ''} onChange={e=>setPayments(payments.map((x,idx)=> idx===i? {...x, comprobante:e.target.value} : x ))} />
                  <div style={{display:'flex', gap:6}}>
                    <button onClick={(e)=>{e.preventDefault(); setPayments([...payments, {medio:'efectivo', monto:0, comprobante:''}])}}>+ Agregar</button>
                    {payments.length>1 && <button onClick={(e)=>{e.preventDefault(); setPayments(payments.filter((_,idx)=> idx!==i))}}>Eliminar</button>}
                  </div>
                </React.Fragment>
              ))}
            </div>
            <div style={{marginTop:10, color:'#7f1d1d'}}>Pagado: <b>{CLP(totalPagado)}</b></div>
          </div>
        </div>

        {/* Acciones (botones grandes + limpiar aquí) */}
        <div style={{display:'flex', gap:10, flexWrap:'wrap'}}>
          <button style={btnPrimary} onClick={ingresarPreReserva}><span>📝</span> <span>Ingresar pre-reserva</span></button>
          <button style={btnSuccess} onClick={ingresarReservaConCorreo}><span>📧</span> <span>Ingresar reserva + correo</span></button>
          <button style={btnGhost} onClick={openClearConfirm}><span>🧹</span> <span>Limpiar</span></button>
        </div>
      </div>

      {/* Cotización (chips por color) */}
      <div style={{...quoteCard, position:'sticky', top:16, height:'fit-content'}}>
        <div style={pad}>
          <h2 style={{marginTop:0}}>Cotización</h2>
          <div style={{display:'grid', gridTemplateColumns:'1fr auto', gap:6, marginTop:8}}>
            {/* LSR (azul) */}
            <div style={{fontWeight:700, margin:'6px 0 2px'}}>Laguna San Rafael</div><div></div>
            <div>Subtotal LSR</div><div><span style={chipBlue}>{CLP(lsrSubtotal)}</span></div>
            <div>Servicio de transporte</div><div><span style={chipBlue}>{CLP(transporteTotal)}</span></div>
            <div>Dcto. LSR aplicado</div><div><span style={chipBlue}>- {CLP(lsrDctoAplicado)}</span></div>
            <div style={{gridColumn:'1 / span 2', borderTop:'1px solid #e5e7eb'}}></div>
            <div style={{fontWeight:700}}>Total Laguna San Rafael</div><div><span style={chipBlue}>{CLP(totalLSRConTransporte)}</span></div>
            <div style={{gridColumn:'1 / span 2', borderTop:'2px solid #e5e7eb'}}></div>

            {/* Capillas (amarillo) */}
            <div style={{fontWeight:700, margin:'6px 0 2px'}}>Capillas de Mármol</div><div></div>
            <div>Subtotal Capillas</div><div><span style={chipYellow}>{CLP(promoSubtotal)}</span></div>
            <div>Dcto. Capillas de Mármol</div><div><span style={chipYellow}>- {CLP(promoDctoAplicado)}</span></div>
            <div style={{gridColumn:'1 / span 2', borderTop:'1px solid #e5e7eb'}}></div>
            <div style={{fontWeight:700}}>Total Capillas de Mármol</div><div><span style={chipYellow}>{CLP(promoTotal)}</span></div>
            <div style={{gridColumn:'1 / span 2', borderTop:'2px solid #e5e7eb'}}></div>

            {/* Totales (rojo) */}
            <div style={{fontWeight:900, fontSize:16}}>Total Cotización</div><div><span style={chipRed}>{CLP(totalCotizacion)}</span></div>
            <div>Pagado</div><div><span style={chipRed}>{CLP(totalPagado)}</span></div>
            <div style={{fontWeight:700}}>Saldo</div><div><span style={chipRed}>{CLP(saldo)}</span></div>
          </div>
        </div>
      </div>
    </div>
  )
}
