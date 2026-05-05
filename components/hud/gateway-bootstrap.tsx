'use client'

import { useEffect } from 'react'
import { useGatewayStore } from '@/stores/gateway/gateway-store'

export function GatewayBootstrap() {
  const init = useGatewayStore((state) => state.init)
  const disconnect = useGatewayStore((state) => state.disconnect)
  const hydrateFromCache = useGatewayStore((state) => state.hydrateFromCache)

  useEffect(() => {
    hydrateFromCache() // restore cached data synchronously before WS connects
    init()            // establish WS connection asynchronously

    return () => {
      disconnect()
    }
  }, [disconnect, hydrateFromCache, init])

  return null
}
