import { faker } from "@faker-js/faker/locale/en"
import type { PartialDeep } from "type-fest"
import { mergeWith } from "lodash"

export type Factory<T, U = never> = (overrides?: Partial<T>, options?: U) => T
export type PartialFactory<T, U = T> = (overrides?: PartialDeep<T>) => U

interface PaginatedResult<T> {
  count: number
  next: null | string
  previous: null | string
  results: T[]
}

export const makePaginatedFactory =
  <T>(makeResult: Factory<T>) =>
  (
    { count, pageSize }: { count: number; pageSize?: number },
    {
      previous = null,
      next = null,
    }: {
      next?: string | null
      previous?: string | null
    } = {},
  ) => {
    const results = Array.from({ length: pageSize ?? count }, () =>
      makeResult(),
    )
    return {
      results,
      count,
      next,
      previous,
    } satisfies PaginatedResult<T>
  }

/**
 * Make a random URL with `faker`, but standardize it to what browsers use.
 */
export const makeUrl = (): string => new URL(faker.internet.url()).toString()

export const mergeOverrides = <T>(
  object: Partial<T>,
  ...sources: PartialDeep<T>[]
): T =>
  mergeWith(
    object,
    ...sources,
    // arrays overwrite existing values, this way tests can force a singular value for arrays
    /* eslint-disable @typescript-eslint/no-explicit-any */
    (objValue: any, srcValue: any) => {
      if (Array.isArray(objValue)) {
        return srcValue
      }
      return undefined
    },
  )
