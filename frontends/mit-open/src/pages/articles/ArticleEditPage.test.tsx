import React from "react"
import { renderWithProviders, screen, user, waitFor } from "../../test-utils"
import ArticlesEditPage from "./ArticlesEditPage"
import { Route } from "react-router"
import type { Article } from "api"
import { articles as factory } from "api/test-utils/factories"
import { makeRequest, setMockResponse, urls } from "api/test-utils"
import { getDescriptionFor } from "ol-util/test-utils"

const setup = ({ article }: { article: Article }) => {
  setMockResponse.get(urls.articles.details(article.id), article)
  renderWithProviders(
    <Route path="/article/:id/edit">
      <ArticlesEditPage />
    </Route>,
    { url: `/article/${article.id}/edit` },
  )
}

describe("ArticlesEditPage", () => {
  it("Renders title and html into form inputs", async () => {
    const article = factory.article()
    setup({ article })
    const bodyInput = await screen.findByText(article.html)
    const titleInput = screen.getByLabelText(/Title/i)

    expect(titleInput).toHaveValue(article.title)
    // It should actually be CKEditor, but we mock CKEditor with a textarea for jest
    expect(bodyInput).toBeInstanceOf(HTMLTextAreaElement)

    await waitFor(() => {
      expect(document.title).toBe(`Editing: ${article.title}`)
    })
  })

  it("Updates fields and makes appropriate API calls", async () => {
    const article = factory.article()
    setup({ article })
    const bodyInput = await screen.findByText(article.html)
    const titleInput = screen.getByLabelText(/Title/i)
    const patch = { title: "New title", html: "<p>New body</p>" }
    const url = urls.articles.details(article.id)
    setMockResponse.patch(url, patch)

    await user.click(titleInput)
    await user.clear(titleInput)
    await user.paste(patch.title)

    await user.click(bodyInput)
    await user.clear(bodyInput)
    await user.paste(patch.html)

    await user.click(screen.getByText(/Save/i))

    expect(makeRequest).toHaveBeenCalledWith("patch", url, patch)
  })

  it("Validates form data", async () => {
    const article = factory.article({ title: "", html: "" })
    setup({ article })
    const titleInput = screen.getByLabelText(/Title/i)

    const saveButton = screen.getByRole("button", { name: /Save/i })
    await waitFor(() => expect(saveButton).toBeEnabled())
    makeRequest.mockClear()

    // Click Save
    await user.click(saveButton)
    // No PATCH request should be made
    expect(makeRequest).not.toHaveBeenCalled()

    // Error messages should be shown.
    expect(getDescriptionFor(titleInput).textContent).toMatch(
      /Title is required/i,
    )
    // getDescriptionFor won't work since the form description isn't properly
    // associated with CKEditor
    screen.getByText(/Article body is required/i)
  })
})
