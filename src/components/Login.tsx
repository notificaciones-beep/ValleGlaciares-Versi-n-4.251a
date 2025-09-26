// src/components/Login.tsx
import React from 'react'
import { supabase } from '../supabaseClient'
import { VendorKey } from '../types'
import { DEFAULT_PASSWORDS } from '../state'

const LS_VENDOR_OVERRIDES = 'vg_vendor_overrides'

type Props = {
  onLogin: (v: string) => void
  getPwd: (v: string) => string
}

type Override = Partial<{ name:string; prefix:string; start:number; end:number }>
type OverridesMap = Record<string, Override>

function mergeBaseAndOverrides(overrides: OverridesMap) {
  // Base MUY restrictiva: sólo 'javier' visible como "Admin"
  const base: Record<string, { name:string; prefix:string; start:number; end:number }> = {
    javier: { name:'Admin', prefix:'A', start:1, end:1000 },
  }

  const merged: Record<string, { name:string; prefix:string; start:number; end:number }> = { ...base }
  for (const [key, ov] of Object.entries(overrides || {})) {
    if (!key) continue
    merged[key] = {
      name:  ov.name   ?? merged[key]?.name   ?? key,
      prefix:ov.prefix ?? merged[key]?.prefix ?? 'X',
      start: ov.start  ?? merged[key]?.start  ?? 1,
      end:   ov.end    ?? merged[key]?.end    ?? 1000,
    }
  }
  return merged
}

async function fetchOverridesFromDB(): Promise<OverridesMap> {
  const { data, error } = await supabase
    .from('vendor_overrides')
    .select('vendor_key,name,prefix,range_start,range_end')

  if (error) throw error

  const map: OverridesMap = {}
  for (const r of (data || [])) {
    map[r.vendor_key] = {
      name: r.name ?? undefined,
      prefix: r.prefix ?? undefined,
      start: (r as any).range_start ?? undefined,
      end: (r as any).range_end ?? undefined,
    }
  }
  return map
}

export default function VendorLogin({ onLogin, getPwd }: Props) {
  const [options, setOptions] = React.useState<{ key:string, label:string }[]>([])
  const [vendor, setVendor] = React.useState<string>('javier')
  React.useEffect(() => {
    if (!options.length) return
    const exists = options.some(o => o.key === vendor)
    if (!exists) setVendor(options[0].key)
  }, [options, vendor])
  const [pwd, setPwd] = React.useState('')
  const [err, setErr] = React.useState('')
  const [loading, setLoading] = React.useState(true)

  // Carga inicial: intenta localStorage y luego DB
  React.useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        // 1) Arranque rápido desde localStorage (si hay)
        let ls: OverridesMap = {}
        try { ls = JSON.parse(localStorage.getItem(LS_VENDOR_OVERRIDES) || '{}') } catch {}
        const startMerged = mergeBaseAndOverrides(ls)
        if (!cancelled) {
          setOptions(Object.entries(startMerged).map(([k,v]) => ({ key:k, label:v.name || k })))
        }

        // 2) Fuente de verdad: DB
        const fresh = await fetchOverridesFromDB()
        // Guardamos también en localStorage para otras pantallas/pestañas
        localStorage.setItem(LS_VENDOR_OVERRIDES, JSON.stringify(fresh))
        const merged = mergeBaseAndOverrides(fresh)
        if (Object.keys(merged).length === 0) {
          // Fallback: mantener Admin si DB viene vacía
          merged.javier = { name: 'Admin', prefix: 'A', start: 1, end: 1000 }
        }
        if (!cancelled) {
          setOptions(Object.entries(merged).map(([k,v]) => ({ key:k, label:v.name || k })))
          setLoading(false)
        }

      } catch (e) {
        console.error('[VendorLogin] fetch overrides failed:', e)
        setLoading(false)
      }
    }

    React.useEffect(() => {
      if (!options.length) return
      const exists = options.some(o => o.key === vendor)
      if (!exists) setVendor(options[0].key)
    }, [options, vendor])

    load()

    // Re-fetch al volver a la pestaña
    const onFocus = () => load()
    const onVis = () => { if (!document.hidden) load() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVis)

    // Realtime: si cambian overrides en DB, refrescar
    const ch = supabase.channel('rt-vendor-overrides')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'vendor_overrides' }, () => {
      load()  // refresca la lista desde DB sin disparar eventos ni loops
    })
    .subscribe()

    return () => {
      cancelled = true
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVis)
      try { supabase.removeChannel(ch) } catch {}
    }
  }, [])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    if (!vendor) { setErr('Selecciona un usuario'); return }
    const ok = pwd.trim() === getPwd(vendor as VendorKey)
    if (!ok) { setErr('Contraseña incorrecta'); return }
    localStorage.setItem('vg_vendor', vendor)
    onLogin(vendor)
  }

  return (
    <div style={{padding:20, fontFamily:'system-ui', maxWidth:480}}>
      <h2>Selecciona tu usuario</h2>
      <form onSubmit={submit}>
        <div style={{display:'grid', gap:8}}>
          <div>
            <label>Usuario</label>
            <select
            value={options.length ? vendor : ''}
            onChange={e=> setVendor(e.target.value)}
            disabled={loading && options.length===0}
            >
              {options.length === 0
              ? <option value="">Cargando…</option>
              : options.map(o => <option key={o.key} value={o.key}>{o.label}</option>)
            }
            </select>
          </div>
          <div>
            <label>Contraseña (demo: 1234)</label>
            <input type="password" value={pwd} onChange={e=>setPwd(e.target.value)} placeholder="••••" />
          </div>
          {loading && <div style={{opacity:.6}}>Cargando usuarios…</div>}
          {err && <div style={{marginTop:6,color:'#b91c1c'}}>{err}</div>}
          <div style={{marginTop:12}}>
            <button type="submit">Entrar</button>
          </div>
        </div>
      </form>
    </div>
  )
}
