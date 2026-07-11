'use client'

import { useAppContext } from '@/contexts/AppContext'
import type { WhaleEvent } from '@sessionmap/types'

export function useWhaleEvents(): WhaleEvent[] {
  const { state } = useAppContext()
  return state.whaleEvents
}
