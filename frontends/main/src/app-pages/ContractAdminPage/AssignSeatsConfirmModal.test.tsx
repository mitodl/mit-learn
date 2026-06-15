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
  duplicateCount: 0,
  skippedCount: 0,
}

describe("AssignSeatsConfirmModal", () => {
  beforeEach(() => jest.clearAllMocks())

  test("shows valid count in title and confirm button", () => {
    renderWithTheme(<AssignSeatsConfirmModal {...baseProps} />)

    expect(
      screen.getByRole("heading", { name: /3 emails ready to assign/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /send 3 emails/i }),
    ).toBeInTheDocument()
  })

  test("shows singular form for a single email", () => {
    renderWithTheme(<AssignSeatsConfirmModal {...baseProps} validCount={1} />)

    expect(
      screen.getByRole("heading", { name: /1 email ready to assign/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /send 1 email/i }),
    ).toBeInTheDocument()
  })

  test("shows confirmation copy when there are no issues", () => {
    renderWithTheme(<AssignSeatsConfirmModal {...baseProps} />)

    expect(
      screen.getAllByText(/are you sure you want to send/i)[0],
    ).toBeInTheDocument()
  })

  test("shows imported copy when there are issues", () => {
    renderWithTheme(
      <AssignSeatsConfirmModal
        {...baseProps}
        invalidEmails={["bad@example"]}
      />,
    )

    expect(
      screen.getAllByText(/imported and ready to assign/i)[0],
    ).toBeInTheDocument()
  })

  test("shows duplicate count when duplicates were removed", () => {
    renderWithTheme(
      <AssignSeatsConfirmModal {...baseProps} duplicateCount={2} />,
    )

    expect(screen.getAllByText(/2 duplicates removed/i)[0]).toBeInTheDocument()
  })

  test("does not show duplicate section when duplicateCount is 0", () => {
    renderWithTheme(
      <AssignSeatsConfirmModal {...baseProps} duplicateCount={0} />,
    )

    expect(screen.queryByText(/duplicate/i)).not.toBeInTheDocument()
  })

  test("shows skipped row count when rows were skipped", () => {
    renderWithTheme(<AssignSeatsConfirmModal {...baseProps} skippedCount={3} />)

    expect(screen.getAllByText(/3 rows skipped/i)[0]).toBeInTheDocument()
    expect(
      screen.getAllByText(/no email address found/i)[0],
    ).toBeInTheDocument()
  })

  test("does not show skipped section when skippedCount is 0", () => {
    renderWithTheme(<AssignSeatsConfirmModal {...baseProps} skippedCount={0} />)

    expect(screen.queryByText(/skipped/i)).not.toBeInTheDocument()
  })

  test("lists invalid emails", () => {
    renderWithTheme(
      <AssignSeatsConfirmModal
        {...baseProps}
        invalidEmails={["bad@", "also-bad@"]}
      />,
    )

    expect(screen.getByText("bad@")).toBeInTheDocument()
    expect(screen.getByText("also-bad@")).toBeInTheDocument()
    expect(
      screen.getByText(/these addresses were not valid/i),
    ).toBeInTheDocument()
  })

  test("does not show invalid section when invalidEmails is empty", () => {
    renderWithTheme(<AssignSeatsConfirmModal {...baseProps} />)

    expect(
      screen.queryByText(/these addresses were not valid/i),
    ).not.toBeInTheDocument()
  })

  test("collapses long invalid list beyond 10 items", () => {
    const manyEmails = Array.from({ length: 15 }, (_, i) => `bad${i}@`)
    renderWithTheme(
      <AssignSeatsConfirmModal {...baseProps} invalidEmails={manyEmails} />,
    )

    // First 10 visible, rest hidden behind show more
    expect(screen.getByText("bad0@")).toBeInTheDocument()
    expect(screen.queryByText("bad10@")).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /\+5 more/i }),
    ).toBeInTheDocument()
  })

  test("expands full list when show more is clicked", async () => {
    const manyEmails = Array.from({ length: 15 }, (_, i) => `bad${i}@`)
    renderWithTheme(
      <AssignSeatsConfirmModal {...baseProps} invalidEmails={manyEmails} />,
    )

    await user.click(screen.getByRole("button", { name: /\+5 more/i }))

    expect(screen.getByText("bad14@")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /more/i }),
    ).not.toBeInTheDocument()
  })

  test("shows over-capacity warning when validCount exceeds availableSeats", () => {
    renderWithTheme(
      <AssignSeatsConfirmModal
        {...baseProps}
        validCount={15}
        availableSeats={10}
      />,
    )

    expect(
      screen.getAllByText(/only 10 unassigned seats available\./i).length,
    ).toBeGreaterThan(0)
  })

  test("does not show over-capacity warning when validCount is within availableSeats", () => {
    renderWithTheme(
      <AssignSeatsConfirmModal
        {...baseProps}
        validCount={3}
        availableSeats={10}
      />,
    )

    expect(
      screen.queryByText(/only \d+ unassigned seat/i),
    ).not.toBeInTheDocument()
  })

  test("calls onClose when Cancel is clicked", async () => {
    renderWithTheme(<AssignSeatsConfirmModal {...baseProps} />)

    await user.click(screen.getByRole("button", { name: /cancel/i }))

    expect(baseProps.onClose).toHaveBeenCalledTimes(1)
  })

  test("calls onConfirm when Send is clicked", async () => {
    renderWithTheme(<AssignSeatsConfirmModal {...baseProps} />)

    await user.click(screen.getByRole("button", { name: /send 3 emails/i }))

    expect(baseProps.onConfirm).toHaveBeenCalledTimes(1)
  })
})
