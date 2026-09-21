import React from "react"
import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { setMockResponse, factories, urls, makeRequest } from "api/test-utils"
import { renderWithProviders } from "@/test-utils"
import { WebsiteContentActionsMenu } from "./WebsiteContentActionsMenu"

const TITLE = "Breaking the old model of education"
const CONTENT_ID = 701

const setup = ({ isArticleEditor }: { isArticleEditor: boolean }) => {
  const user = factories.user.user({
    is_authenticated: isArticleEditor,
    is_article_editor: isArticleEditor,
  })
  setMockResponse.get(urls.userMe.get(), user)

  /* Seeds the user into the query cache, so the permission is known on the
     first render and a missing menu cannot just mean a pending request. */
  renderWithProviders(
    <WebsiteContentActionsMenu
      contentId={CONTENT_ID}
      contentLabel="article"
      title={TITLE}
    />,
    { user },
  )
}

const menuButton = () =>
  screen.queryByRole("button", { name: `More options for ${TITLE}` })

describe("WebsiteContentActionsMenu", () => {
  test("a user who can edit content gets the menu", () => {
    setup({ isArticleEditor: true })

    expect(menuButton()).toBeVisible()
  })

  test("renders nothing for a user who cannot edit content", () => {
    setup({ isArticleEditor: false })

    /* Every action here edits content, so there is no read-only form of it. */
    expect(menuButton()).toBe(null)
  })

  /**
   * The dialog closes only once `onConfirm` resolves, so the menu has to await
   * the mutation. Fired and forgotten, the dialog would close on a failure and
   * report a takedown that never happened -- and the editor would have nothing
   * to retry from, since this menu silences the global error toast.
   */
  test("a failed unpublish leaves the confirmation open", async () => {
    setup({ isArticleEditor: true })
    setMockResponse.patch(
      urls.websiteContent.details(CONTENT_ID),
      { detail: "boom" },
      { code: 500 },
    )

    await userEvent.click(menuButton()!)
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Unpublish" }),
    )
    await userEvent.click(
      await screen.findByRole("button", { name: "Yes, Unpublish article" }),
    )

    await waitFor(() => {
      expect(makeRequest).toHaveBeenCalledWith(
        expect.objectContaining({ method: "patch" }),
      )
    })

    const dialog = screen.getByRole("dialog")
    within(dialog).getByRole("alert")
  })
})
