import { redirect } from "next/navigation"
import Page from "./page"

test("/articles/draft redirects to the article drafts listing", () => {
  Page()
  expect(jest.mocked(redirect)).toHaveBeenCalledWith(
    "/website_content/drafts?content_type=article",
  )
})
