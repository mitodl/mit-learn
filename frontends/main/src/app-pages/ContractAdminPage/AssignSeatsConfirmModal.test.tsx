import React, { act } from "react"
import { renderWithTheme, screen, user } from "@/test-utils"
import { AssignSeatsConfirmModal } from "./AssignSeatsConfirmModal"

const baseProps = {
  open: true,
  onClose: jest.fn(),
  onConfirm: jest.fn(),
  validCount: 3,
  availableSeats: 10,
  invalidEmails: [],
  duplicateEmails: [],
  skippedCount: 0,
}

describe("AssignSeatsConfirmModal — confirm step (no issues)", () => {
  beforeEach(() => jest.clearAllMocks())

  test("shows 'Ready to send invitations' title when there are no issues", () => {
    renderWithTheme(<AssignSeatsConfirmModal {...baseProps} />)

    expect(
      screen.getByRole("heading", { name: /ready to send invitations/i }),
    ).toBeInTheDocument()
  })

  test("shows invitation count in the send button", () => {
    renderWithTheme(<AssignSeatsConfirmModal {...baseProps} />)

    expect(
      screen.getByRole("button", { name: /send 3 invitations/i }),
    ).toBeInTheDocument()
  })

  test("shows singular form for one invitation", () => {
    renderWithTheme(<AssignSeatsConfirmModal {...baseProps} validCount={1} />)

    expect(
      screen.getByRole("button", { name: /send 1 invitation$/i }),
    ).toBeInTheDocument()
  })

  test("shows seats-remaining stat", () => {
    renderWithTheme(
      <AssignSeatsConfirmModal
        {...baseProps}
        validCount={3}
        availableSeats={10}
      />,
    )

    expect(screen.getByText("7")).toBeInTheDocument()
    expect(
      screen.getByRole("group", { name: /7 seats remaining after sending/i }),
    ).toBeInTheDocument()
  })

  test("calls onConfirm and then onClose when Send is clicked", async () => {
    renderWithTheme(<AssignSeatsConfirmModal {...baseProps} />)

    await user.click(
      screen.getByRole("button", { name: /send 3 invitations/i }),
    )

    expect(baseProps.onConfirm).toHaveBeenCalledTimes(1)
    expect(baseProps.onClose).toHaveBeenCalledTimes(1)
  })

  test("calls onClose when Cancel is clicked", async () => {
    renderWithTheme(<AssignSeatsConfirmModal {...baseProps} />)

    await user.click(screen.getByRole("button", { name: /cancel/i }))

    expect(baseProps.onClose).toHaveBeenCalledTimes(1)
  })

  test("shows 'Sending…' on the Send button while submitting", async () => {
    const { promise, resolve } = Promise.withResolvers<void>()
    renderWithTheme(
      <AssignSeatsConfirmModal {...baseProps} onConfirm={() => promise} />,
    )

    await user.click(
      screen.getByRole("button", { name: /send 3 invitations/i }),
    )

    expect(
      screen.getByRole("button", { name: /sending…/i }),
    ).toBeInTheDocument()

    await act(async () => {
      resolve()
    })
  })
})

describe("AssignSeatsConfirmModal — review step (has issues)", () => {
  beforeEach(() => jest.clearAllMocks())

  test("shows review step when there are invalid emails", () => {
    renderWithTheme(
      <AssignSeatsConfirmModal
        {...baseProps}
        invalidEmails={["bad@", "alsabad@"]}
      />,
    )

    expect(
      screen.getByRole("heading", {
        name: /some learners could not be added/i,
      }),
    ).toBeInTheDocument()
  })

  test("shows 'Duplicate emails removed' title when only duplicates exist", () => {
    renderWithTheme(
      <AssignSeatsConfirmModal
        {...baseProps}
        duplicateEmails={["dup@example.com", "dup2@example.com"]}
      />,
    )

    expect(
      screen.getByRole("heading", { name: /duplicate emails removed/i }),
    ).toBeInTheDocument()
  })

  test("shows invalid email addresses in an alert box", () => {
    renderWithTheme(
      <AssignSeatsConfirmModal
        {...baseProps}
        invalidEmails={["bad@", "alsabad@"]}
      />,
    )

    expect(screen.getByText("bad@")).toBeInTheDocument()
    expect(screen.getByText("alsabad@")).toBeInTheDocument()
    expect(
      screen.getByText(/invalid email addresses \(2\)/i),
    ).toBeInTheDocument()
  })

  test("shows duplicate emails in an alert box", () => {
    renderWithTheme(
      <AssignSeatsConfirmModal
        {...baseProps}
        duplicateEmails={["dup@example.com"]}
      />,
    )

    expect(screen.getByText("dup@example.com")).toBeInTheDocument()
    expect(
      screen.getByText(/duplicate email addresses \(1\)/i),
    ).toBeInTheDocument()
  })

  test("collapses email list beyond 3 items with show-more button", () => {
    const emails = ["a@x.com", "b@x.com", "c@x.com", "d@x.com", "e@x.com"]
    renderWithTheme(
      <AssignSeatsConfirmModal {...baseProps} invalidEmails={emails} />,
    )

    expect(screen.getByText("a@x.com")).toBeInTheDocument()
    expect(screen.queryByText("d@x.com")).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /show 2 more email addresses/i }),
    ).toBeInTheDocument()
  })

  test("expands full list when show more is clicked", async () => {
    const emails = ["a@x.com", "b@x.com", "c@x.com", "d@x.com", "e@x.com"]
    renderWithTheme(
      <AssignSeatsConfirmModal {...baseProps} invalidEmails={emails} />,
    )

    await user.click(
      screen.getByRole("button", { name: /show 2 more email addresses/i }),
    )

    expect(screen.getByText("e@x.com")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /more/i }),
    ).not.toBeInTheDocument()
  })

  test("shows skipped count in description when rows were skipped", () => {
    renderWithTheme(
      <AssignSeatsConfirmModal
        {...baseProps}
        invalidEmails={["bad@"]}
        skippedCount={4}
      />,
    )

    expect(
      screen.getByText(/4 rows skipped/i, { selector: "strong" }),
    ).toBeInTheDocument()
  })

  test("advancing from review step shows confirm step", async () => {
    renderWithTheme(
      <AssignSeatsConfirmModal {...baseProps} invalidEmails={["bad@"]} />,
    )

    await user.click(screen.getByRole("button", { name: /review & confirm/i }))

    expect(
      screen.getByRole("heading", { name: /ready to send invitations/i }),
    ).toBeInTheDocument()
  })

  test("shows review step when only skippedCount > 0 (no invalid or duplicate)", () => {
    renderWithTheme(<AssignSeatsConfirmModal {...baseProps} skippedCount={3} />)

    expect(
      screen.getByRole("heading", { name: /some rows were skipped/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/3 rows skipped/i, { selector: "strong" }),
    ).toBeInTheDocument()
  })
})

describe("AssignSeatsConfirmModal — over-capacity state (CSV only)", () => {
  beforeEach(() => jest.clearAllMocks())

  test("shows 'Not enough seats available' title when over capacity", () => {
    renderWithTheme(
      <AssignSeatsConfirmModal
        {...baseProps}
        validCount={15}
        availableSeats={10}
      />,
    )

    expect(
      screen.getByRole("heading", { name: /not enough seats available/i }),
    ).toBeInTheDocument()
    // role="alertdialog" is applied to the MUI paper via PaperProps, which also
    // carries aria-describedby. alertdialog is a subtype of dialog per ARIA, so
    // getByRole("dialog") matches the same element.
    expect(screen.getByRole("alertdialog")).toBeInTheDocument()
    expect(screen.getByRole("alertdialog")).toHaveAccessibleDescription(
      /15 learners were imported, but only 10 seats remain/i,
    )
  })

  test("shows imported, available, and over-limit stats", () => {
    renderWithTheme(
      <AssignSeatsConfirmModal
        {...baseProps}
        validCount={15}
        availableSeats={10}
      />,
    )

    expect(screen.getAllByText("15")[0]).toBeInTheDocument()
    expect(screen.getByText("10")).toBeInTheDocument()
    expect(screen.getByText("5")).toBeInTheDocument()
    expect(screen.getByText("Imported")).toBeInTheDocument()
    expect(screen.getByText("Seats available")).toBeInTheDocument()
    expect(screen.getByText("Over the limit")).toBeInTheDocument()
  })

  test("shows only 'Close & Update CSV' button with no Cancel", () => {
    renderWithTheme(
      <AssignSeatsConfirmModal
        {...baseProps}
        validCount={15}
        availableSeats={10}
      />,
    )

    expect(
      screen.getByRole("button", { name: /close & update csv/i }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /cancel/i }),
    ).not.toBeInTheDocument()
  })

  test("'Close & Update CSV' calls onClose and not onConfirm", async () => {
    renderWithTheme(
      <AssignSeatsConfirmModal
        {...baseProps}
        validCount={15}
        availableSeats={10}
      />,
    )

    await user.click(
      screen.getByRole("button", { name: /close & update csv/i }),
    )

    expect(baseProps.onClose).toHaveBeenCalledTimes(1)
    expect(baseProps.onConfirm).not.toHaveBeenCalled()
  })
})

describe("AssignSeatsConfirmModal — copy buttons", () => {
  afterEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    })
  })

  test("copies invalid emails to clipboard and shows Copied! feedback", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    })
    renderWithTheme(
      <AssignSeatsConfirmModal
        {...baseProps}
        invalidEmails={["bad@", "alsobad@"]}
      />,
    )

    await user.click(
      screen.getByRole("button", { name: /copy all invalid emails/i }),
    )

    expect(writeText).toHaveBeenCalledWith("bad@\nalsobad@")
    expect(
      await screen.findByRole("button", { name: /copied!/i }),
    ).toBeInTheDocument()
  })

  test("copies duplicate emails to clipboard and shows Copied! feedback", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    })
    renderWithTheme(
      <AssignSeatsConfirmModal
        {...baseProps}
        duplicateEmails={["dup@example.com", "dup2@example.com"]}
      />,
    )

    await user.click(
      screen.getByRole("button", { name: /copy all duplicate emails/i }),
    )

    expect(writeText).toHaveBeenCalledWith("dup@example.com\ndup2@example.com")
    expect(
      await screen.findByRole("button", { name: /copied!/i }),
    ).toBeInTheDocument()
  })

  test("announces copy success to screen readers via aria-live region", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: jest.fn().mockResolvedValue(undefined) },
      configurable: true,
    })
    renderWithTheme(
      <AssignSeatsConfirmModal {...baseProps} invalidEmails={["bad@"]} />,
    )

    const liveRegion = document.querySelector("[aria-live='polite']")
    expect(liveRegion).toHaveTextContent("")

    await user.click(
      screen.getByRole("button", { name: /copy all invalid emails/i }),
    )

    await screen.findByRole("button", { name: /copied!/i })
    expect(liveRegion).toHaveTextContent("Copied invalid emails to clipboard.")
  })

  test("falls back to execCommand when clipboard API is unavailable (invalid emails)", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    })
    document.execCommand = jest.fn().mockImplementation((cmd: string) => {
      if (cmd === "copy") {
        document.dispatchEvent(
          new Event("copy", { bubbles: true, cancelable: true }),
        )
        return true
      }
      return false
    })
    renderWithTheme(
      <AssignSeatsConfirmModal {...baseProps} invalidEmails={["bad@"]} />,
    )

    await user.click(
      screen.getByRole("button", { name: /copy all invalid emails/i }),
    )

    expect(document.execCommand).toHaveBeenCalledWith("copy")
    expect(
      await screen.findByRole("button", { name: /copied!/i }),
    ).toBeInTheDocument()
  })

  test("falls back to execCommand when clipboard API is unavailable (duplicate emails)", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    })
    document.execCommand = jest.fn().mockImplementation((cmd: string) => {
      if (cmd === "copy") {
        document.dispatchEvent(
          new Event("copy", { bubbles: true, cancelable: true }),
        )
        return true
      }
      return false
    })
    renderWithTheme(
      <AssignSeatsConfirmModal
        {...baseProps}
        duplicateEmails={["dup@example.com"]}
      />,
    )

    await user.click(
      screen.getByRole("button", { name: /copy all duplicate emails/i }),
    )

    expect(document.execCommand).toHaveBeenCalledWith("copy")
    expect(
      await screen.findByRole("button", { name: /copied!/i }),
    ).toBeInTheDocument()
  })

  test("does not show Copied! when both clipboard and execCommand fail", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    })
    document.execCommand = jest.fn().mockReturnValue(false)
    renderWithTheme(
      <AssignSeatsConfirmModal {...baseProps} invalidEmails={["bad@"]} />,
    )

    await user.click(
      screen.getByRole("button", { name: /copy all invalid emails/i }),
    )

    expect(
      screen.queryByRole("button", { name: /copied!/i }),
    ).not.toBeInTheDocument()
  })
})
