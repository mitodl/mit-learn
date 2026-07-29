import React from "react"
import { renderWithProviders, screen, user, waitFor } from "@/test-utils"
import { setMockResponse, factories, urls, makeRequest } from "api/test-utils"
import { WebsiteContentDraftListingPage } from "./WebsiteContentDraftListingPage"

const mockPush = jest.fn()
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}))

const setupEditor = () => {
  setMockResponse.get(
    urls.userMe.get(),
    factories.user.user({ is_authenticated: true, is_article_editor: true }),
  )
}

describe("WebsiteContentDraftListingPage delete", () => {
  test("editor can delete a draft after confirming", async () => {
    setupEditor()
    const draft = factories.websiteContent.websiteContent({
      title: "My Draft",
      content_type: "news",
      is_published: false,
    })
    setMockResponse.get(expect.stringContaining("/api/v1/website_content/"), {
      count: 1,
      next: null,
      previous: null,
      results: [draft],
    })
    setMockResponse.delete(urls.websiteContent.details(draft.id), null)

    renderWithProviders(<WebsiteContentDraftListingPage contentType="news" />)

    const deleteButton = await screen.findByRole("button", {
      name: `Delete ${draft.title}`,
    })
    await user.click(deleteButton)

    // Confirmation dialog appears; clicking "Yes, delete" fires the request.
    const confirm = await screen.findByRole("button", { name: "Yes, delete" })
    await user.click(confirm)

    await waitFor(() => {
      expect(makeRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "delete",
          url: urls.websiteContent.details(draft.id),
        }),
      )
    })
  })

  test("offers no delete action for published content", async () => {
    setupEditor()
    // The API only rejects this with a 400, so the button must not be offered
    // even if a published item reaches this list.
    const published = factories.websiteContent.websiteContent({
      title: "Already Published",
      content_type: "news",
      is_published: true,
    })
    setMockResponse.get(expect.stringContaining("/api/v1/website_content/"), {
      count: 1,
      next: null,
      previous: null,
      results: [published],
    })

    renderWithProviders(<WebsiteContentDraftListingPage contentType="news" />)

    await screen.findByText(published.title)
    expect(
      screen.queryByRole("button", { name: `Delete ${published.title}` }),
    ).not.toBeInTheDocument()
  })
})
