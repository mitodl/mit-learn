"use client"

// eslint-disable-next-line @typescript-eslint/no-restricted-imports -- this is the sanctioned wrapper around useSearchParams; see @/common/searchParams
import { useSearchParams } from "next/navigation"
import type { ReadonlyURLSearchParams } from "next/navigation"
import type { ServerSearchParam } from "./searchParams"

/**
 * The page URL's search params, with named lookups restricted to params
 * registered in @/common/searchParams. Structurally still a
 * ReadonlyURLSearchParams: iteration, toString(), and passing where
 * URLSearchParams is expected all work unchanged.
 */
interface AppSearchParams extends ReadonlyURLSearchParams {
  get(name: ServerSearchParam): string | null
  getAll(name: ServerSearchParam): string[]
  has(name: ServerSearchParam): boolean
}

/**
 * Use in place of next/navigation's useSearchParams (which is banned by
 * lint). Reading a param not registered in @/common/searchParams is a type
 * error — see that module's docs for how to register one.
 */
const useAppSearchParams = (): AppSearchParams => useSearchParams()

export { useAppSearchParams }
export type { AppSearchParams }
