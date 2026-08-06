import { renderHook } from "@testing-library/react"
import { factories } from "api/test-utils"
import { mockRouter } from "ol-test-utilities/mocks/nextNavigation"
import { slugify } from "@/common/slugs"
import { useResourceDrawerPushUrl } from "./useResourceDrawerPushUrl"

const setup = (url: string) => {
  mockRouter.setCurrentUrl(url)
  return renderHook(() => useResourceDrawerPushUrl())
}

test("keeps the host page's params and overwrites both resource params", () => {
  const resource = factories.learningResources.resource()
  const { result } = setup(
    "/c/topic/data-science?sortby=new&resource=999&resource_title=some-other-thing",
  )

  const params = new URLSearchParams(result.current(resource).slice(1))

  expect(params.get("sortby")).toBe("new")
  expect(params.get("resource")).toBe(String(resource.id))
  expect(params.get("resource_title")).toBe(slugify(resource.title))
})

/**
 * The title override is load-bearing: a faker-generated title always slugifies
 * to something, so this branch is unreachable otherwise. "2024" is the same
 * blank-slug example useCanonicalizeResourceParam.test.tsx uses.
 */
test("drops resource_title when the title yields no slug", () => {
  const resource = factories.learningResources.resource({ title: "2024" })
  const { result } = setup("/search?resource_title=stale")

  const params = new URLSearchParams(result.current(resource).slice(1))

  expect(params.has("resource_title")).toBe(false)
})

test("preserves the fragment", () => {
  const resource = factories.learningResources.resource()
  // mockRouter.setCurrentUrl doesn't carry a hash, so write it directly.
  mockRouter.setCurrentUrl("/dashboard")
  window.history.replaceState({}, "", "/dashboard#my-learning")
  const { result } = renderHook(() => useResourceDrawerPushUrl())

  expect(result.current(resource)).toContain("#my-learning")
})
