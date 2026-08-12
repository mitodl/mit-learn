import { factories } from "api/test-utils"
import { slugify } from "@/common/slugs"
import { resourceDrawerPushUrl } from "./resourceDrawerPushUrl"

const setCurrentUrl = (url: string) => window.history.replaceState({}, "", url)

test("keeps the host page's params and overwrites both resource params", () => {
  const resource = factories.learningResources.resource()
  setCurrentUrl(
    "/c/topic/data-science?sortby=new&resource=999&resource_title=some-other-thing",
  )

  const params = new URLSearchParams(resourceDrawerPushUrl(resource).slice(1))

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
  setCurrentUrl("/search?resource_title=stale")

  const params = new URLSearchParams(resourceDrawerPushUrl(resource).slice(1))

  expect(params.has("resource_title")).toBe(false)
})

test("preserves the fragment", () => {
  const resource = factories.learningResources.resource()
  setCurrentUrl("/dashboard#my-learning")

  expect(resourceDrawerPushUrl(resource)).toContain("#my-learning")
})
