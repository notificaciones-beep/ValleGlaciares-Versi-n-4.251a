// src/components/SafeMount.tsx
import React from 'react'

export default function SafeMount({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  // ⚠️ IMPORTANTE:
  // Nunca llames a children como función (nada de children()).
  // Solo devuélvelo envuelto en un Fragment.
  if (!mounted) return null
  return <>{children}</>
}
