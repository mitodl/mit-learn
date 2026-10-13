import React from "react"
import { renderWithProviders, screen, user } from "@/test-utils"
import { DataConsentDialog } from "./DataConsentDialog"

const setup = (
  props: Partial<React.ComponentProps<typeof DataConsentDialog>> = {},
) => {
  const onAccept = jest.fn()
  const onCancel = jest.fn()
  renderWithProviders(
    <DataConsentDialog
      open
      contractName="Horizon Digital Program | Cohort 2"
      onAccept={onAccept}
      onCancel={onCancel}
      {...props}
    />,
  )
  return { onAccept, onCancel }
}

describe("DataConsentDialog", () => {
  test("names the contract in the consent text", () => {
    setup()
    expect(
      screen.getByText(
        /paid for my participation in the Horizon Digital Program \| Cohort 2\./,
      ),
    ).toBeInTheDocument()
  })

  test("can't be dismissed: no close button, and Escape leaves it open", async () => {
    const { onAccept, onCancel } = setup()
    expect(
      screen.queryByRole("button", { name: "Close" }),
    ).not.toBeInTheDocument()

    await user.keyboard("{Escape}")

    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(onAccept).not.toHaveBeenCalled()
    expect(onCancel).not.toHaveBeenCalled()
  })

  test("Agree and continue is disabled until the consent box is checked", async () => {
    const { onAccept } = setup()
    const agree = screen.getByRole("button", { name: "Agree and continue" })
    expect(agree).toBeDisabled()

    await user.click(
      screen.getByRole("checkbox", {
        name: "I have read and consent to the data sharing described above.",
      }),
    )
    expect(agree).toBeEnabled()

    await user.click(agree)
    expect(onAccept).toHaveBeenCalledTimes(1)
  })

  test("Cancel calls onCancel without the box checked", async () => {
    const { onAccept, onCancel } = setup()
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onAccept).not.toHaveBeenCalled()
  })

  test.each([
    { submitting: "accept" as const, busyName: "Agree and continue" },
    { submitting: "cancel" as const, busyName: "Cancel" },
  ])(
    "while submitting $submitting, both actions are aria-disabled and ignore clicks, and only that one is busy",
    async ({ submitting, busyName }) => {
      const { onAccept, onCancel } = setup({ submitting })
      const cancel = screen.getByRole("button", { name: "Cancel" })
      const agree = screen.getByRole("button", { name: "Agree and continue" })

      for (const button of [cancel, agree]) {
        expect(button).toHaveAttribute("aria-disabled", "true")
        expect(button).toHaveAttribute(
          "aria-busy",
          button === screen.getByRole("button", { name: busyName })
            ? "true"
            : "false",
        )
      }
      // Still focusable, so focus isn't lost when a submit starts.
      expect(cancel).not.toBeDisabled()

      await user.click(cancel)
      expect(onCancel).not.toHaveBeenCalled()
      expect(onAccept).not.toHaveBeenCalled()
    },
  )

  test("shows an error when the last request failed", () => {
    setup({ isError: true })
    expect(screen.getByRole("alert")).toHaveTextContent(
      "We couldn't save your response. Please try again.",
    )
  })
})
