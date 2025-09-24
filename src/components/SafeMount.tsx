import { useEffect, useState } from 'react'

/**
 * Evita el error de hooks #310 forzando que el hijo se monte
 * recién en el siguiente tick (luego de un render estable).
 */
export default function SafeMount({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)
  useEffect(() => { setReady(true) }, [])
  return ready ? <>{children}</> : null
}
