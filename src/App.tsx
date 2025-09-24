import React, { useEffect, useMemo, useState } from 'react'
// Login de SUPABASE (email+contraseña)
import AuthLogin from './components/AuthLogin.js'
// Tu login existente de vendedor (selector con contraseña)
import VendorLogin from './components/Login'
// Cliente Supabase
import { supabase } from './supabaseClient'
import VentaView from './components/VentaView'
import PostVentaPagos from './components/PostVentaPagos'
import VisorDiario from './components/VisorDiario'
import Modificaciones from './components/Modificaciones'
import VisorMensual from './components/VisorMensual'
import BaseDatos from './components/BaseDatos'
import { MedioPago, LocalDB, Passenger, VendorKey, VoucherData, BasePasajerosRow } from './types'
import { CLP, nowISO } from './utils'
import { DEFAULT_PASSWORDS, LS_DB, LS_PASSWORDS, VENDORS, loadJSON, saveJSON } from './state'
import { printVoucher } from './printVoucher'
import { correoReservaHTML } from './emailTemplates'
import { dialogStyle, overlayStyle } from './styles'
import { LS_VISOR_FECHA } from './state'
import ConfigAvanzadas from './components/ConfigAvanzadas'
import { saveReservaEnBD } from './components/db.js'
// al inicio:
import { sendReservationEmails } from './email'
// === Registry de códigos retirados (no reutilizables) ===
const LS_ID_RETIRED = 'vg_id_retired' // Set<string> de IDs totales, ej: A2, B15...

function loadRetired(): Set<string> {
  try { return new Set<string>(JSON.parse(localStorage.getItem(LS_ID_RETIRED) || '[]')) } catch { return new Set() }
}
function saveRetired(s: Set<string>) {
  localStorage.setItem(LS_ID_RETIRED, JSON.stringify(Array.from(s)))
}


const LS_VENDOR_OVERRIDES = 'vg_vendor_overrides'
type VendorOverride = Partial<{ name:string; prefix:string; start:number; end:number }>
type VendorOverridesMap = Partial<Record<VendorKey, VendorOverride>>

function getVendorMeta(v: VendorKey | string){
  const raw = localStorage.getItem(LS_VENDOR_OVERRIDES)
  const overrides = raw ? JSON.parse(raw) as (VendorOverridesMap & Record<string, VendorOverride>) : {}

  // (3) Renombrar "javier" → "Admin" por defecto sin tocar la base
  if (!overrides['javier']) overrides['javier'] = { name: 'Admin' }

  const base = (VENDORS as any)[v]
  const ov = overrides[v as keyof typeof overrides] || {}

  if (base) return { ...base, ...ov }

  // (1) Soportar usuarios NUEVOS creados desde Config Avanzadas (no existen en VENDORS)
  return {
    name: ov.name || String(v),
    prefix: ov.prefix || String(v).charAt(0).toUpperCase(),
    start: ov.start ?? 1,
    end: ov.end ?? 999
  }
}

function usedNumbersForVendor(v: VendorKey, db: LocalDB) {
  const { prefix, start, end } = getVendorMeta(v)
  const nums = new Set<number>()
  const retired = loadRetired()

  // 1) Pasajeros
  for (const r of db.base_pasajeros) {
    const sid = r?.id == null ? '' : String(r.id)
    if (sid.startsWith(prefix)) {
      const n = parseInt(sid.slice(prefix.length), 10)
      if (Number.isFinite(n)) nums.add(n)
    }
  }

  // 2) Pagos (un código con pagos NUNCA debe reutilizarse)
  for (const p of db.base_pagos) {
    const sid = p?.id == null ? '' : String(p.id)
    if (sid.startsWith(prefix)) {
      const n = parseInt(sid.slice(prefix.length), 10)
      if (Number.isFinite(n)) nums.add(n)
    }
  }

  // 3) Historial (si existió alguna vez, tampoco se reutiliza)
  for (const h of db.history) {
    const sid = h?.id == null ? '' : String(h.id)
    if (sid.startsWith(prefix)) {
      const n = parseInt(sid.slice(prefix.length), 10)
      if (Number.isFinite(n)) nums.add(n)
    }
  }

  // 4) Retirados (códigos bloqueados explícitamente)
  for (const id of retired) {
    const sid = id == null ? '' : String(id)
    if (sid.startsWith(prefix)) {
      const n = parseInt(sid.slice(prefix.length), 10)
      if (Number.isFinite(n)) nums.add(n)
    }
  }

  return { nums, start, end, prefix }
}

function minAvailableNumber(v: VendorKey, db: LocalDB) {
  const { nums, start, end } = usedNumbersForVendor(v, db)
  for (let n = start; n <= end; n++) {
    if (!nums.has(n)) return n
  }
  return end
}

function codeFrom(v: VendorKey, n: number) {
  return `${getVendorMeta(v).prefix}${n}` // sin ceros a la izquierda
}
const LS_ADMIN_CONF = 'vg_admin_config'
type AdminRatesSeason = { adulto:number; nino:number; infante:number }
type EffectiveConfig = {
  bajaMonths: number[];        // 1..12
  altaMonths: number[];        // 1..12
  ratesLSR: { alta:AdminRatesSeason; baja:AdminRatesSeason }
  transport: { alta:number; baja:number }
  ratesPromo: { FM:AdminRatesSeason; CM:AdminRatesSeason }
  proveedores: string[]
  mediosPago: string[]         // por ahora se filtra a los admitidos por el tipo
}

/** ===== Tarifas ===== */
import { ratesLSR as defaultRatesLSR, transportPerPerson as defaultTransport, ratesPromo as defaultPromo } from './localRates'

// pegando despues del componente app
function loadEffectiveConfig(): EffectiveConfig {
  const stored = (()=>{ try{ return JSON.parse(localStorage.getItem(LS_ADMIN_CONF) || 'null') }catch{ return null } })()
  const conf: EffectiveConfig = {
    bajaMonths: stored?.bajaMonths ?? [10,11,12,3,4],
    altaMonths: stored?.altaMonths ?? [1,2],
    ratesLSR: {
      alta: stored?.ratesLSR?.alta ?? defaultRatesLSR.alta,
      baja: stored?.ratesLSR?.baja ?? defaultRatesLSR.baja,
    },
    transport: {
      alta: stored?.transport?.alta ?? defaultTransport,
      baja: stored?.transport?.baja ?? defaultTransport,
    },
    ratesPromo: {
      FM: stored?.ratesPromo?.FM ?? defaultPromo.FM,
      CM: stored?.ratesPromo?.CM ?? defaultPromo.CM,
    },
    proveedores: stored?.proveedores ?? ['Mármol Expediciones','Mármol Patagonia'],
    mediosPago: stored?.mediosPago ?? ['tarjeta','efectivo','efx','transferencia'],
  }
  return conf
}

/** getSeason usando meses de la config admin */
function getSeasonFromConfig(dateStr:string, conf:EffectiveConfig): 'alta'|'baja'{
  if (!dateStr) return 'baja'
  // Parse local y robusto: evitar que "YYYY-MM-DD" se interprete en UTC y desplace el mes
  const m = (() => {
    const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (m) return parseInt(m[2], 10) // 1..12 directo del string
    // fallback si viene con hora u otro formato:
    const d = new Date(dateStr)
    return Number.isFinite(d.getTime()) ? (d.getMonth() + 1) : 0
  })()
  return conf.altaMonths.includes(m) ? 'alta' : 'baja'
}

// pegando antes del componente app

export default function App(){
  const [user, setUser] = useState<any>(null)
  const [authReady, setAuthReady] = useState(false)
  
  useEffect(() => {
    supabase.auth.getUser().then((res: any) => {
      setUser(res?.data?.user ?? null)
      setAuthReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange(
      (_e: unknown, s: any) => {
        setUser(s?.user ?? null)
        setAuthReady(true)
      }
    )
    return () => { sub.subscription?.unsubscribe?.() }
  }, [])
  const [passwords, setPasswords] = useState<Record<VendorKey,string>>(
    loadJSON<Record<VendorKey,string>>(LS_PASSWORDS, DEFAULT_PASSWORDS)
  )

  const [db, setDb] = useState<LocalDB>(
    loadJSON<LocalDB>(LS_DB, { base_pasajeros:[], base_pagos:[], history:[] })
  )
  useEffect(()=> saveJSON(LS_PASSWORDS, passwords), [passwords])
  useEffect(()=> saveJSON(LS_DB, db), [db])

  // Detectar IDs con pagos pero sin pasajeros y marcarlos como retirados
useEffect(() => {
  const retired = loadRetired()
  const idsConPagos = new Set(db.base_pagos.map(p => p.id).filter(Boolean) as string[])
  const idsConPasajeros = new Set(db.base_pasajeros.map(r => r.id).filter(Boolean) as string[])

  for (const id of idsConPagos) {
    if (!idsConPasajeros.has(id)) retired.add(id) // pago “huérfano”: bloquear
  }
  saveRetired(retired)
}, [db.base_pagos, db.base_pasajeros])


  const saved = (localStorage.getItem('vg_vendor') as VendorKey) || null
  const [loggedVendor, setLoggedVendor] = useState<VendorKey|null>(saved)
  const [currentCode, setCurrentCode] = useState<string>('')

  const getPwd = (v:string)=> passwords[v as VendorKey] ?? DEFAULT_PASSWORDS[v as VendorKey]

  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [tab, setTab] = useState<'venta'|'postventa'|'visor'|'mensual'|'mod'|'base'|'admin'>('venta')

  const [idAction, setIdAction] = useState<{open:boolean,id:string}|null>(null)
  const [postVentaInitialId, setPostVentaInitialId] = useState<string>('')
  const [modInitialId, setModInitialId] = useState<string>('')

  // ===== Estado de Venta =====
  const [fechaLSR, setFechaLSR] = useState('')
  const [cantAdulto, setCantAdulto] = useState(0)
  const [cantNino, setCantNino] = useState(0)
  const [cantInfante, setCantInfante] = useState(0)
  const [descuentoLSR, setDescuentoLSR] = useState(0)
  const [incluyeTransporte, setIncluyeTransporte] = useState(false)

  const [promoTipo, setPromoTipo] = useState<'FM'|'CM'|undefined>(undefined)
  const [fechaPromo, setFechaPromo] = useState('')
  const [proveedor, setProveedor] = useState<string|undefined>(undefined)
  const [descuentoPromo, setDescuentoPromo] = useState(0)

  const [payments, setPayments] = useState<{ medio:MedioPago, monto:number, comprobante?:string }[]>([{ medio:'efectivo', monto:0, comprobante:'' }])
  const [observaciones, setObservaciones] = useState('')
  const [pasajeros, setPasajeros] = useState<Passenger[]>([])

  const [effectiveConf, setEffectiveConf] = React.useState(loadEffectiveConfig())
  React.useEffect(()=>{
    const onUpdate = ()=> setEffectiveConf(loadEffectiveConfig())
    window.addEventListener('vg:config-updated', onUpdate)
    window.addEventListener('storage', onUpdate) // por si cambia localStorage
    return ()=>{
      window.removeEventListener('vg:config-updated', onUpdate)
      window.removeEventListener('storage', onUpdate)
    }
  }, [])


  // 1) Si NO hay sesión de Supabase, pedir login real (email + contraseña)
  if (!authReady) {
    return <div style={{padding:20, fontFamily:'system-ui'}}>Cargando…</div>
  }
  if (!user) {
    return <AuthLogin />
  }
  if (!loggedVendor) {
    return (
      <VendorLogin
        onLogin={(v)=>{ setLoggedVendor(v as VendorKey) }}
        getPwd={getPwd}
      />
    )
  }

  function pickCodeForCommit(v: VendorKey, db: LocalDB, current: string) {
    const { nums, start, end, prefix } = usedNumbersForVendor(v, db)
    const curNum = current && current.startsWith(prefix) ? parseInt(current.slice(prefix.length), 10) : NaN
  
    // Si el "Código actual" todavía está libre, úsalo (evita que vuelva a A1)
    if (Number.isFinite(curNum) && !nums.has(curNum)) return `${prefix}${curNum}`
  
    // Si no, usa el menor disponible
    let n = start
    while (n <= end && nums.has(n)) n++
    return `${prefix}${n}`
  }
  

  function resetSaleFields(){
    setFechaLSR(''); setCantAdulto(0); setCantNino(0); setCantInfante(0)
    setDescuentoLSR(0); setIncluyeTransporte(false)
    setPromoTipo(undefined); setFechaPromo(''); setProveedor(undefined); setDescuentoPromo(0)
    setObservaciones(''); setPayments([{ medio:'efectivo', monto:0, comprobante:'' }]); setPasajeros([])
  }

  function beginNewSaleWithUniqueCode(v: VendorKey){
    const { nums, start, end, prefix } = usedNumbersForVendor(v, db)
  
    // Elegir SIEMPRE el menor libre, SIN considerar currentCode
    let n = start
    while (n <= end && nums.has(n)) n++
    const code = `${prefix}${n}`
  
    setCurrentCode(code)
    resetSaleFields()
  }
  

  function goToVisorDiarioWithDate(isoDate: string){
    try{ saveJSON(LS_VISOR_FECHA, isoDate) }catch{}
    setTab('visor')
  }

  useEffect(()=>{ if(loggedVendor && !currentCode){ beginNewSaleWithUniqueCode(loggedVendor) } }, [loggedVendor])

  const totalPersonas = cantAdulto + cantNino + cantInfante
  useEffect(()=>{
    setPasajeros(prev=>{
      const arr = [...prev]
      while(arr.length < totalPersonas){ arr.push({nombre:'', doc:'', nacionalidad:'', telefono:'', email:'', categoria:'adulto', capillas:false, grupo:''}) }
      while(arr.length > totalPersonas){ arr.pop() }
      let a = cantAdulto, n = cantNino, i = cantInfante
      return arr.map(p=>{
        if(a>0){ a--; return {...p, categoria:'adulto' as const} }
        if(n>0){ n--; return {...p, categoria:'nino' as const} }
        if(i>0){ i--; return {...p, categoria:'infante' as const} }
        return p
      })
    })
  }, [cantAdulto, cantNino, cantInfante, totalPersonas])

  useEffect(()=>{ if(!promoTipo) setPasajeros(prev=> prev.map(p=> ({...p, capillas:false}))) }, [promoTipo])

  useEffect(() => {
    function onNewSale(e: any) {
    const dateISO = e?.detail?.dateISO as string | undefined
    if (!loggedVendor || !dateISO) return
    // Iniciar venta nueva, limpiar y precargar fecha
    beginNewSaleWithUniqueCode(loggedVendor)
    setFechaLSR(dateISO)
    setTab('venta')
  }
  window.addEventListener('vg:new-sale', onNewSale as any)
  return () => window.removeEventListener('vg:new-sale', onNewSale as any)
}, [loggedVendor])

  const season = getSeasonFromConfig(fechaLSR, effectiveConf)
  const r = (effectiveConf.ratesLSR as any)[season]
  const infantesLiberados = Math.min(cantInfante, 1)
  const infantesCobradosComoNino = Math.max(0, cantInfante - 1)

  const lsrSubtotal = (cantAdulto * r.adulto) + ((cantNino + infantesCobradosComoNino) * r.nino) + (infantesLiberados * r.infante)
  const lsrDctoAplicado = Math.min(descuentoLSR, lsrSubtotal)
  const lsrTotal = Math.max(0, lsrSubtotal - lsrDctoAplicado)
  const perPersonTransport = (effectiveConf.transport as any)[season]
  const transporteTotal = incluyeTransporte ? totalPersonas * perPersonTransport : 0

  const capillasCount = useMemo(()=> pasajeros.reduce((acc,p)=>{ if(p.capillas && promoTipo) (acc as any)[p.categoria]+=1; return acc },
    {adulto:0, nino:0, infante:0} as {adulto:number, nino:number, infante:number}), [pasajeros, promoTipo])

  const promoR = promoTipo ? effectiveConf.ratesPromo[promoTipo] : null
  const promoSubtotal = promoR ? (capillasCount.adulto*promoR.adulto + capillasCount.nino*promoR.nino + capillasCount.infante*promoR.infante) : 0
  const promoDctoAplicado = Math.min(descuentoPromo, promoSubtotal)
  const promoTotal = Math.max(0, promoSubtotal - promoDctoAplicado)

  const totalLSRConTransporte = lsrTotal + transporteTotal
  const totalCotizacion = totalLSRConTransporte + promoTotal
  const totalPagado = payments.reduce((acc,p)=> acc + (p.monto||0), 0)
  const saldo = Math.max(0, totalCotizacion - totalPagado)

  function nextGroupForDate(fecha: string): string {
    if(!fecha) return ''
    const used = new Set(
      db.base_pasajeros
        .filter(r=> (r.fecha_lsr||'') === fecha )
        .map(r=> parseInt(String(r.ng || '0'), 10))
        .filter(n=> Number.isFinite(n) && n>0)
    )
    let i = 1
    while(used.has(i)) i++
    return String(i)
  }
  
  const ngPreview = fechaLSR ? nextGroupForDate(fechaLSR) : '—'

  const snapshotVoucher = (code:string): VoucherData => ({
    codigo: code,
    vendedor: getVendorMeta(loggedVendor!).name,
    fechaLSR,
    fechaPromo,
    lsrSubtotal,
    lsrDcto: lsrDctoAplicado,
    transporte: transporteTotal,
    totalLSR: totalLSRConTransporte,
    promoTipo,
    promoSubtotal,
    promoDcto: promoDctoAplicado,
    totalPromo: promoTotal,
    totalCotizacion,
    pagado: totalPagado,
    saldo,
    pasajeros,
    observaciones,
  })

  function validarReservaCompleta(){
    const errs:string[] = []
    const hayCapillas = pasajeros.some(p=>p.capillas)
    if(hayCapillas){
      if(!promoTipo) errs.push('Debes seleccionar tipo de Capillas (FM/CM).')
      if(!fechaPromo) errs.push('Debes indicar la fecha de Capillas.')
    }
    if((totalPersonas||0) <= 0) errs.push('Debes ingresar al menos 1 pasajero.')
    if(!fechaLSR) errs.push('Debes indicar Fecha LSR para asignar grupo.')
    if(payments.some(p => (p.monto??0) < 0)) errs.push('Revisa montos de pago (no pueden ser negativos en la creación).')
    return errs
  }

  function pushBasePasajeros(estado:'pre-reserva'|'reserva', idCode: string){
    const promoR2 = promoTipo ? effectiveConf.ratesPromo[promoTipo] : null
    const ng = nextGroupForDate(fechaLSR || '')
    const tr: 'si'|'no' = incluyeTransporte ? 'si' : 'no'
  
    const rows: BasePasajerosRow[] = pasajeros.map(p=>{
      const lsr_valor = p.categoria==='adulto' ? r.adulto : p.categoria==='nino' ? r.nino : r.infante
      const transp_valor = incluyeTransporte ? perPersonTransport : 0
      const cm_val = p.capillas && promoR2 ? (p.categoria==='infante' ? promoR2.infante : p.categoria==='nino' ? promoR2.nino : promoR2.adulto) : 0
      const cm_cat: 'adulto'|'infante'|'' = p.capillas ? (p.categoria==='infante' ? 'infante' : 'adulto') : ''
  
      return {
        createdAt: nowISO(),
        estado,
        vendedor: getVendorMeta(loggedVendor!).name,
        id: idCode,
        ng,
        nombre: p.nombre, doc: p.doc, nacionalidad: p.nacionalidad, telefono: p.telefono, email: p.email,
        lsr_categoria: p.categoria, transporte: tr,
        lsr_valor, transp_valor, lsr_descuento: lsrDctoAplicado,
        cm_categoria: cm_cat, proveedor: proveedor || '', fecha_cm: fechaPromo || '',
        cm_valor: cm_val, cm_descuento: promoDctoAplicado,
        observaciones, fecha_lsr: fechaLSR || ''
      }
    })
    setDb(prev => ({...prev, base_pasajeros: [...prev.base_pasajeros, ...rows]}))
    setPasajeros(prev => prev.map(p=> ({...p, grupo: ng})))
  }
  
  function pushBasePagos(idCode: string){
    const rows = payments
      .filter(p => (p.monto||0) > 0)
      .map(p => ({ createdAt: nowISO(), vendedor: getVendorMeta(loggedVendor!).name, id: idCode, medio: p.medio, monto: p.monto||0, comprobante: p.comprobante || '' }))
    if(rows.length){ setDb(prev => ({...prev, base_pagos: [...prev.base_pagos, ...rows]})) }
  }
  
  function pushHistory(idCode: string, snapshot: VoucherData){
    setDb(prev => ({...prev, history: [{vendedor: loggedVendor!, id: idCode, snapshot, createdAt: nowISO()}, ...prev.history].slice(0,50)}))
  }
  

  function ingresarPreReserva(){
    if(!fechaLSR){ alert('Debes indicar Fecha LSR para asignar el grupo.'); return }
    if((totalPersonas||0) <= 0){ alert('Debes ingresar al menos 1 pasajero.'); return }
  
    const idCode = pickCodeForCommit(loggedVendor!, db, currentCode)
  
    pushBasePasajeros('pre-reserva', idCode)
    pushBasePagos(idCode)
    const snap = snapshotVoucher(idCode); pushHistory(idCode, snap)
  
    alert(`Pre-reserva ingresada: ${idCode}\n\nGrupo asignado para ${fechaLSR}: ${nextGroupForDate(fechaLSR)}`)
    beginNewSaleWithUniqueCode(loggedVendor!)
  }
  
  function ingresarReserva(){
    const errs = validarReservaCompleta()
    if(errs.length){ alert('Corrige:\n\n- ' + errs.join('\n- ')); return }
  
    const idCode = pickCodeForCommit(loggedVendor!, db, currentCode)
  
    pushBasePasajeros('reserva', idCode)
    pushBasePagos(idCode)
    const snap = snapshotVoucher(idCode); pushHistory(idCode, snap)
  
    const correo = `Estimado/a,
  Gracias por su reserva a Laguna San Rafael.
  
  Código: ${idCode}
  Vendedor: ${VENDORS[loggedVendor!].name}
  Fecha LSR: ${fechaLSR || '(por definir)'}
  
  TOTAL COTIZACIÓN: ${CLP(totalCotizacion)}
  PAGADO: ${CLP(payments.reduce((a,p)=>a+(p.monto||0),0))}
  SALDO: ${CLP(Math.max(0, totalCotizacion - payments.reduce((a,p)=>a+(p.monto||0),0)))}
  
  Atentamente,
  Equipo ValleGlaciares`
  
    alert(`Reserva creada: ${idCode}\n\nSe enviaría este correo:\n\n${correo}`)
    beginNewSaleWithUniqueCode(loggedVendor!)
  }
  
  async function ingresarReservaConCorreo(){
  const errs = validarReservaCompleta()
  if (errs.length) {
    alert(`Corrige:\n\n- ${errs.join('\n- ')}`)
    return
  }

  // 1) Guardar la reserva (igual que antes)
  const idCode = pickCodeForCommit(loggedVendor!, db, currentCode)
  pushBasePasajeros('reserva', idCode)
  pushBasePagos(idCode)
  const snap = snapshotVoucher(idCode)
  pushHistory(idCode, snap)

  // 1.b) Guardar en Supabase
  try {
    const { data: { user: u } } = await supabase.auth.getUser()
  if (!u) {
    alert('Debes iniciar sesión para guardar la reserva en la base de datos.')
  } else {
    await saveReservaEnBD(snap, u.id)
  }
} catch (e:any) {
  console.error('Error al guardar en BD', e)
  alert('Reserva ingresada, pero no se pudo guardar en la base de datos.')
}

  // 2) Construir correo
  const primer = snap.pasajeros[0]
  const to = (primer?.email || '').trim()
  const subject = 'Bienvenido a la Patagonia, tu reserva se ha gestionado con éxito'
  const html = correoReservaHTML(snap)

  // 3) Enviar correo (API Vercel)
  try {
    const cc = ['info@valleglaciares.com','oficina@valleglaciares.com']  // ← CC
    const resp = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ to, subject, html, cc })
    })

    const data = await resp.json()
    if(!resp.ok || !data?.ok){
      console.error('Error al enviar correo', data)
      alert(`Reserva ingresada (${idCode}), pero hubo un error enviando el correo.\nPuedes reenviar desde Post-Venta.`)
    }else{
      alert(`Reserva ingresada y correo enviado a ${to || 'cliente'}.\nCódigo: ${idCode}\nGrupo ${nextGroupForDate(snap.fechaLSR || '')}`)
    }
  } catch (e:any){
    console.error('Fallo de red/servidor al enviar correo', e)
    alert(`Reserva ingresada (${idCode}), pero no fue posible contactar el servidor de correo.`)
  }

  // 4) Avanzar al siguiente código
  beginNewSaleWithUniqueCode(loggedVendor!)
}

  const onLogout = async ()=>{ 
    localStorage.removeItem('vg_vendor')
    await supabase.auth.signOut()
    location.reload()
  }

  function computeSummaryForId(id:string){
    const rows = db.base_pasajeros.filter(r=> r.id===id)
    if(!rows.length) return null
    const lsrBruto = rows.reduce((acc,r)=> acc + (r.lsr_valor||0), 0)
    const lsrDesc = rows.length ? (rows[0].lsr_descuento||0) : 0
    const transp = rows.reduce((acc,r)=> acc + (r.transp_valor||0), 0)
    const cmBruto = rows.reduce((acc,r)=> acc + (r.cm_valor||0), 0)
    const cmDesc = rows.length ? (rows[0].cm_descuento||0) : 0
    const totalLSR = Math.max(0, lsrBruto - lsrDesc) + transp
    const totalCapillas = Math.max(0, cmBruto - cmDesc)
    const totalCot = totalLSR + totalCapillas
    const pagos = db.base_pagos.filter(p=> p.id===id).reduce((a,p)=> a + (p.monto||0), 0)
    const saldo = totalCot - pagos
    const counts = rows.reduce((acc:any,r)=>{ acc.total++; acc[r.lsr_categoria]++; return acc }, {total:0, adulto:0, nino:0, infante:0})
    return {
      id,
      fechaLSR: rows[0].fecha_lsr || '',
      vendedorOriginal: rows[0].vendedor || '',
      ng: rows[0].ng || '',
      counts,
      totalLSR, lsrBruto, lsrDesc, transp,
      totalCapillas, cmBruto, cmDesc,
      totalCot, pagado: pagos, saldo
    }
  }
  const idSummary = React.useMemo(()=>{
    if(!idAction?.open) return null
    return computeSummaryForId(idAction.id)
    // recomputar cuando cambien pagos o pasajeros
  }, [idAction, db.base_pagos, db.base_pasajeros])
  
  const nextCodePreview = React.useMemo(() => {
    if (!loggedVendor) return ''
    // Mostrar SIEMPRE el menor libre según la base (sin mirar currentCode)
    const { nums, start, end, prefix } = usedNumbersForVendor(loggedVendor, db)
    let n = start
    while (n <= end && nums.has(n)) n++
    return `${prefix}${n}`
  }, [loggedVendor, db.base_pasajeros, db.base_pagos, db.history])
  

  return (
    <div style={{padding:16, maxWidth: '100%', margin:'0 auto'}}>
      <div style={{display:'flex', gap:12, alignItems:'center', justifyContent:'space-between', marginBottom:12}}>
        <div style={{color:'#4b5563', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
        Conectado como <b>{getVendorMeta(loggedVendor!).name}</b> · Código Siguiente Reserva <b>{nextCodePreview}</b>  
        </div>
        <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
          <button onClick={()=> setShowSettings(true)}>⚙️ Ajustes</button>
          <button onClick={onLogout}>Cerrar sesión</button>
        </div>
      </div>

      <div style={{border:'1px solid #e5e7eb', borderRadius:10, padding:8, marginBottom:12, display:'flex', gap:8, flexWrap:'wrap'}}>
       <button onClick={()=>setTab('venta')} style={{fontWeight: tab==='venta'?700:400}}>Ingreso de venta</button>
        <button onClick={()=>setTab('postventa')} style={{fontWeight: tab==='postventa'?700:400}}>Post-venta: Pagos/Reembolsos</button>
        <button onClick={()=>setTab('visor')} style={{fontWeight: tab==='visor'?700:400}}>Visor diario</button>
        <button onClick={()=>setTab('mensual')} style={{fontWeight: tab==='mensual'?700:400}}>Visor mensual</button>
        <button onClick={()=>setTab('mod')} style={{fontWeight: tab==='mod'?700:400}}>Modificaciones</button>
        <button onClick={()=>setTab('base')} style={{fontWeight: tab==='base'?700:400}}>Base de datos</button>
        {(getVendorMeta(loggedVendor!).name === 'Admin' || loggedVendor === 'javier') && (
           <button onClick={()=>setTab('admin')} style={{fontWeight: tab==='admin'?700:400}}>Configuraciones avanzadas</button>
           )}
      </div>

      {tab==='venta' ? (
        <VentaView
          fechaLSR={fechaLSR} setFechaLSR={setFechaLSR}
          cantAdulto={cantAdulto} setCantAdulto={setCantAdulto}
          cantNino={cantNino} setCantNino={setCantNino}
          cantInfante={cantInfante} setCantInfante={setCantInfante}
          descuentoLSR={descuentoLSR} setDescuentoLSR={setDescuentoLSR}
          incluyeTransporte={incluyeTransporte} setIncluyeTransporte={setIncluyeTransporte}
          promoTipo={promoTipo} setPromoTipo={setPromoTipo}
          fechaPromo={fechaPromo} setFechaPromo={setFechaPromo}
          proveedor={proveedor} setProveedor={setProveedor}
          descuentoPromo={descuentoPromo} setDescuentoPromo={setDescuentoPromo}
          payments={payments} setPayments={setPayments}
          observaciones={observaciones} setObservaciones={setObservaciones}
          pasajeros={pasajeros} setPasajeros={setPasajeros}
          totalPersonas={totalPersonas}
          season={season as any}
          snapshotVoucher={() => snapshotVoucher(currentCode)}
          ingresarPreReserva={ingresarPreReserva}
          ingresarReserva={ingresarReserva}
          ingresarReservaConCorreo={ingresarReservaConCorreo}
          totalPagado={totalPagado}
          lsrSubtotal={lsrSubtotal}
          transporteTotal={transporteTotal}
          lsrDctoAplicado={lsrDctoAplicado}
          totalLSRConTransporte={totalLSRConTransporte}
          promoSubtotal={promoSubtotal}
          promoDctoAplicado={promoDctoAplicado}
          promoTotal={promoTotal}
          totalCotizacion={totalCotizacion}
          saldo={saldo}
          ngPreview={ngPreview}
          ratesLSR={effectiveConf.ratesLSR}
          transportPerPerson={(effectiveConf.transport as any)[season]}
          openClearConfirm={()=> setShowClearConfirm(true)}
          proveedores={effectiveConf.proveedores}
          mediosPago={effectiveConf.mediosPago}

        />
      ) : tab==='postventa' ? (
        <PostVentaPagos
          db={db}
          onAddPago={(row)=> setDb(prev=> ({...prev, base_pagos: [...prev.base_pagos, row]}))}
          vendedorActual={getVendorMeta(loggedVendor!).name}
          computeSummaryForId={computeSummaryForId}
          initialId={postVentaInitialId}
          onConsumedInitial={()=> setPostVentaInitialId('')}
          mediosPago={effectiveConf.mediosPago}

        />
        ) : tab==='visor' ? (
          <VisorDiario
            db={db}
            computeSummaryForId={computeSummaryForId}
            onClickId={(id)=> setIdAction({open:true, id})}
          />
        ) : tab==='mensual' ? (
          <VisorMensual
          db={db}
          onGoToVisorDiario={goToVisorDiarioWithDate}
          />          
        ) : tab==='mod' ? (
          <Modificaciones
            db={db}
            setDb={setDb}
            vendedorActual={getVendorMeta(loggedVendor!).name}
            initialId={modInitialId}
            onConsumedInitial={()=> setModInitialId('')}
            ratesLSR={effectiveConf.ratesLSR}
            ratesPromo={effectiveConf.ratesPromo}
            transportPerPerson={(effectiveConf.transport as any)['alta']} // NO: ver nota abajo
            getSeasonFn={(d)=> getSeasonFromConfig(d, effectiveConf)}
            proveedores={effectiveConf.proveedores}
          />
        ) : tab==='admin' ? (
          <ConfigAvanzadas 
          />
        ) : (
          <BaseDatos db={db}
          />
      )}
      {showClearConfirm && (
        <div style={overlayStyle}><div style={dialogStyle}>
          <h2 style={{marginTop:0}}>Limpiar formulario</h2>
          <div style={{color:'#374151', fontSize:14, marginBottom:14}}>¿Está seguro que desea borrar las entradas y generar una nueva venta?</div>
          <div style={{display:'flex', gap:8, justifyContent:'flex-end'}}>
            <button onClick={()=> setShowClearConfirm(false)}>No</button>
            <button onClick={()=>{ beginNewSaleWithUniqueCode(loggedVendor!); setShowClearConfirm(false); }}>Sí</button>
          </div>
        </div></div>
      )}

{idAction?.open && (
  <div style={overlayStyle}><div style={dialogStyle}>
    <h3 style={{marginTop:0}}>Acción para ID {idAction.id}</h3>

    {/* Resumen financiero del ID */}
    {idSummary ? (
      <div style={{border:'1px solid #e5e7eb', borderRadius:10, padding:12, margin:'8px 0 12px'}}>
        <div style={{display:'grid', gridTemplateColumns:'1fr auto', gap:6}}>
          <div style={{fontWeight:700, margin:'6px 0 2px'}}>Laguna San Rafael</div><div></div>
          <div>LSR bruto</div><div>{CLP(idSummary.lsrBruto)}</div>
          <div>Transporte</div><div>{CLP(idSummary.transp)}</div>
          <div>Descuento LSR</div><div>- {CLP(idSummary.lsrDesc)}</div>
          <div style={{gridColumn:'1 / span 2', borderTop:'1px solid #e5e7eb'}}></div>
          <div style={{fontWeight:700}}>Total LSR</div><div style={{fontWeight:700}}>{CLP(idSummary.totalLSR)}</div>

          <div style={{gridColumn:'1 / span 2', borderTop:'2px dashed #e5e7eb', margin:'6px 0'}}></div>

          <div style={{fontWeight:700, margin:'6px 0 2px'}}>Capillas de Mármol</div><div></div>
          <div>Capillas bruto</div><div>{CLP(idSummary.cmBruto)}</div>
          <div>Descuento Capillas</div><div>- {CLP(idSummary.cmDesc)}</div>
          <div style={{gridColumn:'1 / span 2', borderTop:'1px solid #e5e7eb'}}></div>
          <div style={{fontWeight:700}}>Total Capillas</div><div style={{fontWeight:700}}>{CLP(idSummary.totalCapillas)}</div>

          <div style={{gridColumn:'1 / span 2', borderTop:'2px solid #e5e7eb', margin:'6px 0'}}></div>

          <div style={{fontWeight:900}}>Total Cotización</div><div style={{fontWeight:900}}>{CLP(idSummary.totalCot)}</div>
          <div>Pagado</div><div>{CLP(idSummary.pagado)}</div>
          <div style={{fontWeight:800}}>Saldo</div><div style={{fontWeight:800}}>{CLP(idSummary.saldo)}</div>
        </div>
      </div>
    ) : (
      <div style={{color:'#6b7280', margin:'6px 0 12px'}}>Sin resumen disponible.</div>
    )}

    <div style={{display:'flex', gap:8, justifyContent:'flex-end'}}>
      <button onClick={()=>{
        setPostVentaInitialId(idAction.id)
        setIdAction(null)
        setTab('postventa')
      }}>Ir a pagos</button>
      <button onClick={()=>{
        setIdAction(null)
        setModInitialId(idAction.id)
        setTab('mod')
      }}>Ir a modificar</button>
      <button onClick={()=> setIdAction(null)}>Cancelar</button>
    </div>
  </div></div>
)}

      {showSettings && (
        <div style={overlayStyle}><div style={dialogStyle}>
          <h2 style={{marginTop:0}}>Ajustes de usuario</h2>
          <div style={{color:'#6b7280'}}>Vendedor: <b>{VENDORS[loggedVendor!].name}</b></div>
          <div style={{marginTop:10}}>
            <label>Nueva contraseña</label>
            <input type="password" onChange={e=> setPasswords(prev=> ({...prev, [loggedVendor!]: e.target.value || '1234'}))}/>
          </div>
          <div style={{display:'flex', gap:8, justifyContent:'flex-end', marginTop:12}}>
            <button onClick={()=> setShowSettings(false)}>Cerrar</button>
          </div>
        </div></div>
      )}
    </div>
  )
}