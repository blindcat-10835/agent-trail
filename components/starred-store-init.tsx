'use client'

import { useEffect } from 'react'
import { useStarredStore } from '@/stores/starred-store'

export function StarredStoreInit() {
  const load = useStarredStore((s) => s.load)

  useEffect(() => {
    load()
  }, [load])

  return null
}
