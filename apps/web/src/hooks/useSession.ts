'use client'

import { useState, useEffect } from 'react'
import type { SessionInfo } from '@sessionmap/types'
import { getSessionInfo } from '@/lib/session-logic'
import { useAppContext } from '@/contexts/AppContext'

export function useSession(): SessionInfo {
  const { state } = useAppContext()
  const [session, setSession] = useState<SessionInfo>(() =>
    getSessionInfo(state.tweaks.timeOffset)
  )

  useEffect(() => {
    function tick() {
      setSession(getSessionInfo(state.tweaks.timeOffset))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [state.tweaks.timeOffset])

  return session
}
