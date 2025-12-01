import React from "react"
import {
  renderWithProviders,
  setMockResponse,
  TestingErrorBoundary,
} from "@/test-utils"
import { waitFor } from "@testing-library/react"
import { factories, urls } from "api/test-utils"
import { ArticleNewPage } from "./ArticleNewPage"

const mockPush = jest.fn()
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

describe("ArticleNewPage", () => {
  test("throws ForbiddenError when user lacks ArticleEditor permission", async () => {
    const user = factories.user.user({
      is_authenticated: true,
      is_article_editor: false,
    })
    setMockResponse.get(urls.userMe.get(), user)

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {})
    const onError = jest.fn()

    renderWithProviders(
      <TestingErrorBoundary onError={onError}>
        <ArticleNewPage />
      </TestingErrorBoundary>,
    )

    await waitFor(() => {
      expect(onError).toHaveBeenCalled()
    })

    consoleSpy.mockRestore()
  })
})
