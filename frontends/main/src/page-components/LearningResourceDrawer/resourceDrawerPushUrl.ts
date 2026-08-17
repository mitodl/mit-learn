import type { LearningResource } from "api"
import { setResourceParams } from "@/common/urls"

/**
 * The URL a card click pushes: the *current* page's URL plus the drawer's
 * params, preserving every other param and the fragment. This is deliberately
 * not the card's href — the href is the canonical `/search?resource=…` URL
 * (see `resourceDrawerSearch`), which is what crawlers and Copy Link Address
 * should get.
 *
 * Deliberately not a hook: it reads `window.location` at click time instead of
 * subscribing to `useSearchParams()`, which is a dynamic API — a client
 * component that calls it forces its page to render dynamically or sit behind
 * a Suspense boundary. Cards render on nearly every page, so that constraint
 * was reaching a long way for a value only the click handler ever needs.
 */
const resourceDrawerPushUrl = (
  resource: Pick<LearningResource, "id" | "title">,
) => {
  const params = new URLSearchParams(window.location.search)
  setResourceParams(params, resource.id, resource.title)
  return `?${params}${window.location.hash}`
}

export { resourceDrawerPushUrl }
