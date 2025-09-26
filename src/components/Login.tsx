import React, { useState } from 'react'
import { VendorKey } from '../types'
import { DEFAULT_PASSWORDS, VENDORS } from '../state'

const LS_VENDOR_OVERRIDES = 'vg_vendor_overrides'
function getEffectiveVendors(){
  const raw = localStorage.getItem(LS_VENDOR_OVERRIDES)
  let overrides: Record<string, Partial<{ name:string; prefix:string; start:number; end:number }>> = {}
  try {
    overrides = raw ? (JSON.parse(raw) || {}) : {}
  } catch {
    // si hay basura en localStorage, ignoramos y seguimos con {}
    overrides = {}
  }
  // Base: SOLO 'javier' (que mostraremos como Admin por defecto)
  const merged: Record<string, { name:string; prefix:string; start:number; end:number }> = {} as any
  if ((VENDORS as any)['javier']) {
    merged['javier'] = { ...(VENDORS as any)['javier'] }
  }
  // renombre por defecto: si no hay override para 'javier', mostrar 'Admin'
  if (!overrides['javier']) overrides['javier'] = { name: 'Admin' }

  // aplicar overrides y AGREGAR NUEVOS (solo vienen de overrides, no del resto de VENDORS)
  for (const [key, ov] of Object.entries(overrides)) {
    const base = merged[key] || { name: key, prefix: (key[0]||'X').toUpperCase(), start: 1, end: 999 }
    merged[key] = { ...base, ...ov }
  }
  return merged
}


export default function Login({onLogin, getPwd}:{onLogin:(v:string)=>void, getPwd:(v:string)=>string}){
  const initialVendor = (() => {
    const keys = Object.keys(getEffectiveVendors())
    return keys[0] || 'javier'
  })()
  const [vendor, setVendor] = useState<string>(initialVendor)
  const [pwd, setPwd] = useState('')
  const [err, setErr] = useState('')

  const [, force] = React.useReducer(x => x + 1, 0)
  React.useEffect(() => {
    const refresh = () => force()

    // Refrescos iniciales por si el espejo desde Supabase tarda
    const t1 = setTimeout(refresh, 400)
    const t2 = setTimeout(refresh, 1500)

    // Escuchar todas las señales relevantes
    window.addEventListener('storage', refresh)                // espejo local manual
    window.addEventListener('vg:overrides-updated', refresh)   // overrides actualizados
    window.addEventListener('vg:config-updated', refresh)      // cambios de config que tocan vendors

    return () => {
      clearTimeout(t1); clearTimeout(t2)
      window.removeEventListener('storage', refresh)
      window.removeEventListener('vg:overrides-updated', refresh)
      window.removeEventListener('vg:config-updated', refresh)
    }
  }, [])

  function submit(e:React.FormEvent){
    e.preventDefault()
    if(pwd.trim() === getPwd(vendor)){
      localStorage.setItem('vg_vendor', vendor)
      onLogin(vendor)
    }else setErr('Contraseña incorrecta.')
  }

  return (
    <div style={{display:'grid',placeItems:'center',minHeight:'100vh',padding:16}}>
      <form style={{maxWidth:680,width:'100%',border:'1px solid #e5e7eb',borderRadius:12}} onSubmit={submit}>
        <div style={{padding:16}}>
          <h1 style={{marginTop:0}}>Ingresar</h1>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div>
              <label>Vendedor</label>
              <select value={vendor} onChange={e=>setVendor(e.target.value)}>
              {Object.entries(getEffectiveVendors()).map(([key, meta]) => (
                <option key={key} value={key}>
                  {meta.name} ({meta.prefix}{String(meta.start).padStart(4,'0')}–{meta.prefix}{String(meta.end).padStart(4,'0')})
                  </option>
                  ))}
                  </select>
                
                
            </div>
            <div>
              <label>Contraseña (demo: 1234)</label>
              <input type="password" value={pwd} onChange={e=>setPwd(e.target.value)} placeholder="••••" />
            </div>
          </div>
          {err && <div style={{marginTop:10,color:'#b91c1c'}}>{err}</div>}
          <div style={{marginTop:12}}>
            <button type="submit">Entrar</button>
          </div>
        </div>
      </form>
    </div>
  )
}
