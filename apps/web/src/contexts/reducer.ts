import type { AppState, GlobeMode, TweakValues } from '@ipmap/types'
import { TWEAK_DEFAULTS } from '@/lib/constants'

export type Action =
  | { type: 'SET_GLOBE_MODE'; payload: GlobeMode }
  | { type: 'TOGGLE_TERMINAL' }
  | { type: 'SET_TWEAK'; payload: Partial<TweakValues> }

export const initialState: AppState = {
  globeMode: 'auto',
  terminalMode: false,
  tweaks: TWEAK_DEFAULTS,
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_GLOBE_MODE':
      return { ...state, globeMode: action.payload }
    case 'TOGGLE_TERMINAL':
      return { ...state, terminalMode: !state.terminalMode }
    case 'SET_TWEAK':
      return { ...state, tweaks: { ...state.tweaks, ...action.payload } }
    default:
      return state
  }
}
