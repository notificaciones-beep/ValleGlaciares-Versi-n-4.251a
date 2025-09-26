// src/components/ConfigAvanzadas.tsx
import React from 'react'
import { VENDORS, LS_PASSWORDS, DEFAULT_PASSWORDS } from '../state'
import { supabase } from '../supabaseClient' 

/** ────────────────────────────────────────────────────────────────────────────
 *  Constantes de storage y tipos locales
 *  ───────────────────────────────────────────────────────────────────────── */
const LS_ADMIN_CONF = 'vg_admin_config'

const LS_VENDOR_OVERRIDES = 'vg_vendor_overrides'

function readOverrides(): Record<string, Partial<{ name:string; prefix:string; start:number; end:number }>> {
  try { return JSON.parse(localStorage.getItem(LS_VENDOR_OVERRIDES) || '{}') } catch { return {} }
}

function resetPasswordToDefault(k:string, nombreVisible:string){
  const map = readPwMap()
  map[k] = '1234'
  writePwMap(map)
  alert(`Contraseña de "${nombreVisible}" reiniciada a 1234.`)
}

function deleteVendor(key:string, nombreVisible:string){
  // Por seguridad: no permitir borrar perfiles base definidos en VENDORS
  if ((VENDORS as any)[key]) {
    alert('No se puede eliminar un perfil base. Solo se pueden eliminar perfiles agregados desde Configuraciones Avanzadas.')
    return
  }

  if (!confirm(`¿Eliminar el perfil "${nombreVisible}" (${key})? También se eliminará su contraseña.`)) return

  // 1) Remover de overrides (oculta el perfil)
  const overrides = loadVendorOverrides()
  delete (overrides as any)[key]
  saveVendorOverrides(overrides)



  // 2) Remover su contraseña almacenada
  const pw = readPwMap()
  if (key in pw) {
    delete pw[key]
    writePwMap(pw)
  } else {
    // Fuerza re-render en Login/otras vistas
    window.dispatchEvent(new Event('storage'))
  }

  alert(`Perfil "${nombreVisible}" eliminado.`)
}


function readPwMap(): Record<string,string> {
  try {
    return JSON.parse(localStorage.getItem(LS_PASSWORDS) || 'null') || { ...DEFAULT_PASSWORDS }
  } catch {
    return { ...DEFAULT_PASSWORDS }
  }
}
function writePwMap(next: Record<string,string>) {
  localStorage.setItem(LS_PASSWORDS, JSON.stringify(next))
  window.dispatchEvent(new Event('storage'))
}


function writeOverrides(next: Record<string, Partial<{ name:string; prefix:string; start:number; end:number }>>) {
  localStorage.setItem(LS_VENDOR_OVERRIDES, JSON.stringify(next))
  // Notificar a Login (y otros) que hay cambios
  window.dispatchEvent(new Event('storage'))
}


type Season = 'alta' | 'baja'
type Rate3 = { adulto:number; nino:number; infante:number }
type EffectiveConfig = {
  bajaMonths: number[]   // 1..12
  altaMonths: number[]   // 1..12
  ratesLSR: { alta:Rate3; baja:Rate3 }
  transport: { alta:number; baja:number }
  ratesPromo: { FM:Rate3; CM:Rate3 }
  proveedores: string[]
  mediosPago: string[]
}

type VendorOverride = Partial<{ name:string; prefix:string; start:number; end:number }>
type VendorOverridesMap = Record<string, VendorOverride>

function addNewVendor() {
  const key = prompt('ID interno del usuario (ej: ana, ventas1). Usar minúsculas y sin espacios:')?.trim()
  if (!key) return

  const overrides = loadVendorOverrides()
  if (overrides[key]) {
    alert(`Ya existe un usuario con ID "${key}".`)
    return
  }

  const name = prompt('Nombre visible (ej: Ana / Ventas 1):')?.trim() || key
  const prefix = (prompt('Prefijo de códigos (ej: A, B, V):')?.trim() || (key[0] || 'X')).toUpperCase()
  const startStr = prompt('Inicio de rango (número):')?.trim() || '1'
  const endStr = prompt('Fin de rango (número):')?.trim() || '999'
  const start = Math.max(1, parseInt(startStr, 10) || 1)
  const end = Math.max(start, parseInt(endStr, 10) || 999)

  // Validación rápida de prefijo duplicado (opcional)
  for (const [k, ov] of Object.entries(overrides)) {
    if ((ov.prefix || '').toUpperCase() === prefix) {
      const cont = confirm(`El prefijo "${prefix}" ya lo usa "${k}". ¿Deseas continuar?`)
      if (!cont) return
      break
    }
  }

  // Guardar override local
  overrides[key] = { name, prefix, start, end }
  saveVendorOverrides(overrides)

  // Crear contraseña (pedida o por defecto 1234)
  const pwInput = prompt('Define una contraseña inicial (deja vacío para 1234):') ?? ''
  const pw = pwInput.trim() || '1234'
  const pwMap = readPwMap()
  pwMap[key] = pw
  writePwMap(pwMap)

  alert(`Usuario creado: ${name} (${key}). Contraseña inicial: ${pw === '1234' ? '1234 (por defecto)' : 'definida'}`)
}



/** ────────────────────────────────────────────────────────────────────────────
 *  Helpers de persistencia
 *  ───────────────────────────────────────────────────────────────────────── */
function loadAdminConfig(): EffectiveConfig {
  try{
    const stored = JSON.parse(localStorage.getItem(LS_ADMIN_CONF) || 'null')
    const defaults: EffectiveConfig = {
      bajaMonths: [10,11,12,3,4],
      altaMonths: [1,2],
      ratesLSR: {
        alta: { adulto:155000, nino:90000, infante:0 },
        baja: { adulto:145000, nino:80000, infante:0 },
      },
      transport: { alta:25000, baja:25000 },
      ratesPromo: {
        FM: { adulto:28000, nino:28000, infante:28000 },
        CM: { adulto:15000, nino:15000, infante:15000 },
      },
      proveedores: ['Mármol Expediciones','Mármol Patagonia'],
      mediosPago: ['tarjeta','efectivo','efx','transferencia'],
    }
    if(!stored) return defaults
    return {
      bajaMonths: Array.isArray(stored.bajaMonths) ? stored.bajaMonths : defaults.bajaMonths,
      altaMonths: Array.isArray(stored.altaMonths) ? stored.altaMonths : defaults.altaMonths,
      ratesLSR: {
        alta: stored?.ratesLSR?.alta ?? defaults.ratesLSR.alta,
        baja: stored?.ratesLSR?.baja ?? defaults.ratesLSR.baja,
      },
      transport: {
        alta: Number.isFinite(stored?.transport?.alta) ? stored.transport.alta : defaults.transport.alta,
        baja: Number.isFinite(stored?.transport?.baja) ? stored.transport.baja : defaults.transport.baja,
      },
      ratesPromo: {
        FM: stored?.ratesPromo?.FM ?? defaults.ratesPromo.FM,
        CM: stored?.ratesPromo?.CM ?? defaults.ratesPromo.CM,
      },
      proveedores: Array.isArray(stored?.proveedores) ? stored.proveedores : defaults.proveedores,
      mediosPago: Array.isArray(stored?.mediosPago) ? stored.mediosPago : defaults.mediosPago,
    }
  }catch{
    return {
      bajaMonths: [10,11,12,3,4],
      altaMonths: [1,2],
      ratesLSR: {
        alta: { adulto:155000, nino:90000, infante:0 },
        baja: { adulto:145000, nino:80000, infante:0 },
      },
      transport: { alta:25000, baja:25000 },
      ratesPromo: {
        FM: { adulto:28000, nino:28000, infante:28000 },
        CM: { adulto:15000, nino:15000, infante:15000 },
      },
      proveedores: ['Mármol Expediciones','Mármol Patagonia'],
      mediosPago: ['tarjeta','efectivo','efx','transferencia'],
    }
  }
}

function saveAdminConfig(conf: EffectiveConfig){
  localStorage.setItem(LS_ADMIN_CONF, JSON.stringify(conf))
  window.dispatchEvent(new Event('vg:config-updated'))
}

function loadVendorOverrides(): VendorOverridesMap {
  try{
    return JSON.parse(localStorage.getItem(LS_VENDOR_OVERRIDES) || '{}')
  }catch{
    return {}
  }
}

function saveVendorOverrides(map: VendorOverridesMap){
  localStorage.setItem(LS_VENDOR_OVERRIDES, JSON.stringify(map))
  window.dispatchEvent(new Event('vg:config-updated'))
}

async function loadConfigFromDB() {
  const { data, error } = await supabase
    .from('config_admin')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

async function saveConfigToDB(payload: {
  baja_months:number[]; alta_months:number[];
  rates_lsr:any; transport:any; rates_promo:any;
  proveedores:string[]; medios_pago:string[];
}) {
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase.from('config_admin').insert({
    ...payload,
    updated_by: user?.id ?? null
  })
  if (error) throw error
}

async function loadOverridesFromDB() {
  const { data, error } = await supabase
    .from('vendor_overrides')
    .select('vendor_key,name,prefix,range_start,range_end')
  if (error) throw error
  return data || []
}

async function replaceAllOverridesInDB(overrides: Record<string, Partial<{ name:string; prefix:string; start:number; end:number }>>) {
  const { data: { user } } = await supabase.auth.getUser()

  // upsert por vendor_key (índice único)
  const rows = Object.entries(overrides).map(([vendor_key, ov]) => ({
    vendor_key,
    name: ov.name ?? null,
    prefix: ov.prefix ?? null,
    range_start: ov.start ?? null,
    range_end: ov.end ?? null,
    updated_by: user?.id ?? null
  }))
  if (!rows.length) return

  const { error } = await supabase
    .from('vendor_overrides')
    .upsert(rows, { onConflict: 'vendor_key' })
  if (error) throw error
}

/** ────────────────────────────────────────────────────────────────────────────
 *  Subcomponente: Perfiles (existentes)
 *  ───────────────────────────────────────────────────────────────────────── */
function PerfilesExistentes(){
  const [overrides, setOverrides] = React.useState<VendorOverridesMap>(loadVendorOverrides())

  // Base restringida: SOLO 'javier' si existe en VENDORS
  const baseKeys = (Object.prototype.hasOwnProperty.call(VENDORS, 'javier') ? ['javier'] : [])
  
  // Unimos 'javier' + todos los perfiles nuevos (overrides)
  const allKeys: string[] = Array.from(new Set([...baseKeys, ...Object.keys(overrides)]))
  
  const rows = allKeys.map(k=>{
    const base = (VENDORS as any)[k] || { name:k, prefix:(k[0]||'X').toUpperCase(), start:1, end:999 }
    const ov   = overrides[k as keyof typeof overrides] || {}
  
    // Renombre por defecto: 'javier' -> 'Admin' si no hay override de nombre
    const displayName = (k === 'javier' && !('name' in ov)) ? 'Admin' : (ov.name ?? base.name)
  
    return {
      key: k,
      name: displayName,
      prefix: ov.prefix ?? base.prefix,
      start: ov.start ?? base.start,
      end: ov.end ?? base.end,
    }
  })
  
  const update = (k:string, patch:Partial<{name:string;prefix:string;start:number;end:number}>)=>{
    setOverrides(prev=>{
      const next = {...prev}
      next[k as keyof typeof next] = {...(next[k as keyof typeof next]||{}), ...patch}
      return next
    })
  }


  const guardar = async ()=>{
    for(const r of rows){
      if(!r.name.trim()){ alert(`Nombre vacío en perfil ${r.key}`); return }
      if(!r.prefix.trim()){ alert(`Prefijo vacío en perfil ${r.key}`); return }
      const s = Number(r.start), e = Number(r.end)
      if(!(Number.isFinite(s) && Number.isFinite(e) && s>0 && e>=s)){
        alert(`Rango inválido en perfil ${r.key}`); return
      }
    }
    try{
      // 1) BD (si hay sesión)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await replaceAllOverridesInDB(overrides) // upsert por vendor_key
      }
      // 2) Espejo local
      saveVendorOverrides(overrides)
      alert('Perfiles guardados.')
    }catch(e:any){
      alert('Perfiles guardados localmente, pero falló la BD: ' + (e?.message || e))
    }
  }

  const inputStyle: React.CSSProperties = { padding:'6px 8px', border:'1px solid #e5e7eb', borderRadius:8 }

  return (
    <div style={{border:'1px solid #e5e7eb', borderRadius:12, padding:12, display:'grid', gap:10}}>
      <h3 style={{margin:0}}>Perfiles (existentes)</h3>
      <div style={{display:'grid', gridTemplateColumns:'1fr 100px 100px 100px auto', gap:8, alignItems:'center'}}>
        <div className="muted">Nombre visible</div>
        <div className="muted">Prefijo</div>
        <div className="muted">Inicio</div>
        <div className="muted">Fin</div>
        <div className="muted">Acciones</div>


        {rows.map(r=>(
  <React.Fragment key={r.key}>
    <input style={inputStyle}
           value={r.name}
           onChange={e=>update(r.key, {name:e.target.value})}
           placeholder="Nombre visible"/>
    <input style={{...inputStyle, textTransform:'uppercase'}}
           value={r.prefix}
           onChange={e=>update(r.key, {prefix:e.target.value.toUpperCase()})}/>
    <input style={inputStyle}
           type="number" value={r.start}
           onChange={e=>update(r.key, {start: Math.max(1, Number(e.target.value||1))})}/>
    <input style={inputStyle}
           type="number" value={r.end}
           onChange={e=>update(r.key, {end: Math.max(r.start, Number(e.target.value||r.start))})}/>

    {/* ← 5ª CELDA (Acciones) */}
    <div style={{display:'flex', gap:6}}>
    <button onClick={()=> resetPasswordToDefault(r.key, r.name)}>
    Reset contraseña (1234)
  </button>
  <button
    onClick={()=> deleteVendor(r.key, r.name)}
    // deshabilitar si es perfil base definido en VENDORS
    disabled={Boolean((VENDORS as any)[r.key])}
    title={Boolean((VENDORS as any)[r.key]) ? 'No se puede eliminar un perfil base' : 'Eliminar este perfil'}
  >
    Eliminar
  </button>
</div>

  </React.Fragment>
))}
      </div>

      <div style={{display:'flex', justifyContent:'flex-end'}}>
        <button onClick={guardar}>Guardar cambios</button>
      </div>

      <div style={{color:'#6b7280', fontSize:12}}>
        * Los cambios se aplican de inmediato (nombre, prefijo y rango).<br/>
        * Los códigos no llevan ceros a la izquierda (B1, B2, …).<br/>
        * Para agregar perfiles nuevos reales, lo vemos en un paso posterior (implica tipos y login dinámico).
      </div>
    </div>
  )
}

/** ────────────────────────────────────────────────────────────────────────────
 *  Componente principal: ConfigAvanzadas
 *  ───────────────────────────────────────────────────────────────────────── */
export default function ConfigAvanzadas(){
  const [conf, setConf] = React.useState<EffectiveConfig>(loadAdminConfig)

  // Cargar desde BD (si hay sesión) y espejar en localStorage
  React.useEffect(()=>{ (async ()=>{
    try{
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return  // si no hay login, seguimos con el mirror local

      // 1) Config global
      const row = await loadConfigFromDB()
      if (row) {
        const next: EffectiveConfig = {
          bajaMonths: row.baja_months || [],
          altaMonths: row.alta_months || [],
          ratesLSR: row.rates_lsr || { alta:{adulto:0,nino:0,infante:0}, baja:{adulto:0,nino:0,infante:0} },
          transport: row.transport || { alta:0, baja:0 },
          ratesPromo: row.rates_promo || { FM:{adulto:0,nino:0,infante:0}, CM:{adulto:0,nino:0,infante:0} },
          proveedores: row.proveedores || [],
          mediosPago: row.medios_pago || [],
        }
        setConf(next)
        saveAdminConfig(next) // espejo local + evento
      }

      // 2) Overrides de vendedores
      const ovs = await loadOverridesFromDB()
      const map: Record<string, Partial<{ name:string; prefix:string; start:number; end:number }>> = {}
      for (const r of ovs) {
        map[r.vendor_key] = {
          name: r.name ?? undefined,
          prefix: r.prefix ?? undefined,
          start: r.range_start ?? undefined,
          end: r.range_end ?? undefined,
        }
      }
      // Guardar en localStorage para que lo lean Login/App
      writeOverrides(map)
    } catch (e) {
      console.error('[ConfigAvanzadas] carga inicial desde BD:', e)
    }
  })() }, [])

  // Helpers de UI
  const card: React.CSSProperties = { border:'1px solid #e5e7eb', borderRadius:12 }
  const pad: React.CSSProperties  = { padding:12 }
  const input: React.CSSProperties = { padding:'6px 8px', border:'1px solid #e5e7eb', borderRadius:8 }
  const label: React.CSSProperties = { fontSize:12, color:'#6b7280' }

  const toggleMonth = (arr:'altaMonths'|'bajaMonths', m:number)=>{
    setConf(prev=>{
      const set = new Set(prev[arr])
      if(set.has(m)) set.delete(m); else set.add(m)
      return {...prev, [arr]: Array.from(set).sort((a,b)=>a-b)}
    })
  }

  const saveAll = async ()=>{
    if(!conf.altaMonths.length && !conf.bajaMonths.length){
      alert('Debes seleccionar al menos un mes en alguna temporada.')
      return
    }
    try {
      // 1) espejo local (para que la UI del resto de la app reaccione al instante)
      saveAdminConfig(conf)
  
      // 2) persistir en BD (si hay sesión)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await saveConfigToDB({
          baja_months: conf.bajaMonths,
          alta_months: conf.altaMonths,
          rates_lsr: conf.ratesLSR,
          transport: conf.transport,
          rates_promo: conf.ratesPromo,
          proveedores: conf.proveedores,
          medios_pago: conf.mediosPago
        })
      }
  
      alert('Configuración guardada.')
    } catch (e:any) {
      alert('La configuración se guardó localmente, pero falló en BD: ' + (e?.message || e))
    }
  }

  const MonthBox = ({n}:{n:number})=>{
    const name = new Date(2024, n-1, 1).toLocaleString('es', {month:'long'})
    const isAlta = conf.altaMonths.includes(n)
    const isBaja = conf.bajaMonths.includes(n)
    return (
      <div style={{display:'grid', gridTemplateColumns:'1fr auto auto', gap:8, alignItems:'center'}}>
        <div style={{textTransform:'capitalize'}}>{name}</div>
        <label style={{display:'flex', alignItems:'center', gap:6, ...label}}>
          <input type="checkbox" checked={isAlta} onChange={()=>toggleMonth('altaMonths',n)} />
          Alta
        </label>
        <label style={{display:'flex', alignItems:'center', gap:6, ...label}}>
          <input type="checkbox" checked={isBaja} onChange={()=>toggleMonth('bajaMonths',n)} />
          Baja
        </label>
      </div>
    )
  }

  return (
    <div style={{display:'grid', gap:12}}>
      <h2 style={{margin:'4px 0 0'}}>Configuraciones avanzadas</h2>
      <div style={{display:'flex', justifyContent:'flex-end', gap:8}}>
      <button onClick={addNewVendor}>➕ Añadir usuario</button>
      </div>

      {/* Perfiles (existentes) */}
      <PerfilesExistentes/>

      {/* Meses por temporada */}
      <div style={card}><div style={pad}>
        <h3 style={{marginTop:0}}>Temporadas (meses)</h3>
        <div style={{display:'grid', gridTemplateColumns:'repeat(2, minmax(220px, 1fr))', gap:10}}>
          {Array.from({length:12}, (_,i)=> i+1).map(m=> <MonthBox key={m} n={m}/>)}
        </div>
        <div style={{color:'#6b7280', fontSize:12, marginTop:6}}>
          * Un mes puede estar en alta y/o baja. Si un mes no está en “alta”, se considerará “baja” por defecto en la app.
        </div>
      </div></div>

      {/* Tarifas LSR */}
      <div style={card}><div style={pad}>
        <h3 style={{marginTop:0}}>Tarifas LSR</h3>
        <div style={{display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:12}}>
          {(['alta','baja'] as Season[]).map(season=>(
            <div key={season} style={{border:'1px dashed #e5e7eb', borderRadius:10, padding:10}}>
              <div style={{fontWeight:700, marginBottom:8, textTransform:'uppercase'}}>{season}</div>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8}}>
                <div>
                  <div style={label}>Adulto</div>
                  <input style={input} type="number"
                         value={conf.ratesLSR[season].adulto}
                         onChange={e=> setConf(prev=>({...prev, ratesLSR:{...prev.ratesLSR, [season]:{...prev.ratesLSR[season], adulto:Number(e.target.value||0)}}}))}/>
                </div>
                <div>
                  <div style={label}>Niño</div>
                  <input style={input} type="number"
                         value={conf.ratesLSR[season].nino}
                         onChange={e=> setConf(prev=>({...prev, ratesLSR:{...prev.ratesLSR, [season]:{...prev.ratesLSR[season], nino:Number(e.target.value||0)}}}))}/>
                </div>
                <div>
                  <div style={label}>Infante</div>
                  <input style={input} type="number"
                         value={conf.ratesLSR[season].infante}
                         onChange={e=> setConf(prev=>({...prev, ratesLSR:{...prev.ratesLSR, [season]:{...prev.ratesLSR[season], infante:Number(e.target.value||0)}}}))}/>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div></div>

      {/* Transporte */}
      <div style={card}><div style={pad}>
        <h3 style={{marginTop:0}}>Transporte (por persona)</h3>
        <div style={{display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:12}}>
          {(['alta','baja'] as Season[]).map(season=>(
            <div key={season}>
              <div style={label}>Temporada {season.toUpperCase()}</div>
              <input style={input} type="number"
                     value={conf.transport[season]}
                     onChange={e=> setConf(prev=>({...prev, transport:{...prev.transport, [season]: Number(e.target.value||0)}}))}/>
            </div>
          ))}
        </div>
      </div></div>

      {/* Capillas de Mármol (FM/CM) */}
      <div style={card}><div style={pad}>
        <h3 style={{marginTop:0}}>Capillas de Mármol</h3>
        <div style={{display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:12}}>
          {(['FM','CM'] as Array<'FM'|'CM'>).map(tipo=>(
            <div key={tipo} style={{border:'1px dashed #e5e7eb', borderRadius:10, padding:10}}>
              <div style={{fontWeight:700, marginBottom:8}}>
                {tipo==='FM' ? 'Full Mármol (FM)' : 'Capillas de Mármol (CM)'}
              </div>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8}}>
                <div>
                  <div style={label}>Adulto</div>
                  <input style={input} type="number"
                         value={conf.ratesPromo[tipo].adulto}
                         onChange={e=> setConf(prev=>({...prev, ratesPromo:{...prev.ratesPromo, [tipo]:{...prev.ratesPromo[tipo], adulto:Number(e.target.value||0)}}}))}/>
                </div>
                <div>
                  <div style={label}>Niño</div>
                  <input style={input} type="number"
                         value={conf.ratesPromo[tipo].nino}
                         onChange={e=> setConf(prev=>({...prev, ratesPromo:{...prev.ratesPromo, [tipo]:{...prev.ratesPromo[tipo], nino:Number(e.target.value||0)}}}))}/>
                </div>
                <div>
                  <div style={label}>Infante</div>
                  <input style={input} type="number"
                         value={conf.ratesPromo[tipo].infante}
                         onChange={e=> setConf(prev=>({...prev, ratesPromo:{...prev.ratesPromo, [tipo]:{...prev.ratesPromo[tipo], infante:Number(e.target.value||0)}}}))}/>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div></div>

      {/* Proveedores */}
      <div style={card}><div style={pad}>
        <h3 style={{marginTop:0}}>Proveedores Capillas</h3>
        <div style={{display:'grid', gap:8}}>
          {conf.proveedores.map((p, idx)=>(
            <div key={idx} style={{display:'grid', gridTemplateColumns:'1fr auto', gap:8}}>
              <input
                style={input}
                value={p}
                onChange={e=>{
                  const v = e.target.value
                  setConf(prev=>{
                    const next = [...prev.proveedores]
                    next[idx] = v
                    return {...prev, proveedores: next}
                  })
                }}
                placeholder="Nombre del proveedor"
              />
              <button
                onClick={()=>{
                  setConf(prev=>{
                    const next = prev.proveedores.filter((_,i)=> i!==idx)
                    return {...prev, proveedores: next}
                  })
                }}
              >
                Eliminar
              </button>
            </div>
          ))}
          <button
            onClick={()=>{
              setConf(prev=> ({...prev, proveedores: [...prev.proveedores, '']}))
            }}
          >
            + Añadir proveedor
          </button>
        </div>
      </div></div>

      {/* Medios de pago */}
      <div style={card}><div style={pad}>
        <h3 style={{marginTop:0}}>Medios de pago</h3>
        <div style={{display:'grid', gap:8}}>
          {conf.mediosPago.map((m, idx)=>(
            <div key={idx} style={{display:'grid', gridTemplateColumns:'1fr auto', gap:8}}>
              <input
                style={input}
                value={m}
                onChange={e=>{
                  const v = e.target.value
                  setConf(prev=>{
                    const next = [...prev.mediosPago]
                    next[idx] = v
                    return {...prev, mediosPago: next}
                  })
                }}
                placeholder="Ej: tarjeta, efectivo, efx, transferencia…"
              />
              <button
                onClick={()=>{
                  setConf(prev=>{
                    const next = prev.mediosPago.filter((_,i)=> i!==idx)
                    return {...prev, mediosPago: next}
                  })
                }}
              >
                Eliminar
              </button>
            </div>
          ))}
          <button
            onClick={()=>{
              setConf(prev=> ({...prev, mediosPago: [...prev.mediosPago, '']}))
            }}
          >
            + Añadir medio de pago
          </button>
        </div>
      </div></div>

      {/* Guardar todo */}
      <div style={{display:'flex', justifyContent:'flex-end', gap:8}}>
        <button onClick={saveAll}>Guardar configuración</button>
      </div>
    </div>
  )
}
