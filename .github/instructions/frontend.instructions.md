---
applyTo: "**/*.ts,**/*.tsx,**/package.json"
---

- We use React + NextJS. For NextJS, we use the App router NOT the older pages router.
- The frontend files are set up as a monorepo:
  - `ol-components` for shared componenets
  - `api` contains generated API client code and react-query hooks
- For reusable UI, use components from `@mitodl/smoot-design`, `ol-components` preferentially
- Within `main`, use `@/` for root-relative imports

## Mutation error handling

Every mutation failure in the browser shows a global error toast by default (`MutationCache.onError` in `main/src/app/getQueryClient.ts`), so failures are never silent. Tune it per call site via React Query `meta` (typed in `api/mutation-meta`):

- Component renders its own inline error for the failure → pass `meta: SILENCE_ERROR_TOAST` to the mutation hook, or the user sees a double alert. Required even if you catch the `mutateAsync` rejection yourself — catching does not suppress the toast.
- Custom toast copy → `meta: { errorMessage: "Could not save your changes." }`, or `getErrorMessage(error, variables)` for data-driven copy.
- Shared `api/` hooks accept `{ meta }` (`MutationHookOptions`) and forward it; the opt-out belongs at the _consumer_, never baked into a shared hook (many hooks are surfaced in one place and silent in another).
