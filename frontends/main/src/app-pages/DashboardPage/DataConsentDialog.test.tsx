import React from "react"
import { renderWithProviders, screen, user } from "@/test-utils"
import { DataConsentDialog } from "./DataConsentDialog"

const setup = (
  props: Partial<React.ComponentProps<typeof DataConsentDialog>> = {},
) => {
  const onAccept = jest.fn()
  const onDecline = jest.fn()
  renderWithProviders(
    <DataConsentDialog
      open
      contractName="Horizon Digital Program | Cohort 2"
      onAccept={onAccept}
      onDecline={onDecline}
      {...props}
    />,
  )
  return { onAccept, onDecline }
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
    const { onAccept, onDecline } = setup()
    expect(
      screen.queryByRole("button", { name: "Close" }),
    ).not.toBeInTheDocument()

    await user.keyboard("{Escape}")

    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(onAccept).not.toHaveBeenCalled()
    expect(onDecline).not.toHaveBeenCalled()
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

  test("Decline calls onDecline without the box checked", async () => {
    const { onAccept, onDecline } = setup()
    await user.click(screen.getByRole("button", { name: "Decline" }))
    expect(onDecline).toHaveBeenCalledTimes(1)
    expect(onAccept).not.toHaveBeenCalled()
  })

  test.each(["accept", "decline"] as const)(
    "disables both actions while submitting %s",
    (submitting) => {
      setup({ submitting })
      expect(screen.getByRole("button", { name: "Decline" })).toBeDisabled()
      expect(
        screen.getByRole("button", { name: "Agree and continue" }),
      ).toBeDisabled()
    },
  )

  test("shows an error when the last request failed", () => {
    setup({ isError: true })
    expect(screen.getByRole("alert")).toHaveTextContent(
      "We couldn't save your response. Please try again.",
    )
  })
})
