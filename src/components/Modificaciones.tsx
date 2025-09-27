// components/Modificaciones.tsx
import React, { useEffect, useMemo, useState } from 'react'
import { BasePagosRow, BasePasajerosRow, CategoriaLSR, LocalDB } from '../types'
import { nInt, nowISO, CLP } from '../utils'
import { updateReservaEnBD } from '../db'   // ← NUEVO
import { supabase } from '../supabaseClient'
// tarifas y transporte entran por props (compat admin)

const LS_MOD_STATE = 'vg_mod_last_id' // persistimos SOLO el último ID abierto

export default function Modificaciones(
  {db, setDb, vendedorActual, initialId, onConsumedInitial, ratesLSR, ratesPromo, transportPerPerson, getSeasonFn, proveedores}:{
    db:LocalDB;
    setDb: React.Dispatch<React.SetStateAction<LocalDB>>;
    vendedorActual: string;
    initialId?: string;
    onConsumedInitial?: ()=>void;
    ratesLSR: Record<'alta'|'baja', {adulto:number;nino:number;infante:number}>;
    ratesPromo: Record<'FM'|'CM', {adulto:number;nino:number;infante:number}>;
    transportPerPerson: number;
    getSeasonFn: (dateStr:string)=>'alta'|'baja';
    proveedores: string[];
  }
){
  const [queryId, setQueryId] = useState('')

  const [rows, setRows] = useState<BasePasajerosRow[]>([])
  const [loadedId, setLoadedId] = useState<string>('')

  // --------- Campos de grupo (editables) ----------
  const [fechaLSR, setFechaLSR] = useState<string>('') 
  const season = getSeasonFn(fechaLSR || '')
  const r = ratesLSR[season]

  const [transporteSi, setTransporteSi] = useState<boolean>(false)
  const [dctoLSR, setDctoLSR] = useState<number>(0)

  const [capillasTipo, setCapillasTipo] = useState<''|'FM'|'CM'>('')
  const [fechaCM, setFechaCM] = useState<string>('') 
  const [proveedor, setProveedor] = useState<string>('')
  const [dctoCM, setDctoCM] = useState<number>(0)
  const promoR = capillasTipo ? ratesPromo[capillasTipo] : null

  // contadores
  const [cantAdulto, setCantAdulto] = useState<number>(0)
  const [cantNino, setCantNino] = useState<number>(0)
  const [cantInfante, setCantInfante] = useState<number>(0)

  const [observaciones, setObservaciones] = useState<string>('') // observación de grupo

  // ---- UI: diálogos ----
  const [showDelete, setShowDelete] = useState(false)
  const [motivoDelete, setMotivoDelete] = useState('')
  const [showMotivo, setShowMotivo] = useState(false)
  const [motivoTmp, setMotivoTmp] = useState('')

  // ---------- helpers ----------
  function nextGroupForDate(fecha: string): string {
    if (!fecha) return ''
    const used = new Set(
      db.base_pasajeros
        .filter(r => (r.fecha_lsr || '') === fecha)
        .map(r => parseInt(String(r.ng || '0'), 10))
        .filter(n => Number.isFinite(n) && n > 0)
    )
    let i = 1
    while (used.has(i)) i++
    return String(i)
  }

  // Al montar: si hay un último ID usado, cargarlo automáticamente
  useEffect(()=>{
    try{
      const lastId = localStorage.getItem(LS_MOD_STATE)
      if(lastId){
        setQueryId(lastId)
        cargar(lastId, /*fromInitial*/true)
      }
    }catch{}
  }, [])

  // Cargar por ID inicial si viene desde otro módulo
  useEffect(()=>{
    if(initialId){
      setQueryId(initialId.toUpperCase())
      cargar(initialId.toUpperCase(), /*fromInitial*/true)
      onConsumedInitial && onConsumedInitial()
    }
  }, [initialId])

  function cargar(id?:string, fromInitial=false){
    const theId = (id || queryId).trim().toUpperCase()
    const set = db.base_pasajeros
      .filter(r=> r.id === theId)
      .sort((a,b)=> a.createdAt > b.createdAt ? 1 : -1)

    if(!set.length){ 
      if(fromInitial) return
      alert('No se encontró ese ID.')
      setRows([]); setLoadedId('')
      return
    }

    setRows(set)
    setLoadedId(theId)
    setQueryId(theId)

    // Derivar parámetros de grupo desde la primera fila
    setFechaLSR(set[0].fecha_lsr || '')
    setTransporteSi( (set[0].transporte==='si') )
    setDctoLSR( set[0].lsr_descuento || 0 )
    setFechaCM( set[0].fecha_cm || '' )
    setProveedor( set[0].proveedor || '' )
    setDctoCM( set[0].cm_descuento || 0 )
    setObservaciones( set[0].observaciones || '' )

    // Tipo capillas: detectar por mayor valor (o cualquiera >0)
    const anyCM = set.some(r=> (r.cm_valor||0) > 0)
    if(!anyCM){ setCapillasTipo('') }
    else{
      const maxVal = Math.max(...set.map(r=> r.cm_valor||0))
      if (maxVal >= ratesPromo.FM.adulto) setCapillasTipo('FM')
      else setCapillasTipo('CM')
    }

    // Contadores por categoría
    const a = set.filter(r=> r.lsr_categoria==='adulto').length
    const n = set.filter(r=> r.lsr_categoria==='nino').length
    const i = set.filter(r=> r.lsr_categoria==='infante').length
    setCantAdulto(a); setCantNino(n); setCantInfante(i)

    // Persistir SOLO el último ID
    try{ localStorage.setItem(LS_MOD_STATE, theId) }catch{}
  }

  // Mantener tamaño/lista según contadores, sin reordenar nombres
  useEffect(()=>{
    if(!rows.length) return

    setRows(prev=>{
      let current = [...prev]

      const target = {
        adulto:  Math.max(0, cantAdulto),
        nino:    Math.max(0, cantNino),
        infante: Math.max(0, cantInfante),
      }
      const targetTotal = target.adulto + target.nino + target.infante

      const isBlank = (r:BasePasajerosRow) =>
        !((r.nombre||'').trim() || (r.doc||'').trim() || (r.nacionalidad||'').trim() || (r.telefono||'').trim() || (r.email||'').trim())

      const count = (arr:BasePasajerosRow[]) =>
        arr.reduce((acc:any,r)=>{ acc.total++; acc[r.lsr_categoria]++; return acc }, {total:0, adulto:0, nino:0, infante:0})

      const makeBlank = (cat:'adulto'|'nino'|'infante'): BasePasajerosRow => {
        const ng = (current[0]?.ng || '')
        // ---- CORRECCIÓN: transporte como 'si'|'no' tipado
        const tr: 'si'|'no' = transporteSi ? 'si' : 'no'
        return {
          createdAt: nowISO(),
          estado: current[0]?.estado || 'reserva',
          vendedor: vendedorActual,
          id: loadedId,
          ng,
          nombre:'', doc:'', nacionalidad:'', telefono:'', email:'',
          lsr_categoria: cat,
          transporte: tr,
          lsr_valor: ratesLSR[season][cat],
          transp_valor: transporteSi ? transportPerPerson : 0,
          lsr_descuento: dctoLSR,
          cm_categoria: '',
          proveedor: capillasTipo ? (proveedor || '') : '',
          fecha_cm: capillasTipo ? (fechaCM || '') : '',
          cm_valor: 0,
          cm_descuento: dctoCM,
          observaciones: (current[0]?.observaciones || '') || '',
          fecha_lsr: fechaLSR || ''
        }
      }

      const pickDonorIndex = (arr:BasePasajerosRow[], donor:'adulto'|'nino'|'infante')=>{
        for(let i=arr.length-1; i>=0; i--){
          if(arr[i].lsr_categoria===donor && isBlank(arr[i])) return i
        }
        for(let i=arr.length-1; i>=0; i--){
          if(arr[i].lsr_categoria===donor) return i
        }
        return -1
      }

      const rebalance = (arr:BasePasajerosRow[], desired:{adulto:number,nino:number,infante:number})=>{
        const cats:('adulto'|'nino'|'infante')[] = ['adulto','nino','infante']
        const cur = count(arr)
        const surplus = (c:'adulto'|'nino'|'infante') => cur[c] - desired[c]
        const deficit = (c:'adulto'|'nino'|'infante') => desired[c] - cur[c]

        const setRowCat = (idx:number, newCat:'adulto'|'nino'|'infante')=>{
          const r = arr[idx]
          const teniaCM = (r.cm_valor||0) > 0
          const cmVal = (capillasTipo && teniaCM && promoR)
            ? (newCat==='adulto' ? promoR.adulto : (newCat==='nino' ? promoR.nino : promoR.infante))
            : 0
          const cmCat: 'adulto'|'infante'|'' = (capillasTipo && teniaCM) ? (newCat==='adulto' ? 'adulto' : 'infante') : ''

          // ---- CORRECCIÓN: transporte como 'si'|'no' tipado
          const tr: 'si'|'no' = transporteSi ? 'si' : 'no'

          arr[idx] = {
            ...r,
            lsr_categoria: newCat,
            lsr_valor: ratesLSR[season][newCat],
            transporte: tr,
            transp_valor: transporteSi ? transportPerPerson : 0,
            lsr_descuento: dctoLSR,
            cm_valor: capillasTipo ? cmVal : 0,
            cm_categoria: capillasTipo ? cmCat : '',
            proveedor: capillasTipo ? (proveedor || '') : '',
            fecha_cm: capillasTipo ? (fechaCM || '') : '',
            fecha_lsr: fechaLSR || ''
          }
        }

        for(const cat of cats){
          while(deficit(cat) > 0){
            const donor = cats
              .slice()
              .sort((a,b)=> (surplus(b) - surplus(a)))
              .find(c=> surplus(c) > 0)
            if(!donor) break
            const idx = pickDonorIndex(arr, donor)
            if(idx<0) break
            setRowCat(idx, cat)
            cur[cat]++
            cur[donor]--
          }
        }
        return arr
      }

      // 1) ajustar largo
      while(current.length < targetTotal){
        const curC = count(current)
        const def = {
          adulto:  Math.max(0, target.adulto  - curC.adulto),
          nino:    Math.max(0, target.nino    - curC.nino),
          infante: Math.max(0, target.infante - curC.infante),
        }
        const cat: 'adulto'|'nino'|'infante' =
          (def.adulto>=def.nino && def.adulto>=def.infante) ? 'adulto'
          : (def.nino>=def.infante) ? 'nino'
          : 'infante'
        current.push(makeBlank(cat))
      }
      while(current.length > targetTotal){
        let idx = -1
        for(let i=current.length-1; i>=0; i--){
          if(isBlank(current[i])){ idx=i; break }
        }
        if(idx<0) idx = current.length-1
        current.splice(idx,1)
      }

      // 2) cuadrar categorías sin reordenar
      current = rebalance(current, target)

      return current
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cantAdulto, cantNino, cantInfante])

  // Recalcular valores si cambian parámetros globales
  useEffect(()=>{
    if(!rows.length) return
    // ---- CORRECCIÓN: transporte como 'si'|'no' tipado
    const tr: 'si'|'no' = transporteSi ? 'si' : 'no'
    setRows(prev=> prev.map(r=>{
      const lsr_valor = rlsr(season, r.lsr_categoria)
      const transp_valor = transporteSi ? transportPerPerson : 0

      let cm_valor = 0
      let cm_categoria: 'adulto'|'infante'|'' = ''
      const teniaCM = (r.cm_valor||0) > 0
      if(capillasTipo && teniaCM){
        cm_valor = promoR ? (r.lsr_categoria==='adulto' ? promoR.adulto : (r.lsr_categoria==='nino' ? promoR.nino : promoR.infante)) : 0
        cm_categoria = (r.lsr_categoria==='adulto') ? 'adulto' : 'infante'
      }

      return {
        ...r,
        lsr_valor,
        transporte: tr,
        transp_valor,
        lsr_descuento: dctoLSR,
        cm_valor: capillasTipo ? cm_valor : 0,
        cm_categoria: capillasTipo ? cm_categoria : '',
        proveedor: capillasTipo ? (proveedor || '') : '',
        fecha_cm: capillasTipo ? (fechaCM || '') : '',
        observaciones: observaciones || r.observaciones || '',
        fecha_lsr: fechaLSR || ''
      }
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season, transporteSi, dctoLSR, capillasTipo, fechaCM, proveedor, dctoCM, observaciones, fechaLSR])

  function actualizarPasajero(i:number, patch:Partial<BasePasajerosRow>){
    setRows(prev=> prev.map((r,idx)=> idx===i? {...r, ...patch}: r))
  }

  // Lógica central de guardado, recibe el motivo desde el diálogo
  async function guardarConMotivo(motivo: string){
    if(!rows.length){ alert('Carga un ID primero.'); return }
  
    if(capillasTipo && rows.some(r => (r.cm_valor || 0) > 0) && !fechaCM){
      alert('Debes indicar la fecha de Capillas para guardar.')
      return
    }
    if(!motivo.trim()){
      alert('Debes indicar un motivo de modificación.')
      return
    }
  
    // Si cambió la fecha LSR, recalcular NG del grupo
    const orig = db.base_pasajeros.find(r=> r.id===loadedId)
    const origFecha = orig?.fecha_lsr || ''
    let nuevoNG = rows[0]?.ng || ''
    if (fechaLSR && fechaLSR !== origFecha) {
      nuevoNG = nextGroupForDate(fechaLSR)
    }
  
    const tr: 'si'|'no' = transporteSi ? 'si' : 'no'
  
    const recalc = rows.map(r=>{
      const lsr_valor = rlsr(season, r.lsr_categoria)
      const transp_valor = transporteSi ? transportPerPerson : 0
      const teniaCM = (r.cm_valor || 0) > 0
      let cm_valor = 0
      let cm_categoria: 'adulto'|'infante'|'' = ''
      if(capillasTipo && teniaCM){
        cm_valor = promoR ? (r.lsr_categoria==='adulto' ? promoR.adulto : (r.lsr_categoria==='nino' ? promoR.nino : promoR.infante)) : 0
        cm_categoria = (r.lsr_categoria==='adulto') ? 'adulto' : 'infante'
      }
      return {
        ...r,
        ng: nuevoNG || r.ng,
        transporte: tr,
        transp_valor,
        lsr_descuento: dctoLSR,
        cm_descuento: dctoCM,
        proveedor: capillasTipo ? (proveedor || '') : '',
        fecha_cm: capillasTipo ? (fechaCM || '') : '',
        cm_valor: capillasTipo ? cm_valor : 0,
        cm_categoria: capillasTipo ? cm_categoria : '',
        observaciones: (observaciones || r.observaciones || ''),
        lsr_valor,
        fecha_lsr: fechaLSR || ''
      }
    })
  
    // 1) Actualiza base local (UI inmediata)
    setDb(prev=>{
      const others = prev.base_pasajeros.filter(r=> r.id !== loadedId)
      return {...prev, base_pasajeros: [...others, ...recalc] }
    })
  
    // Log local (hasta que llegue realtime)
    const mov: BasePagosRow = {
      createdAt: nowISO(),
      vendedor: vendedorActual,
      id: loadedId,
      medio: 'transferencia',
      monto: 0,
      comprobante: `MOD: ${motivo} · vend:${vendedorActual}`
    }
    setDb(prev=> ({...prev, base_pagos: [...prev.base_pagos, mov]}))
  
    // 2) Sincroniza en Supabase
    try{
      const valorCMBruto = recalc.reduce((acc, r)=> acc + (r.cm_valor||0), 0)
      await updateReservaEnBD({
        codigo: loadedId,
        fechaLSR: fechaLSR || null,
        // si guardas TOTAL del grupo en reservas.valor_transporte, usa recalc.length * transportPerPerson
        valorTransporte: transporteSi ? transportPerPerson : 0,
        descuentoLSR: dctoLSR,
        servicioCM: capillasTipo || null,
        fechaCM: capillasTipo ? (fechaCM || null) : null,
        proveedorCM: capillasTipo ? (proveedor || null) : null,
        valorCMBruto,
        descuentoCM: dctoCM,
        observacionGrupo: (observaciones || '').trim() || null,
        motivoMod: motivo,
        pasajeros: recalc.map(r => ({
          nombre: r.nombre,
          rut_pasaporte: r.doc || null,
          nacionalidad: r.nacionalidad || null,
          telefono: r.telefono || null,
          email: r.email || null,
          categoria: r.lsr_categoria,
          cm_incluye: !!(capillasTipo && (r.cm_valor||0) > 0)
        }))
      })
      alert('Modificación guardada y sincronizada en BD.')
      // Log en BD como pago 0 (incluye vendedor)
      try {
        const { data: rsv2, error: eFind2 } = await supabase
          .from('reservas')
          .select('id,codigo')
          .eq('codigo', loadedId)
          .maybeSingle()
        if (!eFind2 && rsv2?.id) {
          await supabase.from('pagos').insert({
            reserva_id: rsv2.id,
            codigo: rsv2.codigo,
            medio: 'modificacion',
            monto: 0,
            comprobante: `MOD: ${motivo} · vend:${vendedorActual}`
          })
        }
      } catch (e) {
        console.warn('[Modificaciones] log de modificación no persistido en pagos:', e)
      }
    }catch(e:any){
      console.error('[Modificaciones] updateReservaEnBD', e)
      alert('Se guardó localmente, pero falló la sincronización con BD: ' + (e?.message || e))
    }
  }

  // === Persistencia en BD: eliminar pasajeros del grupo + log en pagos ===

  async function eliminarGrupo(){
    if(!rows.length || !loadedId){ alert('Carga un ID primero.'); return }
    if(!motivoDelete.trim()){
      alert('Ingresa el motivo de eliminación.')
      return
    }
    setDb(prev=>{
      const left = prev.base_pasajeros.filter(r=> r.id !== loadedId)
      return {...prev, base_pasajeros: left}
    })
    const mov: BasePagosRow = {
      createdAt: nowISO(),
      vendedor: vendedorActual,
      id: loadedId,
      medio: 'transferencia',
      monto: 0,
      comprobante: `DEL: ${motivoDelete} · vend:${vendedorActual}`
    }
    setDb(prev=> ({...prev, base_pagos: [...prev.base_pagos, mov]}))

    try {
      const { data: { user: u } } = await supabase.auth.getUser()
      if(!u){ alert('No hay sesión iniciada. Inicia sesión e intenta de nuevo.'); return }
  
      const { data: rsv, error: eFind } = await supabase
        .from('reservas')
        .select('id')
        .eq('codigo', loadedId)
        .maybeSingle()
  
      if (eFind || !rsv?.id) {
        alert('No se encontró la reserva en BD para este ID.')
      } else {
        // 1) Borrar pasajeros de esa reserva
        const { error: eDelP } = await supabase
          .from('pasajeros')
          .delete()
          .eq('reserva_id', rsv.id)
        if (eDelP) throw eDelP
  
        // 2) Insertar movimiento 0 en pagos (log de eliminación)
        const { error: eInsPay } = await supabase.from('pagos').insert({
          reserva_id: rsv.id,
          codigo: loadedId,
          medio: 'modificacion',
          monto: 0,
          comprobante: `DEL: ${motivoDelete}`
        })
        if (eInsPay) throw eInsPay
      }
    } catch(e:any){
      alert('No se pudo reflejar la eliminación en la BD: ' + (e?.message || e))
      return
    }
    // === Fin persistencia en BD ===
    try{ localStorage.removeItem(LS_MOD_STATE) }catch{}
    setRows([]); setLoadedId(''); setQueryId('')
    setShowDelete(false); setMotivoDelete('')
    alert('Grupo eliminado.')
  }

  const vendedorOriginal = rows[0]?.vendedor || '-'
  const ng = rows[0]?.ng || '-'

  // Resumen (informativo)
  const lsrBruto = useMemo(()=> rows.reduce((a,r)=> a + (r.lsr_valor||0), 0), [rows])
  const transp = useMemo(()=> rows.reduce((a,r)=> a + (r.transp_valor||0), 0), [rows])
  const cmBruto = useMemo(()=> rows.reduce((a,r)=> a + (r.cm_valor||0), 0), [rows])
  const totalLSR = Math.max(0, lsrBruto - dctoLSR) + transp
  const totalCM  = Math.max(0, cmBruto - dctoCM)
  const totalCot = totalLSR + totalCM

  const smallCheckbox: React.CSSProperties = { width:16, height:16, transform:'scale(0.9)' }

  return (
    <div style={{display:'grid', gap:12}}>
      {/* Búsqueda */}
      <div style={{border:'1px solid #e5e7eb', borderRadius:10}}><div style={{padding:12}}>
        <h2 style={{marginTop:0}}>Modificaciones</h2>
        <div style={{display:'grid', gridTemplateColumns:'1fr auto', gap:8, maxWidth:720}}>
          <input value={queryId} onChange={e=>setQueryId(e.target.value.toUpperCase())} placeholder="ID (ej. A0001)" />
          <button onClick={()=>cargar()}>Cargar</button>
        </div>
        {!rows.length && <div style={{color:'#6b7280', marginTop:8}}>Busca un ID para editar datos del grupo y pasajeros.</div>}
      </div></div>

      {rows.length>0 && (
        <>
        {/* Resumen encabezado */}
        <div style={{border:'1px solid #e5e7eb', borderRadius:10}}><div style={{padding:12}}>
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:8}}>
            <h3 style={{marginTop:0}}>Resumen del grupo · ID <b>{loadedId}</b></h3>
            <button onClick={()=>{ setMotivoDelete(''); setShowDelete(true) }} style={{background:'#fee2e2', border:'1px solid #fecaca', color:'#7f1d1d', borderRadius:8, padding:'6px 10px', fontWeight:700}}>
              Eliminar grupo
            </button>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:8}}>
            <div><div className="muted">Vendedor</div><div>{vendedorOriginal}</div></div>
            <div><div className="muted">Fecha LSR</div><div>{fechaLSR || '-'}</div></div>
            <div><div className="muted">NG</div><div>{ng}</div></div>
            <div><div className="muted">Temporada</div><div style={{fontWeight:700}}>{season.toUpperCase()}</div></div>
          </div>
        </div></div>

        {/* Parámetros LSR */}
        <div style={{border:'1px solid #e5e7eb', borderRadius:10}}>
          <div style={{padding:12}}>
            <h2 style={{marginTop:0}}>Laguna San Rafael <span style={{fontSize:12, background:'#eef2ff', padding:'2px 6px', borderRadius:999}}>Temporada: {season.toUpperCase()}</span></h2>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
              <div>
                <label>Fecha LSR</label>
                <input type="date" value={fechaLSR} onChange={e=>setFechaLSR(e.target.value)} />
              </div>
              <div>
                <label>Descuento LSR (CLP)</label>
                <input type="number" min={0} value={dctoLSR} onChange={e=>setDctoLSR(nInt(e.target.value))}/>
              </div>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginTop:8}}>
              <div><label>Adultos (≥12)</label><input type="number" min={0} value={cantAdulto} onChange={e=>setCantAdulto(nInt(e.target.value))}/></div>
              <div><label>Niños (4–12)</label><input type="number" min={0} value={cantNino} onChange={e=>setCantNino(nInt(e.target.value))}/></div>
              <div><label>Menores de 4</label><input type="number" min={0} value={cantInfante} onChange={e=>setCantInfante(nInt(e.target.value))}/></div>
            </div>
            <div style={{color:'#6b7280', marginTop:8, display:'flex', gap:8, flexWrap:'wrap'}}>
              <span style={{background:'#f3f4f6', padding:'2px 8px', borderRadius:999}}>Adulto: {CLP(r.adulto)}</span>
              <span style={{background:'#f3f4f6', padding:'2px 8px', borderRadius:999}}>Niños (4–12): {CLP(r.nino)}</span>
              <span style={{background:'#f3f4f6', padding:'2px 8px', borderRadius:999}}>Menores de 4: {CLP(r.infante)}</span>
            </div>
          </div>
        </div>

        {/* Transporte */}
        <div style={{border:'1px solid #e5e7eb', borderRadius:10}}>
          <div style={{padding:12}}>
            <h2 style={{marginTop:0}}>Transporte</h2>
            <div>
              <label>Agregar transporte (+ {CLP(transportPerPerson)} p/p)</label>
              <select value={transporteSi ? 'si':'no'} onChange={e=>setTransporteSi(e.target.value==='si')}>
                <option value="no">No</option><option value="si">Sí</option>
              </select>
            </div>
          </div>
        </div>

        {/* Capillas (config) */}
        <div style={{border:'1px solid #e5e7eb', borderRadius:10}}>
          <div style={{padding:12}}>
            <h2 style={{marginTop:0}}>Capillas de Mármol (configuración general)</h2>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8}}>
              <div>
                <label>Tipo</label>
                <select value={capillasTipo} onChange={e=>setCapillasTipo((e.target.value as any))}>
                  <option value="">—</option>
                  <option value="FM">Full Mármol (FM)</option>
                  <option value="CM">Capillas de Mármol (CM)</option>
                </select>
              </div>
              <div>
                <label>Fecha Capillas</label>
                <input type="date" value={fechaCM} onChange={e=>setFechaCM(e.target.value)} disabled={!capillasTipo}/>
              </div>
              <div>
                <label>Proveedor</label>
                <select value={proveedor} onChange={e=>setProveedor(e.target.value)} disabled={!capillasTipo}>
                  <option value="">—</option>
                  {proveedores.map((p,i)=>(
                  <option key={i} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{marginTop:8}}>
              <label>Descuento Capillas (CLP)</label>
              <input type="number" min={0} value={dctoCM} onChange={e=>setDctoCM(nInt(e.target.value))}/>
            </div>
          </div>
        </div>

        {/* Pasajeros (editables) */}
        <div style={{border:'1px solid #e5e7eb', borderRadius:10, overflowX:'auto'}}><div style={{padding:12}}>
          <h3 style={{marginTop:0}}>Pasajeros ({rows.length})</h3>
          <table style={{minWidth:1000, width:'100%', borderCollapse:'collapse', fontSize:12}}>
            <thead>
              <tr>
                <th>#</th><th>Nombre</th><th>RUT/Pasaporte</th><th>Nacionalidad</th><th>Teléfono</th><th>Correo</th><th>Tipo</th><th>Capillas</th><th>Valor LSR</th><th>Valor Transp.</th><th>Valor CM</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i)=>(
                <tr key={r.id + r.createdAt}>
                  <td>{i+1}</td>
                  <td><input value={r.nombre} onChange={e=>actualizarPasajero(i,{nombre:e.target.value})} /></td>
                  <td><input value={r.doc} onChange={e=>actualizarPasajero(i,{doc:e.target.value})} placeholder="RUT o Pasaporte" /></td>
                  <td><input value={r.nacionalidad} onChange={e=>actualizarPasajero(i,{nacionalidad:e.target.value})} /></td>
                  <td><input value={r.telefono} onChange={e=>actualizarPasajero(i,{telefono:e.target.value})} /></td>
                  <td><input value={r.email} onChange={e=>actualizarPasajero(i,{email:e.target.value})} /></td>
                  <td style={{fontWeight:700}}>{r.lsr_categoria.toUpperCase()}</td>
                  <td style={{textAlign:'center'}}>
                  <input
  type="checkbox"
  style={{ accentColor: '#eab308' }}
  disabled={!capillasTipo}
  checked={r.cm_valor>0}
  onChange={e=>{
    const checked = e.target.checked
    const rr = capillasTipo ? ratesPromo[capillasTipo] : null
    const val = (checked && rr)
    ? (r.lsr_categoria==='adulto' ? rr.adulto : (r.lsr_categoria==='nino' ? rr.nino : rr.infante))
    : 0
    const cm_cat: 'adulto'|'infante'|'' = checked
    ? (r.lsr_categoria==='adulto' ? 'adulto' : 'infante')
    : ''
    actualizarPasajero(i, { cm_valor: val, cm_categoria: cm_cat })
  }}
/>
                  </td>
                  <td>{CLP(r.lsr_valor)}</td>
                  <td>{CLP(transporteSi ? transportPerPerson : 0)}</td>
                  <td>{CLP(capillasTipo ? (r.cm_valor||0) : 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{marginTop:10}}>
            <label>Observaciones (grupo)</label>
            <input value={observaciones} onChange={e=>setObservaciones(e.target.value)} placeholder="Ej: esperando en km 10" />
          </div>
        </div></div>

        {/* Resumen informativo */}
        <div style={{border:'1px solid #e5e7eb', borderRadius:10}}><div style={{padding:12}}>
          <h3 style={{marginTop:0}}>Resumen</h3>
          <div style={{display:'grid', gridTemplateColumns:'1fr auto', gap:6}}>
            <div>Subtotal LSR</div><div>{CLP(lsrBruto)}</div>
            <div>Servicio de transporte</div><div>{CLP(transp)}</div>
            <div>Dcto. LSR aplicado</div><div>- {CLP(dctoLSR)}</div>
            <div style={{gridColumn:'1 / span 2', borderTop:'1px solid #e5e7eb'}}></div>
            <div style={{fontWeight:700}}>Total Laguna San Rafael</div><div style={{fontWeight:700}}>{CLP(totalLSR)}</div>
            <div style={{gridColumn:'1 / span 2', borderTop:'1px solid #e5e7eb'}}></div>
            <div>Subtotal Capillas</div><div>{CLP(cmBruto)}</div>
            <div>Dcto. Capillas</div><div>- {CLP(dctoCM)}</div>
            <div style={{gridColumn:'1 / span 2', borderTop:'1px solid #e5e7eb'}}></div>
            <div style={{fontWeight:900}}>Total Cotización</div><div style={{fontWeight:900}}>{CLP(totalCot)}</div>
          </div>
        </div></div>

        {/* Botón Guardar (pide motivo al hacer clic) */}
        <div style={{display:'flex', gap:8, justifyContent:'flex-end'}}>
          <button onClick={()=>{ setMotivoTmp(''); setShowMotivo(true) }}>Guardar cambios</button>
        </div>
        </>
      )}

      {/* Diálogo de eliminación */}
      {showDelete && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,.12)', display:'grid', placeItems:'center', zIndex:50}}>
          <div style={{background:'#fff', borderRadius:12, padding:16, minWidth:320, maxWidth:560, boxShadow:'0 10px 30px rgba(0,0,0,.08)'}}>
            <h3 style={{marginTop:0}}>Ingresar el motivo de eliminación</h3>
            <div>
              <input value={motivoDelete} onChange={e=>setMotivoDelete(e.target.value)} placeholder="Ej: duplicado / anulación por cliente / error de carga" />
            </div>
            <div style={{display:'flex', gap:8, justifyContent:'flex-end', marginTop:12}}>
              <button onClick={()=> setShowDelete(false)}>Cancelar</button>
              <button onClick={eliminarGrupo} style={{background:'#fee2e2', border:'1px solid #fecaca', color:'#7f1d1d'}}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* Diálogo de motivo de modificación */}
      {showMotivo && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,.12)', display:'grid', placeItems:'center', zIndex:50}}>
          <div style={{background:'#fff', borderRadius:12, padding:16, minWidth:320, maxWidth:560, boxShadow:'0 10px 30px rgba(0,0,0,.08)'}}>
            <h3 style={{marginTop:0}}>Motivo de modificación</h3>
            <div>
              <input
                value={motivoTmp}
                onChange={e=>setMotivoTmp(e.target.value)}
                placeholder="Ej: cambio de pasajero / añade transporte / corrige correo"
              />
            </div>
            <div style={{display:'flex', gap:8, justifyContent:'flex-end', marginTop:12}}>
              <button onClick={()=> setShowMotivo(false)}>Cancelar</button>
              <button onClick={()=>{
                guardarConMotivo(motivoTmp)
                setShowMotivo(false)
                setMotivoTmp('')
              }}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  function rlsr(season:'alta'|'baja', cat:'adulto'|'nino'|'infante'){
    return ratesLSR[season][cat]
  }
}
