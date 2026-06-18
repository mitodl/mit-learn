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
  it("returns 'none' when run is undefined", () => {
    expect(getCourseScenario(undefined)).toBe("none")
  })

  it("returns 'archived' when run is archived", () => {
    const run = makeRun({
      is_archived: true,
      is_enrollable: true,
      is_upgradable: true,
      enrollment_modes: [makeMode({ requires_payment: false })],
      products: [],
    })
    expect(getCourseScenario(run)).toBe("archived")
  })

  it("returns 'both' when paid cert is purchasable and free audit is also available", () => {
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
    expect(getCourseScenario(run)).toBe("both")
  })

  it("returns 'paidOnly' when paid cert is purchasable and no free mode", () => {
    const run = makeRun({
      is_enrollable: true,
      is_archived: false,
      is_upgradable: true,
      enrollment_modes: [makeMode({ requires_payment: true })],
      products: [makeProduct({ price: "100" })],
    })
    expect(getCourseScenario(run)).toBe("paidOnly")
  })

  it("returns 'freeOnly' when only free mode available", () => {
    const run = makeRun({
      is_enrollable: true,
      is_archived: false,
      is_upgradable: false,
      enrollment_modes: [makeMode({ requires_payment: false })],
      products: [],
    })
    expect(getCourseScenario(run)).toBe("freeOnly")
  })

  it("returns 'deadlinePassed' when paid offered but not purchasable and free mode exists", () => {
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
    expect(getCourseScenario(run)).toBe("deadlinePassed")
  })

  it("returns 'none' for degenerate paid-only past deadline with no free mode", () => {
    const run = makeRun({
      is_enrollable: true,
      is_archived: false,
      is_upgradable: false,
      enrollment_modes: [makeMode({ requires_payment: true })],
      products: [makeProduct({ price: "100" })],
    })
    expect(getCourseScenario(run)).toBe("none")
  })
})
