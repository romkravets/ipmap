'use client'

import { useAppContext } from '@/contexts/AppContext'
import type { WhaleEvent } from '@ipmap/types'

export function useWhaleEvents(): WhaleEvent[] {
  const { state } = useAppContext()
  return state.whaleEvents
}
