'use client'

/**
 * Re-export the APIPage component for use in the docs catch-all page.
 *
 * This wrapper exists so the catch-all page can import from a local component
 * path rather than directly from the lib module, following FSD conventions.
 */
export { APIPage } from '@/lib/openapi'
