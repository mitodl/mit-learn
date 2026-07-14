import { factories as mitxFactories } from "api/mitxonline-test-utils"
import { getProgramOffering } from "./programOffering"

const makeProgram = mitxFactories.programs.program
const makeMode = mitxFactories.courses.enrollmentMode
const makeProduct = mitxFactories.courses.product

describe("getProgramOffering", () => {
  test("paid-only with a purchasable product -> 'paid'", () => {
    const program = makeProgram({
      enrollment_modes: [makeMode({ requires_payment: true })],
      products: [makeProduct({ price: "100" })],
    })
    expect(getProgramOffering(program)).toBe("paid")
  })

  test("both with a purchasable product -> 'both'", () => {
    const program = makeProgram({
      enrollment_modes: [
        makeMode({ requires_payment: false }),
        makeMode({ requires_payment: true }),
      ],
      products: [makeProduct({ price: "100" })],
    })
    expect(getProgramOffering(program)).toBe("both")
  })

  test("free-only -> 'free'", () => {
    const program = makeProgram({
      enrollment_modes: [makeMode({ requires_payment: false })],
      products: [],
    })
    expect(getProgramOffering(program)).toBe("free")
  })

  test("no enrollment modes -> 'none'", () => {
    const program = makeProgram({ enrollment_modes: [], products: [] })
    expect(getProgramOffering(program)).toBe("none")
  })

  test("demotion: paid-only without a purchasable product -> 'none'", () => {
    const program = makeProgram({
      enrollment_modes: [makeMode({ requires_payment: true })],
      products: [],
    })
    expect(getProgramOffering(program)).toBe("none")
  })

  test("demotion: both without a purchasable product -> 'free'", () => {
    const program = makeProgram({
      enrollment_modes: [
        makeMode({ requires_payment: false }),
        makeMode({ requires_payment: true }),
      ],
      products: [],
    })
    expect(getProgramOffering(program)).toBe("free")
  })
})
