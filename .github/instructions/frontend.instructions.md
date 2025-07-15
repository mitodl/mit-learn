---
applyTo: "**/*.ts,**/*.tsx,**/package.json"
---

- We use React + NextJS. For NextJS, we use the App router NOT the older pages router.
- The frontend files are set up as a monorepo:
  - `ol-components` for shared componenets
  - `api` contains generated API client code and react-query hooks
- For reusable UI, use components from `@mitodl/smoot-design`, `ol-components` preferentially
- Within `main`, use `@/` for root-relative imports
