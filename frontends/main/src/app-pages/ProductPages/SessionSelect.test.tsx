import React from "react"
import { renderWithProviders, screen, user } from "@/test-utils"
import { factories as mitxFactories } from "api/mitxonline-test-utils"
import { formatDate } from "ol-utilities"
import SessionSelect from "./SessionSelect"

const makeRun = mitxFactories.courses.courseRun

describe("SessionSelect", () => {
  test("lists runs and emits the chosen run id via onChange(Number)", async () => {
    const a = makeRun({ start_date: "2026-09-08", end_date: "2026-12-16" })
    const b = makeRun({ start_date: "2027-01-10", end_date: "2027-04-01" })
    const onChange = jest.fn()
    renderWithProviders(
      <SessionSelect runs={[a, b]} selectedRunId={a.id} onChange={onChange} />,
    )
    await user.click(screen.getByRole("combobox", { name: /session/i }))
    await user.click(
      screen.getByRole("option", {
        name: new RegExp(formatDate(b.start_date!, "MMM D"), "i"),
      }),
    )
    expect(onChange).toHaveBeenCalledWith(b.id)
  })

  test("marks runs the user is enrolled in with '— Enrolled'", async () => {
    const a = makeRun({ start_date: "2026-09-08" })
    const b = makeRun({ start_date: "2027-01-10" })
    renderWithProviders(
      <SessionSelect
        runs={[a, b]}
        selectedRunId={a.id}
        enrolledRunIds={[b.id]}
        onChange={jest.fn()}
      />,
    )
    await user.click(screen.getByRole("combobox", { name: /session/i }))
    expect(
      screen.getByRole("option", {
        name: new RegExp(
          `${formatDate(b.start_date!, "MMM D")}.*Enrolled`,
          "i",
        ),
      }),
    ).toBeInTheDocument()
  })

  test("collapses the redundant start-year for a same-year range", async () => {
    const run = makeRun({ start_date: "2026-09-08", end_date: "2026-12-16" })
    renderWithProviders(
      <SessionSelect
        runs={[run]}
        selectedRunId={run.id}
        onChange={jest.fn()}
      />,
    )
    await user.click(screen.getByRole("combobox", { name: /session/i }))
    expect(
      screen.getByRole("option", { name: "Sep 8 - Dec 16, 2026" }),
    ).toBeInTheDocument()
  })

  test("keeps both years for a cross-year range", async () => {
    const run = makeRun({ start_date: "2026-12-08", end_date: "2027-02-12" })
    renderWithProviders(
      <SessionSelect
        runs={[run]}
        selectedRunId={run.id}
        onChange={jest.fn()}
      />,
    )
    await user.click(screen.getByRole("combobox", { name: /session/i }))
    expect(
      screen.getByRole("option", { name: "Dec 8, 2026 - Feb 12, 2027" }),
    ).toBeInTheDocument()
  })

  test("shows 'Anytime' for a self-paced run with a past start date", async () => {
    const selfPaced = makeRun({
      is_self_paced: true,
      is_archived: false,
      start_date: "2020-01-01T00:00:00Z",
    })
    const other = makeRun({ start_date: "2027-06-01" })
    renderWithProviders(
      <SessionSelect
        runs={[selfPaced, other]}
        selectedRunId={selfPaced.id}
        onChange={jest.fn()}
      />,
    )
    await user.click(screen.getByRole("combobox", { name: /session/i }))
    expect(screen.getByRole("option", { name: /anytime/i })).toBeInTheDocument()
  })
})
