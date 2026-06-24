import { factories } from "api/mitxonline-test-utils"
import {
  getEnrollableRuns,
  getSelectedRun,
  getCourseScenario,
} from "./courseRun"

const makeRun = factories.courses.courseRun
const makeMode = factories.courses.enrollmentMode
const makeProduct = factories.courses.product
const makeCourse = factories.courses.course

describe("getEnrollableRuns", () => {
  it("returns only is_enrollable runs", () => {
    const enrollable = makeRun({ is_enrollable: true })
    const notEnrollable = makeRun({ is_enrollable: false })
    const course = makeCourse({ courseruns: [enrollable, notEnrollable] })
    expect(getEnrollableRuns(course)).toEqual([enrollable])
  })
})

describe("getSelectedRun", () => {
  it("defaults to the best/next run when no selectedRunId provided", () => {
    const run = makeRun({ is_enrollable: true })
    const course = makeCourse({ courseruns: [run], next_run_id: run.id })
    expect(getSelectedRun(course)).toEqual(run)
  })

  it("honors an explicit enrollable selectedRunId", () => {
    const run1 = makeRun({ is_enrollable: true })
    const run2 = makeRun({ is_enrollable: true })
    const course = makeCourse({
      courseruns: [run1, run2],
      next_run_id: run1.id,
    })
    expect(getSelectedRun(course, run2.id)).toEqual(run2)
  })

  it("falls back to best run when the given id is not enrollable", () => {
    const best = makeRun({ is_enrollable: true })
    const notEnrollable = makeRun({ is_enrollable: false })
    const course = makeCourse({
      courseruns: [best, notEnrollable],
      next_run_id: best.id,
    })
    expect(getSelectedRun(course, notEnrollable.id)).toEqual(best)
  })
})

describe("getCourseScenario", () => {
  it("returns an inert active/none scenario when run is undefined", () => {
    expect(getCourseScenario(undefined)).toEqual({
      status: "active",
      offering: "none",
    })
  })

  it("is archived + audit-only access when the run is archived", () => {
    const run = makeRun({
      is_archived: true,
      is_enrollable: true,
      is_upgradable: true,
      enrollment_modes: [makeMode({ requires_payment: false })],
      products: [],
    })
    expect(getCourseScenario(run)).toEqual({
      status: "archived",
      offering: "free",
    })
  })

  it("offers both when paid cert is purchasable and free audit is also available", () => {
    const run = makeRun({
      is_enrollable: true,
      is_archived: false,
      is_upgradable: true,
      enrollment_modes: [
        makeMode({ requires_payment: false }),
        makeMode({ requires_payment: true }),
      ],
      products: [makeProduct({ price: "100" })],
    })
    expect(getCourseScenario(run)).toEqual({
      status: "active",
      offering: "both",
    })
  })

  it("offers paid only when paid cert is purchasable and there is no free mode", () => {
    const run = makeRun({
      is_enrollable: true,
      is_archived: false,
      is_upgradable: true,
      enrollment_modes: [makeMode({ requires_payment: true })],
      products: [makeProduct({ price: "100" })],
    })
    expect(getCourseScenario(run)).toEqual({
      status: "active",
      offering: "paid",
    })
  })

  it("offers free only when only a free mode is available", () => {
    const run = makeRun({
      is_enrollable: true,
      is_archived: false,
      is_upgradable: false,
      enrollment_modes: [makeMode({ requires_payment: false })],
      products: [],
    })
    expect(getCourseScenario(run)).toEqual({
      status: "active",
      offering: "free",
    })
  })

  it("is deadlinePassed + free when paid is offered but not purchasable and a free mode exists", () => {
    const run = makeRun({
      is_enrollable: true,
      is_archived: false,
      is_upgradable: false,
      enrollment_modes: [
        makeMode({ requires_payment: false }),
        makeMode({ requires_payment: true }),
      ],
      products: [makeProduct({ price: "250" })],
    })
    expect(getCourseScenario(run)).toEqual({
      status: "deadlinePassed",
      offering: "free",
    })
  })

  it("is deadlinePassed + none for a paid-only run past its deadline (no free fallback, but still warns)", () => {
    const run = makeRun({
      is_enrollable: true,
      is_archived: false,
      is_upgradable: false,
      enrollment_modes: [makeMode({ requires_payment: true })],
      products: [makeProduct({ price: "100" })],
    })
    expect(getCourseScenario(run)).toEqual({
      status: "deadlinePassed",
      offering: "none",
    })
  })
})
