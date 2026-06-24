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

  test("annotates a self-paced past-start run 'Start Anytime' in the menu, but shows dates only when collapsed", async () => {
    const selfPaced = makeRun({
      is_self_paced: true,
      is_archived: false,
      start_date: "2020-01-01T00:00:00Z",
      end_date: "2026-06-01",
    })
    const other = makeRun({ start_date: "2027-06-01" })
    renderWithProviders(
      <SessionSelect
        runs={[selfPaced, other]}
        selectedRunId={selfPaced.id}
        onChange={jest.fn()}
      />,
    )
    // Collapsed value: the date range, not a bare "Anytime", and without the
    // annotation (it would overflow — CourseSummary surfaces it on its own line).
    const combobox = screen.getByRole("combobox", { name: /session/i })
    expect(combobox).toHaveTextContent("Jan 1, 2020")
    expect(combobox).not.toHaveTextContent("Start Anytime")
    // ...but the open menu annotates the option.
    await user.click(combobox)
    expect(
      screen.getByRole("option", { name: /Jan 1, 2020.*Start Anytime/ }),
    ).toBeInTheDocument()
  })

  test("orders options by start date, latest first", async () => {
    // Instructor-paced so its past start date doesn't pick up a "Start Anytime"
    // annotation, which would muddy the label-order assertion below.
    const past = makeRun({
      start_date: "2025-01-10",
      end_date: "2025-04-01",
      is_self_paced: false,
    })
    const soon = makeRun({ start_date: "2026-09-08", end_date: "2026-12-16" })
    const later = makeRun({ start_date: "2027-01-10", end_date: "2027-04-01" })
    // Pass them out of order to prove the component sorts.
    renderWithProviders(
      <SessionSelect
        runs={[soon, past, later]}
        selectedRunId={soon.id}
        onChange={jest.fn()}
      />,
    )
    await user.click(screen.getByRole("combobox", { name: /session/i }))
    const options = screen.getAllByRole("option").map((o) => o.textContent)
    expect(options).toEqual([
      "Jan 10 - Apr 1, 2027",
      "Sep 8 - Dec 16, 2026",
      "Jan 10 - Apr 1, 2025",
    ])
  })

  test("collapsed value shows dates but omits '— Enrolled' (the standalone Enrolled button covers it)", async () => {
    const run = makeRun({
      start_date: "2026-09-08",
      end_date: "2026-12-16",
      is_self_paced: false,
    })
    renderWithProviders(
      <SessionSelect
        runs={[run]}
        selectedRunId={run.id}
        enrolledRunIds={[run.id]}
        onChange={jest.fn()}
      />,
    )
    // Collapsed combobox: dates, no "— Enrolled"
    const combobox = screen.getByRole("combobox", { name: /session/i })
    expect(combobox).toHaveTextContent("Sep 8 - Dec 16, 2026")
    expect(combobox).not.toHaveTextContent("Enrolled")

    // ...but the open menu still marks it enrolled
    await user.click(combobox)
    expect(
      screen.getByRole("option", { name: /Sep 8 - Dec 16, 2026 — Enrolled/ }),
    ).toBeInTheDocument()
  })
})
