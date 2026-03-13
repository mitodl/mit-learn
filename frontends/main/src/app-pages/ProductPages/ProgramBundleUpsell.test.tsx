import React from "react"
import { factories, urls } from "api/mitxonline-test-utils"
import { setMockResponse } from "api/test-utils"
import { renderWithProviders, screen, within } from "@/test-utils"
import { waitForElementToBeRemoved } from "@testing-library/react"
import { DisplayModeEnum } from "@mitodl/mitxonline-api-axios/v2"
import ProgramBundleUpsell from "./ProgramBundleUpsell"
import { allowConsoleErrors } from "ol-test-utilities"

const { RequirementTreeBuilder } = factories.requirements

const TestIds = {
  ProgramBundleUpsell: "program-bundle-upsell",
}

describe("ProgramBundleUpsell", () => {
  test("Does not render when no program details are loaded", () => {
    renderWithProviders(<ProgramBundleUpsell programs={[]} />)

    expect(
      screen.queryByTestId(TestIds.ProgramBundleUpsell),
    ).not.toBeInTheDocument()
  })

  test("Renders upsell with program title, course count, price, and View Program link", async () => {
    const requirements = new RequirementTreeBuilder()
    const required = requirements.addOperator({ operator: "all_of" })
    required.addCourse()
    required.addCourse()
    required.addCourse()
    const electives = requirements.addOperator({
      operator: "min_number_of",
      operator_value: "2",
    })
    electives.addCourse()
    electives.addCourse()
    electives.addCourse()

    const baseProgram = factories.programs.baseProgram()
    const programDetail = factories.programs.program({
      id: baseProgram.id,
      readable_id: baseProgram.readable_id,
      title: "Data Science",
      req_tree: requirements.serialize(),
      products: [factories.courses.product({ price: "750" })],
    })
    setMockResponse.get(urls.programs.programsList({ id: [baseProgram.id] }), {
      results: [programDetail],
    })
    renderWithProviders(<ProgramBundleUpsell programs={[baseProgram]} />)

    const upsell = await screen.findByTestId("program-bundle-upsell-item")
    // 3 required + 2 electives = 5 total courses
    expect(upsell).toHaveTextContent(
      "Get all 5 Data Science Courses + Certificates",
    )
    expect(upsell).toHaveTextContent("$750")
    expect(upsell).toHaveTextContent("(19% off)")
    const link = within(upsell).getByRole("link", { name: "View Program" })
    expect(link).toHaveAttribute(
      "href",
      `/programs/${programDetail.readable_id}`,
    )
  })

  test("Shows loading skeleton then disappears when program has no price", async () => {
    const baseProgram = factories.programs.baseProgram()
    const programDetail = factories.programs.program({
      id: baseProgram.id,
      readable_id: baseProgram.readable_id,
      products: [],
    })
    const { promise, resolve } = Promise.withResolvers()
    setMockResponse.get(
      urls.programs.programsList({ id: [baseProgram.id] }),
      promise,
    )
    renderWithProviders(<ProgramBundleUpsell programs={[baseProgram]} />)

    const upsell = screen.getByTestId(TestIds.ProgramBundleUpsell)

    resolve({ results: [programDetail] })
    await waitForElementToBeRemoved(upsell)
  })

  test("Shows loading skeleton then disappears when program detail fetch fails", async () => {
    allowConsoleErrors()
    const baseProgram = factories.programs.baseProgram()
    const { promise, reject } = Promise.withResolvers()
    setMockResponse.get(
      urls.programs.programsList({ id: [baseProgram.id] }),
      promise,
    )
    renderWithProviders(<ProgramBundleUpsell programs={[baseProgram]} />)

    const upsell = screen.getByTestId(TestIds.ProgramBundleUpsell)

    reject(new Error("Network error"))
    await waitForElementToBeRemoved(upsell)
  })

  test("Excludes programs with display_mode=course from bundle upsell", async () => {
    const baseProgram = factories.programs.baseProgram()
    const programDetail = factories.programs.program({
      id: baseProgram.id,
      readable_id: baseProgram.readable_id,
      display_mode: DisplayModeEnum.Course,
      products: [factories.courses.product({ price: "750" })],
    })
    const { promise, resolve } = Promise.withResolvers()
    setMockResponse.get(
      urls.programs.programsList({ id: [baseProgram.id] }),
      promise,
    )
    renderWithProviders(<ProgramBundleUpsell programs={[baseProgram]} />)

    const upsell = screen.getByTestId(TestIds.ProgramBundleUpsell)
    resolve({ results: [programDetail] })
    await waitForElementToBeRemoved(upsell)
  })

  test("Renders upsell for multiple programs", async () => {
    const makeReqTree = (courseCount: number) => {
      const requirements = new RequirementTreeBuilder()
      const required = requirements.addOperator({ operator: "all_of" })
      for (let i = 0; i < courseCount; i++) required.addCourse()
      return requirements.serialize()
    }

    const prices = ["500", "900"]
    const basePrograms = [
      factories.programs.baseProgram(),
      factories.programs.baseProgram(),
    ]
    const programDetails = basePrograms.map((bp, i) =>
      factories.programs.program({
        id: bp.id,
        readable_id: bp.readable_id,
        title: bp.title,
        req_tree: makeReqTree(i + 3),
        products: [factories.courses.product({ price: prices[i] })],
      }),
    )
    setMockResponse.get(
      urls.programs.programsList({ id: basePrograms.map((bp) => bp.id) }),
      { results: programDetails },
    )
    renderWithProviders(<ProgramBundleUpsell programs={basePrograms} />)

    const items = await screen.findAllByTestId("program-bundle-upsell-item")
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent(programDetails[0].title)
    expect(items[0]).toHaveTextContent("$500")
    expect(items[1]).toHaveTextContent(programDetails[1].title)
    expect(items[1]).toHaveTextContent("$900")
  })
})
