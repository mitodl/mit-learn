import React from "react"
import {
  renderWithProviders,
  screen,
  within,
  user,
  waitFor,
} from "@/test-utils"
import SearchPage from "./SearchPage"
import { setMockResponse, urls, factories, makeRequest } from "api/test-utils"
import type {
  LearningResourcesSearchResponse,
  PaginatedLearningResourceOfferorDetailList,
} from "api"
import invariant from "tiny-invariant"
import { Permission } from "api/hooks/user"
import { assertHeadings, ControlledPromise } from "ol-test-utilities"
import { act } from "@testing-library/react"

const DEFAULT_SEARCH_RESPONSE: LearningResourcesSearchResponse = {
  count: 0,
  next: null,
  previous: null,
  results: [],
  metadata: {
    aggregations: {},
    suggestions: [],
  },
}

const setMockApiResponses = ({
  search,
  offerors,
}: {
  search?: Partial<LearningResourcesSearchResponse>
  offerors?: PaginatedLearningResourceOfferorDetailList
} = {}) => {
  setMockResponse.get(urls.userMe.get(), {
    [Permission.Authenticated]: false,
  })

  setMockResponse.get(expect.stringContaining(urls.search.resources()), {
    ...DEFAULT_SEARCH_RESPONSE,
    ...search,
  })
  setMockResponse.get(
    urls.offerors.list(),
    offerors ?? factories.learningResources.offerors({ count: 5 }),
  )
  setMockResponse.get(urls.userLists.membershipList(), [])
  setMockResponse.get(urls.learningPaths.membershipList(), [])
}

const getLastApiSearchParams = () => {
  const call = makeRequest.mock.calls.find(([method, url]) => {
    if (method !== "get") return false
    return url.startsWith(urls.search.resources())
  })
  invariant(call)
  const [_method, url] = call
  const fullUrl = new URL(url, "http://mit.edu")
  return fullUrl.searchParams
}

describe("SearchPage", () => {
  test("Renders search results", async () => {
    const resources = factories.learningResources.resources({
      count: 10,
    }).results
    setMockApiResponses({
      search: {
        count: 1000,
        metadata: {
          aggregations: {
            resource_type: [
              { key: "course", doc_count: 100 },
              { key: "podcast", doc_count: 200 },
              { key: "program", doc_count: 300 },
              { key: "irrelevant", doc_count: 400 },
            ],
          },
          suggestions: [],
        },
        results: resources,
      },
    })
    renderWithProviders(<SearchPage />)

    const tabpanel = await screen.findByRole("tabpanel")
    for (const resource of resources) {
      await within(tabpanel).findByText(resource.title)
    }
  })

  test.each([
    { url: "?topic=physics", expected: { topic: "physics" } },
    {
      url: "?resource_type=course",
      expected: { resource_type: "course" },
    },
    { url: "?q=woof", expected: { q: "woof" } },
  ])(
    "Makes API call with correct facets and aggregations",
    async ({ url, expected }) => {
      setMockApiResponses({
        search: {
          count: 700,
          metadata: {
            aggregations: {
              topic: [
                { key: "physics", doc_count: 100 },
                { key: "chemistry", doc_count: 200 },
              ],
            },
            suggestions: [],
          },
        },
      })
      renderWithProviders(<SearchPage />, { url })
      await waitFor(() => {
        expect(makeRequest.mock.calls.length > 0).toBe(true)
      })
      const apiSearchParams = getLastApiSearchParams()
      expect(apiSearchParams.getAll("aggregations").sort()).toEqual([
        "certification_type",
        "delivery",
        "department",
        "free",
        "offered_by",
        "professional",
        "resource_type",
        "resource_type_group",
        "topic",
      ])
      expect(Object.fromEntries(apiSearchParams.entries())).toEqual(
        expect.objectContaining(expected),
      )
    },
  )

  test("Toggling facets", async () => {
    setMockApiResponses({
      search: {
        count: 700,
        metadata: {
          aggregations: {
            topic: [
              { key: "Physics", doc_count: 100 }, // Physics
              { key: "Chemistry", doc_count: 200 }, // Chemistry
            ],
          },
          suggestions: [],
        },
      },
    })

    const { location } = renderWithProviders(<SearchPage />, {
      url: "?topic=Physics&topic=Chemistry",
    })

    const clearAll = await screen.findByRole("button", { name: /clear all/i })

    const physics = await screen.findByRole("checkbox", { name: "Physics 100" })
    const chemistry = await screen.findByRole("checkbox", {
      name: "Chemistry 200",
    })
    // initial
    expect(physics).toBeChecked()
    expect(chemistry).toBeChecked()
    // clear all
    await user.click(clearAll)
    expect(clearAll).not.toBeVisible()
    expect(location.current.search).toBe("")
    expect(physics).not.toBeChecked()
    expect(chemistry).not.toBeChecked()
    // toggle physics
    await user.click(physics)
    await screen.findByRole("button", { name: /clear all/i }) // Clear All shows again
    expect(physics).toBeChecked()
    expect(location.current.search).toBe("?topic=Physics")
  })

  test("Shows Learning Resource facet only if learning materials tab is selected", async () => {
    setMockApiResponses({
      search: {
        count: 700,
        metadata: {
          aggregations: {
            resource_type_group: [
              { key: "course", doc_count: 100 },
              { key: "learning_material", doc_count: 200 },
            ],
            resource_type: [
              { key: "course", doc_count: 100 },
              { key: "podcast", doc_count: 100 },
              { key: "video", doc_count: 100 },
            ],
          },
          suggestions: [],
        },
      },
    })
    renderWithProviders(<SearchPage />)

    const facetsContainer = screen.getByTestId("facets-container")
    expect(within(facetsContainer).queryByText("Resource Type")).toBeNull()
    const tabLearningMaterial = screen.getByRole("tab", {
      name: /Learning Material/,
    })
    await user.click(tabLearningMaterial)
    await within(facetsContainer).findByText("Resource Type")
  })

  test.each([
    { initialQuery: "?q=meow&page=2", finalQuery: "?q=woof" },
    { initialQuery: "?q=meow", finalQuery: "?q=woof" },
  ])("Submitting text updates URL", async ({ initialQuery, finalQuery }) => {
    setMockApiResponses({})
    const { location } = renderWithProviders(<SearchPage />, {
      url: initialQuery,
    })
    const queryInput = await screen.findByRole<HTMLInputElement>("textbox", {
      name: "Search for",
    })
    expect(queryInput.value).toBe("meow")
    await user.clear(queryInput)
    await user.paste("woof")

    expect(location.current.search).toBe(initialQuery)
    await user.click(screen.getByRole("button", { name: "Search" }))
    expect(location.current.search).toBe(finalQuery)
  })

  test("unathenticated users do not see admin options", async () => {
    setMockApiResponses({
      search: {
        count: 700,
        metadata: {
          aggregations: {
            resource_type_group: [
              { key: "course", doc_count: 100 },
              { key: "learning_material", doc_count: 200 },
            ],
            resource_type: [
              { key: "course", doc_count: 100 },
              { key: "podcast", doc_count: 100 },
              { key: "video", doc_count: 100 },
            ],
          },
          suggestions: [],
        },
      },
    })

    setMockResponse.get(urls.userMe.get(), { is_authenticated: true })

    renderWithProviders(<SearchPage />)
    await waitFor(() => {
      const adminOptions = screen.queryByText("Admin Options")
      expect(adminOptions).toBeNull()
    })

    expect(makeRequest).not.toHaveBeenCalledWith(
      "get",
      urls.adminSearchParams,
      expect.anything(),
    )
  })

  test("non admin users do not see admin options", async () => {
    setMockApiResponses({
      search: {
        count: 700,
        metadata: {
          aggregations: {
            resource_type_group: [
              { key: "course", doc_count: 100 },
              { key: "learning_material", doc_count: 200 },
            ],
            resource_type: [
              { key: "course", doc_count: 100 },
              { key: "podcast", doc_count: 100 },
              { key: "video", doc_count: 100 },
            ],
          },
          suggestions: [],
        },
      },
    })
    setMockResponse.get(urls.userMe.get(), {
      is_authenticated: true,
      is_learning_path_editor: false,
    })

    renderWithProviders(<SearchPage />)

    await waitFor(() => {
      const adminOptions = screen.queryByText("Admin Options")
      expect(adminOptions).toBeNull()
    })

    expect(makeRequest).not.toHaveBeenCalledWith(
      "get",
      urls.adminSearchParams,
      expect.anything(),
    )
  })

  test("admin users can set staleness and score cutoff sliders", async () => {
    setMockApiResponses({
      search: {
        count: 700,
        metadata: {
          aggregations: {
            resource_type_group: [
              { key: "course", doc_count: 100 },
              { key: "learning_material", doc_count: 200 },
            ],
            resource_type: [
              { key: "course", doc_count: 100 },
              { key: "podcast", doc_count: 100 },
              { key: "video", doc_count: 100 },
            ],
          },
          suggestions: [],
        },
      },
    })
    setMockResponse.get(urls.userMe.get(), {
      is_learning_path_editor: true,
      is_authenticated: true,
    })

    setMockResponse.get(urls.adminSearchParams.get(), {
      search_mode: "phrase",
      slop: 6,
      yearly_decay_percent: 2.5,
      min_score: 0,
      max_incompleteness_penalty: 90,
      content_file_score_weight: 1,
    })

    renderWithProviders(<SearchPage />)
    await waitFor(() => {
      const adminFacetContainer = screen.getByText("Admin Options")
      user.click(adminFacetContainer)
    })

    await waitFor(() => {
      screen.getByTestId("yearly_decay_percent-slider")
      screen.getByTestId("min_score-slider")
      screen.getByTestId("max_incompleteness_penalty-slider")
    })
  })
})

test("admin users can set the search mode and slop", async () => {
  setMockApiResponses({
    search: {
      count: 700,
      metadata: {
        aggregations: {
          resource_type_group: [
            { key: "course", doc_count: 100 },
            { key: "learning_material", doc_count: 200 },
          ],
          resource_type: [
            { key: "course", doc_count: 100 },
            { key: "podcast", doc_count: 100 },
            { key: "video", doc_count: 100 },
          ],
        },
        suggestions: [],
      },
    },
  })
  setMockResponse.get(urls.userMe.get(), {
    is_learning_path_editor: true,
    is_authenticated: true,
  })
  setMockResponse.get(urls.adminSearchParams.get(), {
    search_mode: "phrase",
    slop: 6,
    yearly_decay_percent: 2.5,
    min_score: 0,
    max_incompleteness_penalty: 90,
    content_file_score_weight: 1,
  })

  const { location } = renderWithProviders(<SearchPage />)
  await waitFor(() => {
    const adminFacetContainer = screen.getByText("Admin Options")
    user.click(adminFacetContainer)
  })

  const searchModeDropdowns = await screen.findAllByText("phrase")
  const searchModeDropdown = searchModeDropdowns[0]

  await user.click(searchModeDropdown)

  const mostFieldsSelect = await screen.findByRole("option", {
    name: "most_fields",
  })

  await user.click(mostFieldsSelect)

  expect(location.current.search).toBe("?search_mode=most_fields")

  const slopSlider = screen.queryByText("Slop")
  expect(slopSlider).toBeNull()

  await user.click(searchModeDropdown)

  const phraseSelect = await screen.findByRole("option", {
    name: "phrase",
  })

  await user.click(phraseSelect)

  expect(location.current.search).toBe("?search_mode=phrase")

  await waitFor(() => {
    screen.getByText("Slop")
  })

  await user.click(searchModeDropdown)
})

describe("Search Page Tabs", () => {
  test.each([
    { url: "", expectedActive: /All/ },
    { url: "?all", expectedActive: /All/ },
    { url: "?resource_type_group=course", expectedActive: /Courses/ },
    { url: "?resource_type_group=program", expectedActive: /Programs/ },
    {
      url: "?resource_type_group=learning_material",
      expectedActive: /Learning Materials/,
    },
  ])("Active tab determined by URL $url", async ({ url, expectedActive }) => {
    setMockApiResponses({
      search: {
        count: 1000,
        metadata: {
          aggregations: {
            resource_type_group: [
              { key: "course", doc_count: 100 },
              { key: "podcast", doc_count: 200 },
              { key: "program", doc_count: 300 },
              { key: "irrelevant", doc_count: 400 },
            ],
          },
          suggestions: [],
        },
      },
    })
    renderWithProviders(<SearchPage />, { url })
    const tab = screen.getByRole("tab", { selected: true })
    expect(tab).toHaveAccessibleName(expectedActive)
  })

  test("Clicking tabs updates URL", async () => {
    setMockApiResponses({
      search: {
        count: 1000,
        metadata: {
          aggregations: {
            resource_type: [
              { key: "course", doc_count: 100 },
              { key: "podcast", doc_count: 200 },
              { key: "program", doc_count: 300 },
              { key: "irrelevant", doc_count: 400 },
            ],
          },
          suggestions: [],
        },
      },
    })
    const { location } = renderWithProviders(<SearchPage />, {
      url: "?department=8",
    })
    const tabAll = screen.getByRole("tab", { name: /All/ })
    const tabCourses = screen.getByRole("tab", { name: /Courses/ })
    expect(tabAll).toHaveAttribute("aria-selected")

    // Click "Courses"
    await user.click(tabCourses)
    expect(tabCourses).toHaveAttribute("aria-selected")
    const params1 = new URLSearchParams(location.current.search)
    expect(params1.get("resource_type_group")).toBe("course")
    expect(params1.get("department")).toBe("8") // should preserve other params

    // Click "All"
    await user.click(tabAll)
    expect(tabAll).toHaveAttribute("aria-selected")
    const params2 = new URLSearchParams(location.current.search)
    expect(params2.get("resource_type_group")).toBe(null)
    expect(params2.get("department")).toBe("8") // should preserve other params
  })

  test("Switching from learning materials tab clears resource type only", async () => {
    setMockApiResponses({
      search: {
        count: 1000,
        metadata: {
          aggregations: {
            resource_type_group: [{ key: "video", doc_count: 100 }],
          },
          suggestions: [],
        },
      },
    })
    const { location } = renderWithProviders(<SearchPage />, {
      url: "?resource_type_group=learning_material&resource_type=video&topic=Biology",
    })
    const tabLM = screen.getByRole("tab", { name: /Learning Materials/ })
    const tabCourses = screen.getByRole("tab", { name: /Courses/ })
    expect(tabLM).toHaveAttribute("aria-selected")

    // Click "Courses"
    await user.click(tabCourses)
    expect(location.current.search).toBe(
      "?resource_type_group=course&topic=Biology",
    )
  })

  test("Tab titles show corret result counts", async () => {
    setMockApiResponses({
      search: {
        count: 700,
        metadata: {
          aggregations: {
            resource_type_group: [
              { key: "course", doc_count: 100 },
              { key: "program", doc_count: 200 },
              { key: "learning_material", doc_count: 300 },
            ],
          },
          suggestions: [],
        },
      },
    })
    renderWithProviders(<SearchPage />)
    const tabs = screen.getAllByRole("tab")
    // initially (before API response) not result counts
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      "All",
      "Courses",
      "Programs",
      "Learning Materials",
    ])
    // eventually (after API response) result counts show
    await waitFor(() => {
      expect(
        tabs.map((tab) => (tab.textContent || "").replace(/\s/g, "")),
      ).toEqual([
        "All(600)",
        "Courses(100)",
        "Programs(200)",
        "LearningMaterials(300)",
      ])
    })
  })

  test("Changing tab resets page number", async () => {
    setMockApiResponses({
      search: {
        count: 1000,
        metadata: {
          aggregations: {},
          suggestions: [],
        },
      },
    })

    const { location } = renderWithProviders(<SearchPage />, {
      url: "?page=3&resource_type_group=course",
    })
    const tabPrograms = screen.getByRole("tab", { name: /Programs/ })
    await user.click(tabPrograms)
    expect(location.current.search).toBe("?resource_type_group=program")
  })
})

test("Facet 'Offered By' uses API response for names", async () => {
  const offerors = factories.learningResources.offerors({ count: 3 })
  for (const offeror of offerors.results) {
    offeror.display_facet = true
  }
  const resources = factories.learningResources.resources({
    count: 3,
  }).results

  setMockApiResponses({
    offerors,
    search: {
      results: resources,
      metadata: {
        aggregations: {
          offered_by: offerors.results.map((o, i) => ({
            key: o.code,
            doc_count: 10 + i,
          })),
        },
        suggestions: [],
      },
    },
  })
  renderWithProviders(<SearchPage />)
  const showFacetButton = await screen.findByRole("button", {
    name: /Offered By/i,
  })

  await user.click(showFacetButton)

  const offeror0 = await screen.findByRole("checkbox", {
    name: `${offerors.results[0].name} 10`,
  })
  const offeror1 = await screen.findByRole("checkbox", {
    name: `${offerors.results[1].name} 11`,
  })
  const offeror2 = await screen.findByRole("checkbox", {
    name: `${offerors.results[2].name} 12`,
  })
  expect(offeror0).toBeVisible()
  expect(offeror1).toBeVisible()
  expect(offeror2).toBeVisible()
})

test("Facet 'Offered By' only shows facets with 'display_facet' set to true", async () => {
  const offerors = factories.learningResources.offerors({ count: 3 })

  const resources = factories.learningResources.resources({
    count: 3,
  }).results

  offerors.results[0].display_facet = true
  offerors.results[1]!.display_facet = false
  offerors.results[2]!.display_facet = false

  setMockApiResponses({
    search: {
      results: resources,
      metadata: {
        aggregations: {
          offered_by: offerors.results.map((o, i) => ({
            key: o.code,
            doc_count: 10 + i,
          })),
        },
        suggestions: [],
      },
    },
    offerors: offerors,
  })
  renderWithProviders(<SearchPage />)
  const showFacetButton = await screen.findByRole("button", {
    name: /Offered By/i,
  })

  await user.click(showFacetButton)

  const offeror0 = await screen.findByRole("checkbox", {
    name: `${offerors.results[0].name} 10`,
  })
  const offeror1 = screen.queryByRole("checkbox", {
    name: `${offerors.results[1].name} 11`,
  })
  const offeror2 = screen.queryByRole("checkbox", {
    name: `${offerors.results[2].name} 12`,
  })
  expect(offeror0).toBeVisible()
  expect(offeror1).not.toBeInTheDocument()
  expect(offeror2).not.toBeInTheDocument()
})

test("Set sort", async () => {
  setMockApiResponses({ search: { count: 137 } })

  const { location } = renderWithProviders(<SearchPage />)

  let sortDropdowns = await screen.findAllByText("Sort by: Best Match")
  let sortDropdown = sortDropdowns[0]

  await user.click(sortDropdown)

  const noneSelect = await screen.findByRole("option", {
    name: "Best Match",
  })

  expect(noneSelect).toHaveAttribute("aria-selected", "true")

  let popularitySelect = await screen.findByRole("option", {
    name: /Popular/i,
  })

  expect(popularitySelect).toHaveAttribute("aria-selected", "false")

  await user.click(popularitySelect)

  expect(location.current.search).toBe("?sortby=-views")

  sortDropdowns = await screen.findAllByText("Sort by: Popular")
  sortDropdown = sortDropdowns[0]

  await user.click(sortDropdown)

  popularitySelect = await screen.findByRole("option", {
    name: /Popular/i,
  })

  expect(popularitySelect).toHaveAttribute("aria-selected", "true")
})

test("The professional toggle updates the professional setting", async () => {
  setMockApiResponses({ search: { count: 137 } })
  const { location } = renderWithProviders(<SearchPage />)
  const facets = screen.getByTestId("facets-container")
  const professionalToggle = await within(facets).findByRole("button", {
    name: "Professional",
  })
  await user.click(professionalToggle)
  await waitFor(() => {
    const params = new URLSearchParams(location.current.search)
    expect(params.get("professional")).toBe("true")
  })
  const academicToggle = await within(facets).findByRole("button", {
    name: "Academic",
  })
  await user.click(academicToggle)
  await waitFor(() => {
    const params = new URLSearchParams(location.current.search)
    expect(params.get("professional")).toBe("false")
  })
  const viewAllToggle = await within(facets).findByRole("button", {
    name: "All",
  })

  await user.click(viewAllToggle)
  await waitFor(() => {
    const params = new URLSearchParams(location.current.search)
    expect(params.get("professional")).toBe(null)
  })
})

test("Clearing text updates URL", async () => {
  setMockApiResponses({})
  const { location } = renderWithProviders(<SearchPage />, { url: "?q=meow" })
  await user.click(screen.getByRole("button", { name: "Clear search text" }))
  expect(location.current.search).toBe("")
})

/**
 * Simple tests to check that data / handlers with pagination controls are
 * working as expected.
 */
describe("Search Page pagination controls", () => {
  const getPagination = () =>
    screen.getByRole("navigation", { name: "pagination navigation" })

  test("?page URLSearchParam controls activate page", async () => {
    setMockApiResponses({ search: { count: 137 } })
    renderWithProviders(<SearchPage />, { url: "?page=3" })
    const pagination = getPagination()
    // p3 is current page
    await within(pagination).findByRole("button", {
      name: "page 3",
      current: "page",
    })
    // as opposed to p4
    await within(pagination).findByRole("button", { name: "Go to page 4" })
  })

  test("Clicking on a page updates URL", async () => {
    setMockApiResponses({ search: { count: 137 } })
    const { location } = renderWithProviders(<SearchPage />, {
      url: "?page=3",
    })
    const pagination = getPagination()
    const p4 = await within(pagination).findByRole("button", {
      name: "Go to page 4",
    })
    await user.click(p4)
    await waitFor(() => {
      const params = new URLSearchParams(location.current.search)
      expect(params.get("page")).toBe("4")
    })
  })

  test("Max page is determined by count", async () => {
    setMockApiResponses({ search: { count: 137 } })
    renderWithProviders(<SearchPage />, { url: "?page=3" })
    const pagination = getPagination()
    // p14 exists
    await within(pagination).findByRole("button", { name: "Go to page 7" })
    // items
    const items = await within(pagination).findAllByRole("listitem")
    expect(items.at(-2)?.textContent).toBe("7") // "Last page"
    expect(items.at(-1)?.textContent).toBe("") // "Next" button
  })

  test("headings", () => {
    setMockApiResponses()
    renderWithProviders(<SearchPage />)

    assertHeadings([
      { level: 1, name: "Search" },
      { level: 2, name: "Search Results" },
      { level: 2, name: "Filter" },
    ])
  })
})

test("Count changes are announced to screen readers", async () => {
  setMockApiResponses({ search: { count: 123 } })
  renderWithProviders(<SearchPage />)
  const count = await screen.findByText("123 results")
  expect(count).toHaveAttribute("aria-live", "polite")
  expect(count).toHaveAttribute("aria-atomic", "true")
  // aria-relevant is important here. See https://stackoverflow.com/a/62179258/2747370
  expect(count).toHaveAttribute("aria-relevant", "all")

  const nextResponse = new ControlledPromise()
  const nextData = { ...DEFAULT_SEARCH_RESPONSE, count: 456 }
  setMockResponse.get(
    expect.stringContaining(urls.search.resources()),
    nextResponse,
  )

  const queryInput = await screen.findByRole<HTMLInputElement>("textbox", {
    name: "Search for",
  })
  await user.clear(queryInput)
  await user.paste("woof")
  await user.click(screen.getByRole("button", { name: "Search" }))

  /**
   * The point here is to check that while new data is loading, the aria-live
   * region is empty.
   *
   * That's important: it guarantees that the result count will always be read,
   * even if the count hasn't changed.
   *
   * For example:
   *  - search for "foo" ... 0 results
   *  - try again, search for "bar" ... still 0 results
   *
   * This ensures that we read "0 results" both times.
   */
  await waitFor(() => {
    expect(count).toHaveTextContent("")
  })
  nextResponse.resolve(nextData)

  await waitFor(() => {
    expect(count).toHaveTextContent("456 results")
  })
})

test("routing to new query sets currentText", async () => {
  setMockApiResponses({})
  renderWithProviders(<SearchPage />)
  act(() => {
    window.history.pushState({}, "", "?q=meow")
  })

  await waitFor(() => {
    const textInput = screen.getByRole("textbox", { name: "Search for" })
    expect(textInput).toHaveValue("meow")
  })
})

test("changing a facet resets unsubmitted text", async () => {
  setMockApiResponses({
    search: {},
  })
  renderWithProviders(<SearchPage />)

  const queryInput = await screen.findByRole<HTMLInputElement>("textbox", {
    name: "Search for",
  })
  await user.clear(queryInput)
  await user.paste("woof")

  const textInput = screen.getByRole("textbox", { name: "Search for" })

  await waitFor(() => {
    expect(textInput).toHaveValue("woof")
  })

  const facets = screen.getByTestId("facets-container")
  const professionalToggle = await within(facets).findByRole("button", {
    name: "Professional",
  })
  await user.click(professionalToggle)

  await waitFor(() => {
    expect(textInput).toHaveValue("")
  })
})
