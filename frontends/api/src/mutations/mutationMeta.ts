/**
 * Typed React Query mutation `meta`, read by the global mutation-error handler
 * (a `MutationCache.onError` wired up in the `main` app's query client).
 *
 * The default behavior is: any mutation error shows a top-center error toast.
 * A call site overrides that through `meta` — declared here as plain data so
 * the `api` package stays UI-free (the toast itself lives in `main`).
 *
 * Augmenting `Register.mutationMeta` makes `mutation.meta` typed everywhere it
 * is set (here in `api`) and read (in `main`), instead of `Record<string, unknown>`.
 */

/**
 * NOTE: this must stay a `type` alias. As an `interface` it no longer satisfies
 * the `TMutationMeta extends Record<string, unknown>` constraint in React
 * Query's `Register` lookup (interfaces lack an implicit index signature), and
 * `meta` silently degrades to `Record<string, unknown>` everywhere — with zero
 * compiler errors.
 */
export type MutationErrorMeta = {
  /**
   * Set `false` to suppress the default error toast — e.g. when the call site
   * renders its own inline error colocated with the action.
   *
   * Catching a `mutateAsync` rejection does NOT suppress the toast — the
   * cache-level `onError` runs before the error is rethrown to the caller — so
   * a call site that handles the error itself still needs this opt-out.
   */
  showErrorToast?: boolean
  /** Static toast copy for this mutation. */
  errorMessage?: string
  /**
   * Data-driven toast copy; takes precedence over `errorMessage`. Declared in
   * the typed `api` hook where `TVariables` is known; the global handler passes
   * the raw (`unknown`) error and variables, so cast inside the implementation:
   *
   * ```ts
   * meta: {
   *   getErrorMessage: (_error, variables) =>
   *     `Could not remove "${(variables as DestroyRequest).title}".`,
   * }
   * ```
   */
  getErrorMessage?: (error: unknown, variables: unknown) => string
}

/**
 * Options a shared mutation hook forwards to `useMutation`, letting a *consumer*
 * tune error handling without the hook baking in a policy. Chiefly used to pass
 * `meta: { showErrorToast: false }` from a call site that renders its own inline
 * error, so the same hook can stay silent there and toast by default elsewhere.
 */
export type MutationHookOptions = {
  meta?: MutationErrorMeta
}

/**
 * Canonical `meta` for a call site that renders its own inline error and so
 * opts out of the global error toast. Named (not inlined) so every opt-out site
 * is greppable and reads as a deliberate choice rather than a magic boolean.
 */
export const SILENCE_ERROR_TOAST: MutationErrorMeta = Object.freeze({
  // Frozen: this one object is shared by identity across every opt-out site,
  // so a stray mutation would poison all of them.
  showErrorToast: false,
})

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: MutationErrorMeta
  }
}
