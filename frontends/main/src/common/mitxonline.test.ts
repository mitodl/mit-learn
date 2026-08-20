import { factories, RequirementTreeBuilder } from "api/mitxonline-test-utils"
import { DiscountTypeEnum, NodeTypeEnum } from "@mitodl/mitxonline-api-axios/v2"
import {
  formatPrice,
  formatPriceRange,
  formatResourcePrice,
  getFlexiblePriceForProduct,
  getIdsFromReqTree,
  parseProgramRequirementSections,
  priceWithDiscount,
  toPriceRange,
} from "@/common/mitxonline"

const makeFlexiblePrice = factories.products.flexiblePrice

describe("formatPrice", () => {
  test.each([
    { input: 100, expected: "$100" },
    { input: "100.00", expected: "$100" },
    { input: 149, expected: "$149" },
    { input: "149.00", expected: "$149" },
    { input: 100.5, expected: "$100.50" },
    { input: "100.50", expected: "$100.50" },
    { input: 100.25, expected: "$100.25" },
    { input: "99.99", expected: "$99.99" },
  ])("formatPrice($input) === '$expected'", ({ input, expected }) => {
    expect(formatPrice(input)).toBe(expected)
  })

  test.each([
    { input: 100, expected: "$100.00" },
    { input: "100.00", expected: "$100.00" },
    { input: 100.5, expected: "$100.50" },
    { input: "99.99", expected: "$99.99" },
  ])(
    "formatPrice($input, { avoidCents: false }) === '$expected'",
    ({ input, expected }) => {
      expect(formatPrice(input, { avoidCents: false })).toBe(expected)
    },
  )
})

describe("toPriceRange", () => {
  test("min below max is an advertised range", () => {
    expect(toPriceRange({ min_price: 250, max_price: 1000 })).toEqual({
      min: 250,
      max: 1000,
    })
  })

  test.each([
    { label: "equal prices", resource: { min_price: 500, max_price: 500 } },
    { label: "min above max", resource: { min_price: 199, max_price: 198.98 } },
    { label: "missing min", resource: { min_price: null, max_price: 1000 } },
    { label: "missing max", resource: { min_price: 250, max_price: null } },
  ])("$label is not a range", ({ resource }) => {
    expect(toPriceRange(resource)).toBeNull()
  })
})

describe("formatPriceRange", () => {
  test("renders an en dash with surrounding spaces, matching the resource drawer", () => {
    expect(formatPriceRange({ min: 250, max: 1000 })).toBe("$250 – $1,000")
  })

  test("a min equal to max renders as one price", () => {
    expect(formatPriceRange({ min: 500, max: 500 })).toBe("$500")
  })

  test("passes cents handling through to both ends", () => {
    expect(
      formatPriceRange({ min: 250, max: 1000 }, { avoidCents: false }),
    ).toBe("$250.00 – $1,000.00")
  })
})

describe("formatResourcePrice", () => {
  test("prefers the advertised range over the product price", () => {
    expect(
      formatResourcePrice({ min_price: 250, max_price: 1000 }, "600.00"),
    ).toBe("$250 – $1,000")
  })

  test("falls back to the product price when no range is advertised", () => {
    expect(
      formatResourcePrice({ min_price: 1000, max_price: 1000 }, "999.00"),
    ).toBe("$999")
  })

  test("uses the advertised price when there is no product", () => {
    expect(formatResourcePrice({ min_price: 250, max_price: 250 }, null)).toBe(
      "$250",
    )
  })

  test("no advertised price and no product price -> null", () => {
    expect(
      formatResourcePrice({ min_price: null, max_price: null }, null),
    ).toBeNull()
  })
})

describe("getFlexiblePriceForProduct", () => {
  test("Applies dollars-off discount correctly", () => {
    const product = makeFlexiblePrice({
      price: "100.00",
      product_flexible_price: {
        id: 1,
        amount: "25.00",
        discount_type: DiscountTypeEnum.DollarsOff,
        discount_code: "TEST25",
        redemption_type: "one-time",
        is_redeemed: false,
        automatic: true,
        max_redemptions: 1,
        payment_type: null,
        activation_date: new Date().toISOString(),
        expiration_date: new Date().toISOString(),
      },
    })

    const result = getFlexiblePriceForProduct(product)

    expect(result).toBe(75) // $100 - $25
  })

  test("Applies percent-off discount correctly", () => {
    const product = makeFlexiblePrice({
      price: "100.00",
      product_flexible_price: {
        id: 1,
        amount: "20.00", // 20% off
        discount_type: DiscountTypeEnum.PercentOff,
        discount_code: "TEST20",
        redemption_type: "one-time",
        is_redeemed: false,
        automatic: true,
        max_redemptions: 1,
        payment_type: null,
        activation_date: new Date().toISOString(),
        expiration_date: new Date().toISOString(),
      },
    })

    const result = getFlexiblePriceForProduct(product)

    expect(result).toBe(80) // $100 * (1 - 20/100)
  })

  test("Applies fixed-price discount correctly", () => {
    const product = makeFlexiblePrice({
      price: "100.00",
      product_flexible_price: {
        id: 1,
        amount: "50.00", // Fixed price of $50
        discount_type: DiscountTypeEnum.FixedPrice,
        discount_code: "FIXED50",
        redemption_type: "one-time",
        is_redeemed: false,
        automatic: true,
        max_redemptions: 1,
        payment_type: null,
        activation_date: new Date().toISOString(),
        expiration_date: new Date().toISOString(),
      },
    })

    const result = getFlexiblePriceForProduct(product)

    expect(result).toBe(50)
  })

  test("Returns original price when no discount is applied", () => {
    const product = makeFlexiblePrice({
      price: "100.00",
      product_flexible_price: null,
    })

    const result = getFlexiblePriceForProduct(product)

    expect(result).toBe(100)
  })

  test("Returns original price when discount type is unrecognized", () => {
    const product = makeFlexiblePrice({
      price: "100.00",
      product_flexible_price: {
        id: 1,
        amount: "25.00",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        discount_type: "unknown-type" as any,
        discount_code: "UNKNOWN",
        redemption_type: "one-time",
        is_redeemed: false,
        automatic: true,
        max_redemptions: 1,
        payment_type: null,
        activation_date: new Date().toISOString(),
        expiration_date: new Date().toISOString(),
      },
    })

    const result = getFlexiblePriceForProduct(product)

    expect(result).toBe(100)
  })
})

describe("priceWithDiscount", () => {
  test("Returns same price for original and final when no flexible price provided", () => {
    const product = makeFlexiblePrice({
      price: "100.00",
      product_flexible_price: null,
    })

    const result = priceWithDiscount({ product })

    expect(result.originalPrice).toBe("$100")
    expect(result.finalPrice).toBe("$100")
    expect(result.isDiscounted).toBe(false)
    expect(result.approvedFinancialAid).toBe(false)
  })

  test("Returns discounted price when flexible price is provided", () => {
    const product = makeFlexiblePrice({
      price: "100.00",
      product_flexible_price: null,
    })

    const flexiblePrice = makeFlexiblePrice({
      price: "100.00",
      product_flexible_price: {
        id: 1,
        amount: "30.00",
        discount_type: DiscountTypeEnum.DollarsOff,
        discount_code: "SAVE30",
        redemption_type: "one-time",
        is_redeemed: false,
        automatic: true,
        max_redemptions: 1,
        payment_type: null,
        activation_date: new Date().toISOString(),
        expiration_date: new Date().toISOString(),
      },
    })

    const result = priceWithDiscount({ product, flexiblePrice })

    expect(result.originalPrice).toBe("$100")
    expect(result.finalPrice).toBe("$70")
    expect(result.isDiscounted).toBe(true)
    expect(result.approvedFinancialAid).toBe(true)
  })

  test("Shows no discount when flexible price results in same price", () => {
    const product = makeFlexiblePrice({
      price: "100.00",
      product_flexible_price: null,
    })

    // Flexible price with 0% discount
    const flexiblePrice = makeFlexiblePrice({
      price: "100.00",
      product_flexible_price: {
        id: 1,
        amount: "0.00",
        discount_type: DiscountTypeEnum.DollarsOff,
        discount_code: "NODISCOUNT",
        redemption_type: "one-time",
        is_redeemed: false,
        automatic: true,
        max_redemptions: 1,
        payment_type: null,
        activation_date: new Date().toISOString(),
        expiration_date: new Date().toISOString(),
      },
    })

    const result = priceWithDiscount({ product, flexiblePrice })

    expect(result.originalPrice).toBe("$100")
    expect(result.finalPrice).toBe("$100")
    expect(result.isDiscounted).toBe(false)
    expect(result.approvedFinancialAid).toBe(true) // Has financial aid approval, just no discount
  })
})

describe("parseProgramRequirementSections", () => {
  test("returns empty array for empty reqTree", () => {
    const root = new RequirementTreeBuilder()
    const sections = parseProgramRequirementSections(root.serialize())
    expect(sections).toEqual([])
  })

  test("preserves req_tree order across multiple operator sections", () => {
    const root = new RequirementTreeBuilder()
    const first = root.addOperator({ operator: "all_of", title: "First" })
    first.addCourse()
    const second = root.addOperator({ operator: "all_of", title: "Second" })
    second.addCourse()
    const third = root.addOperator({
      operator: "min_number_of",
      operator_value: "1",
      title: "Third",
    })
    third.addCourse()

    const sections = parseProgramRequirementSections(root.serialize())
    expect(sections).toHaveLength(3)
    expect(sections[0].rawTitle).toBe("First")
    expect(sections[1].rawTitle).toBe("Second")
    expect(sections[2].rawTitle).toBe("Third")
  })

  test("items preserve order and capture both course and program leaves", () => {
    const root = new RequirementTreeBuilder()
    const op = root.addOperator({ operator: "all_of" })
    op.addCourse({ course: 10 })
    op.addProgram({ program: 99 })
    op.addCourse({ course: 20 })

    const sections = parseProgramRequirementSections(root.serialize())
    expect(sections).toHaveLength(1)
    expect(sections[0].items).toEqual([
      { type: "course", id: 10 },
      { type: "program", id: 99 },
      { type: "course", id: 20 },
    ])
  })

  test("rawTitle is the node title when set", () => {
    const root = new RequirementTreeBuilder()
    root.addOperator({ operator: "all_of", title: "My Section Title" })

    const sections = parseProgramRequirementSections(root.serialize())
    expect(sections[0].rawTitle).toBe("My Section Title")
  })

  test("rawTitle is null when node has no title", () => {
    // RequirementTreeBuilder.addOperator always sets a faker title, so we
    // test via the contract: rawTitle must be null when data.title is null.
    // We construct a minimal V2ProgramRequirement directly.
    const reqTree = [
      {
        id: 1,
        data: {
          node_type: NodeTypeEnum.Operator,
          operator: "all_of",
          operator_value: null,
          title: null,
          elective_flag: false,
          course: null,
          required_program: null,
          program: 1,
        },
        children: [],
      },
    ]
    const sections = parseProgramRequirementSections(reqTree)
    expect(sections[0].rawTitle).toBeNull()
    // Explicitly confirm no default/fallback string is produced
    expect(sections[0].rawTitle).not.toBe("Core Courses")
    expect(sections[0].rawTitle).not.toBe("Elective Courses")
  })

  test("elective reflects elective_flag: false for all_of", () => {
    const root = new RequirementTreeBuilder()
    root.addOperator({ operator: "all_of" })

    const sections = parseProgramRequirementSections(root.serialize())
    expect(sections[0].elective).toBe(false)
  })

  test("elective reflects elective_flag: true for min_number_of", () => {
    const root = new RequirementTreeBuilder()
    root.addOperator({ operator: "min_number_of", operator_value: "2" })

    const sections = parseProgramRequirementSections(root.serialize())
    expect(sections[0].elective).toBe(true)
  })

  test("requiredCount equals operator_value for min_number_of", () => {
    const root = new RequirementTreeBuilder()
    const op = root.addOperator({
      operator: "min_number_of",
      operator_value: "2",
    })
    op.addCourse()
    op.addCourse()
    op.addCourse()

    const sections = parseProgramRequirementSections(root.serialize())
    expect(sections[0].requiredCount).toBe(2)
  })

  test("requiredCount equals items.length for all_of", () => {
    const root = new RequirementTreeBuilder()
    const op = root.addOperator({ operator: "all_of" })
    op.addCourse()
    op.addCourse()
    op.addCourse()

    const sections = parseProgramRequirementSections(root.serialize())
    expect(sections[0].requiredCount).toBe(3)
  })

  test("non-operator root nodes are skipped", () => {
    // Mix of operator and non-operator nodes at the root
    const reqTree = [
      {
        id: 1,
        data: {
          node_type: NodeTypeEnum.Course,
          operator: null,
          operator_value: null,
          title: null,
          elective_flag: false,
          course: 42,
          required_program: null,
          program: 1,
        },
      },
      {
        id: 2,
        data: {
          node_type: NodeTypeEnum.Operator,
          operator: "all_of",
          operator_value: null,
          title: "Valid Section",
          elective_flag: false,
          course: null,
          required_program: null,
          program: 1,
        },
        children: [
          {
            id: 3,
            data: {
              node_type: NodeTypeEnum.Course,
              operator: null,
              operator_value: null,
              title: null,
              elective_flag: false,
              course: 55,
              required_program: null,
              program: 1,
            },
          },
        ],
      },
    ]
    const sections = parseProgramRequirementSections(reqTree)
    expect(sections).toHaveLength(1)
    expect(sections[0].rawTitle).toBe("Valid Section")
    expect(sections[0].items).toEqual([{ type: "course", id: 55 }])
  })

  test("operator field reflects the node's operator string", () => {
    const root = new RequirementTreeBuilder()
    root.addOperator({ operator: "all_of" })
    root.addOperator({ operator: "min_number_of", operator_value: "1" })

    const sections = parseProgramRequirementSections(root.serialize())
    expect(sections).toHaveLength(2)
    expect(sections[0].operator).toBe("all_of")
    expect(sections[1].operator).toBe("min_number_of")
  })

  test("items are collected recursively from nested children", () => {
    const root = new RequirementTreeBuilder()
    const op = root.addOperator({ operator: "all_of" })
    op.addCourse({ course: 10 })
    // Add a nested operator inside the operator (recursive case)
    const nested = op.addOperator({ operator: "all_of" })
    nested.addCourse({ course: 20 })
    nested.addProgram({ program: 77 })

    const sections = parseProgramRequirementSections(root.serialize())
    expect(sections).toHaveLength(1)
    // Recursive walk should collect 10, 20, 77
    expect(sections[0].items).toEqual([
      { type: "course", id: 10 },
      { type: "course", id: 20 },
      { type: "program", id: 77 },
    ])
  })
})

describe("getIdsFromReqTree", () => {
  test("extracts course and program IDs from nested req_tree", () => {
    const root = new RequirementTreeBuilder()
    const required = root.addOperator({ operator: "all_of" })
    required.addCourse({ course: 10 })
    required.addProgram({ program: 99 })
    required.addCourse({ course: 20 })

    const electives = root.addOperator({
      operator: "min_number_of",
      operator_value: "1",
    })
    electives.addCourse({ course: 30 })
    electives.addProgram({ program: 88 })

    const nested = electives.addOperator({ operator: "all_of" })
    nested.addCourse({ course: 50 })

    const { courseIds, programIds } = getIdsFromReqTree(root.serialize())
    expect(courseIds).toEqual([10, 20, 30, 50])
    expect(programIds).toEqual([99, 88])
  })

  test("returns empty arrays for a tree with no courses or programs", () => {
    const root = new RequirementTreeBuilder()
    root.addOperator({ operator: "all_of" })

    const { courseIds, programIds } = getIdsFromReqTree(root.serialize())
    expect(courseIds).toEqual([])
    expect(programIds).toEqual([])
  })
})
