import {
  allRunsAreIdentical,
  formattedParentCourseName,
} from "./learning-resources"
import * as factories from "api/test-utils/factories"
import { CourseResourceDeliveryInnerCodeEnum } from "api"

const makeRun = factories.learningResources.run

describe("allRunsAreIdentical", () => {
  test("returns true if no runs", () => {
    const resource = factories.learningResources.resource()
    resource.runs = []
    expect(allRunsAreIdentical(resource)).toBe(true)
  })

  test("returns true if only one run", () => {
    const resource = factories.learningResources.resource()
    resource.runs = [makeRun()]
    expect(allRunsAreIdentical(resource)).toBe(true)
  })

  test("returns true if all runs are identical", () => {
    const resource = factories.learningResources.resource({
      free: false,
      certification: false,
    })
    const prices = [{ amount: "100", currency: "USD" }]
    const delivery = [
      { code: CourseResourceDeliveryInnerCodeEnum.InPerson, name: "In person" },
    ]
    const location = "New York"
    resource.runs = [
      makeRun({
        resource_prices: prices,
        delivery: delivery,
        location: location,
      }),
      makeRun({
        resource_prices: prices,
        delivery: delivery,
        location: location,
      }),
      makeRun({
        resource_prices: prices,
        delivery: delivery,
        location: location,
      }),
    ]
    expect(allRunsAreIdentical(resource)).toBe(true)
  })

  test("returns false if prices differ", () => {
    const resource = factories.learningResources.resource({
      free: false,
      certification: false,
    })
    const prices = [{ amount: "100", currency: "USD" }]
    const delivery = [
      { code: CourseResourceDeliveryInnerCodeEnum.InPerson, name: "In person" },
    ]
    const location = "New York"
    resource.runs = [
      makeRun({
        resource_prices: prices,
        delivery: delivery,
        location: location,
      }),
      makeRun({
        resource_prices: prices,
        delivery: delivery,
        location: location,
      }),
      makeRun({
        resource_prices: [{ amount: "150", currency: "USD" }],
        delivery: delivery,
        location: location,
      }),
    ]
    expect(allRunsAreIdentical(resource)).toBe(false)
  })

  test("returns true if prices differ but have same numerical value", () => {
    const resource = factories.learningResources.resource({
      free: true,
      certification: false,
    })
    const delivery = [
      { code: CourseResourceDeliveryInnerCodeEnum.InPerson, name: "In person" },
    ]
    const location = "New York"
    resource.runs = [
      makeRun({
        resource_prices: [{ amount: "0", currency: "USD" }],
        delivery: delivery,
        location: location,
      }),
      makeRun({
        resource_prices: [{ amount: "0.00", currency: "USD" }],
        delivery: delivery,
        location: location,
      }),
    ]
    expect(allRunsAreIdentical(resource)).toBe(true)
  })

  test.each([
    {
      runPrices: [
        [
          { amount: "0", currency: "USD" },
          { amount: "50", currency: "USD" },
          { amount: "100", currency: "USD" },
        ],
        [
          { amount: "0", currency: "USD" },
          { amount: "50.00", currency: "USD" },
          { amount: "100", currency: "USD" },
        ],
      ],
      case: "2 runs, 3 prices each, all the same",
      expected: true,
    },
    {
      runPrices: [
        [
          { amount: "0", currency: "USD" },
          { amount: "100", currency: "USD" },
        ],
        [
          { amount: "0", currency: "USD" },
          { amount: "50.00", currency: "USD" },
          { amount: "100", currency: "USD" },
        ],
      ],
      case: "2 runs, 2 vs 3 prices",
      expected: false,
    },
    {
      runPrices: [
        [
          { amount: "0", currency: "USD" },
          { amount: "50.00", currency: "USD" },
          { amount: "150", currency: "USD" },
        ],
        [
          { amount: "0", currency: "USD" },
          { amount: "50.00", currency: "USD" },
          { amount: "100", currency: "USD" },
        ],
      ],
      case: "2 runs, 3 prices each, some not all same",
      expected: false,
    },
  ])(
    "returns $expected if multiple runs ($case)",
    ({ expected, runPrices: [prices1, prices2] }) => {
      const resource = factories.learningResources.resource({
        free: true,
        certification: true,
      })
      const delivery = [
        {
          code: CourseResourceDeliveryInnerCodeEnum.InPerson,
          name: "In person",
        },
      ]
      const location = "New York"
      resource.runs = [
        makeRun({
          resource_prices: prices1,
          delivery: delivery,
          location: location,
        }),
        makeRun({
          resource_prices: prices2,
          delivery: delivery,
          location: location,
        }),
      ]
      expect(allRunsAreIdentical(resource)).toBe(expected)
    },
  )

  test("returns false if delivery methods differ", () => {
    const resource = factories.learningResources.resource()
    const prices = [{ amount: "100", currency: "USD" }]
    const delivery = [
      { code: CourseResourceDeliveryInnerCodeEnum.InPerson, name: "In person" },
    ]
    const location = "New York"
    resource.runs = [
      makeRun({
        resource_prices: prices,
        delivery: delivery,
        location: location,
      }),
      makeRun({
        resource_prices: prices,
        delivery: delivery,
        location: location,
      }),
      makeRun({
        resource_prices: prices,
        delivery: [
          { code: CourseResourceDeliveryInnerCodeEnum.Online, name: "Online" },
        ],
        location: location,
      }),
    ]
    expect(allRunsAreIdentical(resource)).toBe(false)
  })

  test("returns false if locations differ", () => {
    const resource = factories.learningResources.resource()
    const prices = [{ amount: "100", currency: "USD" }]
    const delivery = [
      { code: CourseResourceDeliveryInnerCodeEnum.InPerson, name: "In person" },
    ]
    const location = "New York"
    resource.runs = [
      makeRun({
        resource_prices: prices,
        delivery: delivery,
        location: location,
      }),
      makeRun({
        resource_prices: prices,
        delivery: delivery,
        location: location,
      }),
      makeRun({
        resource_prices: prices,
        delivery: delivery,
        location: "San Francisco",
      }),
    ]
    expect(allRunsAreIdentical(resource)).toBe(false)
  })
})

describe("formattedParentCourseName", () => {
  test("formats the parent course name for a video playlist", () => {
    const resource = factories.learningResources.videoPlaylist({
      video_playlist: {
        parent_title: "Test Course Title",
        parent_course_numbers: ["TEST-101"],
      },
    })
    expect(formattedParentCourseName(resource)).toBe(
      "TEST-101: Test Course Title",
    )
  })

  test("returns null for a video playlist missing parent title", () => {
    const resource = factories.learningResources.videoPlaylist({
      video_playlist: {
        parent_title: "",
        parent_course_numbers: ["TEST-101"],
      },
    })
    expect(formattedParentCourseName(resource)).toBeNull()
  })

  test("returns null for a video playlist missing parent course numbers", () => {
    const resource = factories.learningResources.videoPlaylist({
      video_playlist: {
        parent_title: "Test Course Title",
        parent_course_numbers: [],
      },
    })
    expect(formattedParentCourseName(resource)).toBeNull()
  })

  test("formats the parent course name for a video", () => {
    const resource = factories.learningResources.video({
      content_files: [
        factories.learningResources.contentFile({
          run_title: "Test Course Title",
          course_number: ["TEST-101"],
        }),
      ],
    })
    expect(formattedParentCourseName(resource)).toBe(
      "TEST-101: Test Course Title",
    )
  })

  test("returns null for a video missing content files", () => {
    const resource = factories.learningResources.video({
      content_files: [],
    })
    expect(formattedParentCourseName(resource)).toBeNull()
  })

  test("returns null for a video missing run title", () => {
    const resource = factories.learningResources.video({
      content_files: [
        factories.learningResources.contentFile({
          run_title: undefined,
          course_number: ["TEST-101"],
        }),
      ],
    })
    expect(formattedParentCourseName(resource)).toBeNull()
  })

  test("returns null for a video missing course number", () => {
    const resource = factories.learningResources.video({
      content_files: [
        factories.learningResources.contentFile({
          run_title: "Test Course Title",
          course_number: [],
        }),
      ],
    })
    expect(formattedParentCourseName(resource)).toBeNull()
  })
})
