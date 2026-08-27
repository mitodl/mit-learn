import type React from "react"
import type { DehydratedState } from "@tanstack/react-query"
import { notFound, redirect } from "next/navigation"
import {
  factories,
  urls,
  RequirementTreeBuilder,
} from "api/mitxonline-test-utils"
import { setMockResponse } from "api/test-utils"
import { reqTreeChildQueries } from "@/app-pages/ProductPages/useReqTreeChildren"
import Page from "./page"

jest.mock("@/app/getQueryClient", () => {
  const { makeBrowserQueryClient } = jest.requireActual("@/app/getQueryClient")
  return { getQueryClient: () => makeBrowserQueryClient({ maxRetries: 0 }) }
})

const mockNotFound = jest.mocked(notFound)
const mockRedirect = jest.mocked(redirect)
beforeEach(() => {
  mockNotFound.mockImplementation(() => {
    throw new Error("NEXT_NOT_FOUND")
  })
  mockRedirect.mockImplementation(() => {
    throw new Error("NEXT_REDIRECT")
  })
})

const pageProps = (readableId: string) =>
  ({
    params: Promise.resolve({ readable_id: encodeURIComponent(readableId) }),
  }) as React.ComponentProps<typeof Page>

/**
 * Assert on the keys rather than the response: a prefetch whose key drifts from
 * what useReqTreeChildren reads is silently useless.
 */
test("Prefetches the requirement tree's child courses and programs", async () => {
  const reqTree = new RequirementTreeBuilder()
  const op = reqTree.addOperator({ operator: "all_of" })
  op.addCourse()
  op.addProgram()

  const program = factories.programs.program({ req_tree: reqTree.serialize() })
  const page = factories.pages.programPageItem({ program_details: program })
  const children = reqTreeChildQueries(program)

  setMockResponse.get(
    urls.programs.programsList({
      readable_id: program.readable_id,
      live: true,
    }),
    { results: [program] },
  )
  setMockResponse.get(urls.pages.programPages(program.readable_id), {
    items: [page],
  })
  setMockResponse.get(
    urls.courses.coursesList({
      id: children.courseIds,
      page_size: children.courseIds.length,
    }),
    {
      results: children.courseIds.map((id) => factories.courses.course({ id })),
    },
  )
  setMockResponse.get(
    urls.programs.programsList({
      id: children.programIds,
      page_size: children.programIds.length,
    }),
    {
      results: children.programIds.map((id) =>
        factories.programs.program({ id }),
      ),
    },
  )

  const element = (await Page(
    pageProps(program.readable_id),
  )) as React.ReactElement<{
    state: DehydratedState
  }>

  expect(element.props.state.queries.map((query) => query.queryKey)).toEqual(
    expect.arrayContaining([
      children.courses.queryKey,
      children.programs.queryKey,
    ]),
  )
})
