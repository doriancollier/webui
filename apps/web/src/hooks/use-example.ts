'use client'

import { useLocalStorage, useMediaQuery, useDebounceValue } from 'usehooks-ts'

// Re-export commonly used hooks for convenience
export { useLocalStorage, useMediaQuery, useDebounceValue }

// Example custom hook combining usehooks-ts
export function useIsMobile() {
  return useMediaQuery('(max-width: 768px)')
}
