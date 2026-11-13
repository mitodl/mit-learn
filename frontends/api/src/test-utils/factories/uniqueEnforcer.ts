import {
  UniqueEnforcer as BaseUniqueEnforcer,
  type EnforceOptions,
  type UniqueComparable,
} from "enforce-unique"

/**
 * `enforce-unique` gives each `enforce(generator)` call a 50ms wall-clock
 * budget in addition to its retry budget. The retry budget is the only one we
 * want: a generator that keeps colliding is a real bug, but a CPU-starved CI
 * runner stalling a worker for 50ms between two statements is not, and throws
 * an `EnforceLimitError` from an otherwise-passing test.
 */
export class UniqueEnforcer extends BaseUniqueEnforcer {
  enforce<T extends UniqueComparable>(value: T): T
  enforce<T extends UniqueComparable>(
    generator: () => T,
    options?: EnforceOptions,
  ): T
  enforce<T extends UniqueComparable>(
    valueOrGenerator: T | (() => T),
    options?: EnforceOptions,
  ): T {
    if (typeof valueOrGenerator === "function") {
      return super.enforce(valueOrGenerator as () => T, {
        maxTime: Infinity,
        ...options,
      })
    }
    return super.enforce(valueOrGenerator)
  }
}
