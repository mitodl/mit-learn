import React from "react"
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
  duplicateCount: 0,
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
      screen.getByText(/seats remaining after sending/i),
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
        duplicateCount={2}
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
        duplicateCount={1}
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
      screen.getByRole("button", { name: /\+ 2 more/i }),
    ).toBeInTheDocument()
  })

  test("expands full list when show more is clicked", async () => {
    const emails = ["a@x.com", "b@x.com", "c@x.com", "d@x.com", "e@x.com"]
    renderWithTheme(
      <AssignSeatsConfirmModal {...baseProps} invalidEmails={emails} />,
    )

    await user.click(screen.getByRole("button", { name: /\+ 2 more/i }))

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

    expect(screen.getByText(/4 rows skipped/i)).toBeInTheDocument()
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
