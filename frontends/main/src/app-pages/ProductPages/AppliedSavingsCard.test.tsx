import React from "react"
import user from "@testing-library/user-event"
import { renderWithProviders, screen } from "@/test-utils"
import AppliedSavingsCard from "./AppliedSavingsCard"
import type { AppliedSavings } from "./enrollTypes"

const breakdown = (
  overrides: Partial<AppliedSavings> = {},
): AppliedSavings => ({
  fullPrice: "$899",
  amountOff: "$300",
  todaysPrice: "$599",
  sourceTitle: null,
  kind: "other",
  ...overrides,
})

describe("AppliedSavingsCard", () => {
  test("the three rows pair each label with its amount, and the deduction reads as a subtraction", () => {
    const savings = breakdown()

    renderWithProviders(
      <AppliedSavingsCard breakdown={savings} productNoun="program" />,
    )

    expect(screen.getAllByRole("term").map((el) => el.textContent)).toEqual([
      "Program price",
      // No sub-label: this breakdown names no source and is not aid.
      "Applied savings",
      "Today’s price",
    ])
    expect(
      screen.getAllByRole("definition").map((el) => el.textContent),
    ).toEqual([
      savings.fullPrice,
      `minus − ${savings.amountOff}`,
      savings.todaysPrice,
    ])
  })

  test("a purchase credit names the course and explains the rule", async () => {
    const savings = breakdown({
      kind: "credit",
      sourceTitle: "Fundamentals of Deep Learning",
    })

    renderWithProviders(
      <AppliedSavingsCard breakdown={savings} productNoun="program" />,
    )

    expect(screen.getByText(savings.sourceTitle!)).toBeVisible()
    await user.click(screen.getByRole("button", { name: "Applied savings" }))
    expect(await screen.findByRole("dialog")).toHaveTextContent(
      "One previous purchase from this program can be credited toward the full program's price.",
    )
  })

  test("financial aid names itself and gets its own explanation", async () => {
    renderWithProviders(
      <AppliedSavingsCard
        breakdown={breakdown({ kind: "aid" })}
        productNoun="program"
      />,
    )

    expect(screen.getByText("Financial aid")).toBeVisible()
    await user.click(screen.getByRole("button", { name: "Applied savings" }))
    expect(await screen.findByRole("dialog")).toHaveTextContent(
      "Based on your approved financial aid.",
    )
  })

  test("any other discount shows the amount with nothing to explain", () => {
    renderWithProviders(
      <AppliedSavingsCard breakdown={breakdown()} productNoun="program" />,
    )

    expect(screen.queryByRole("button", { name: "Applied savings" })).toBeNull()
  })
})
