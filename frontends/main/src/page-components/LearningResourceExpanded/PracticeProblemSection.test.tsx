import React from "react"
import { screen, within } from "@testing-library/react"
import user from "@testing-library/user-event"
import { factories, setMockResponse, urls } from "api/test-utils"
import { renderWithProviders } from "@/test-utils"
import { LearningResourceExpanded } from "./LearningResourceExpanded"

jest.mock("@/common/useFeatureFlag", () => ({
  useFeatureFlag: () => false,
}))

const setup = (
  practiceProblem: ReturnType<
    typeof factories.learningResources.practiceProblem
  > | null,
  { inUserList = false } = {},
) => {
  const resource = factories.learningResources.document({
    title: "Car and Bicycle Rider",
    resource_category: "Practice & Assignment",
    practice_problem: practiceProblem,
  })
  setMockResponse.get(urls.userMe.get(), factories.user.user())
  const onAddToUserListClick = jest.fn()
  renderWithProviders(
    <LearningResourceExpanded
      resourceId={resource.id}
      resource={resource}
      chatExpanded={false}
      imgConfig={{ width: 385, height: 200 }}
      inUserList={inUserList}
      onAddToUserListClick={onAddToUserListClick}
    />,
  )
  return { resource, onAddToUserListClick }
}

describe("PracticeProblemSection", () => {
  test("Renders the problem's statement, parts and source", async () => {
    const problem = factories.learningResources.practiceProblem({
      number: "1",
      document_title: "Problem Set 1",
      statement: "A car moves at speed $v_0$.",
      parts: [
        { label: "a", body: "Find $v(t)$." },
        { label: "b", body: "Find $x(t)$." },
      ],
      pages: [3, 4],
      source: {
        course_id: 123,
        course_title: "Classical Mechanics",
        course_readable_id: "8.01SC",
        semester: "Fall",
        year: 2016,
        file_title: "Problem Set 1",
        file_url: "https://ocw.mit.edu/ps1.pdf",
      },
    })
    setup(problem)

    expect(screen.getByText("Practice Problem")).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Car and Bicycle Rider" }),
    ).toBeInTheDocument()
    const statement = screen.getByTestId("practice-problem-statement")
    expect(
      within(statement).getByText("A car moves at speed $v_0$."),
    ).toBeInTheDocument()
    const parts = within(statement).getAllByRole("listitem")
    expect(parts.map((part) => part.textContent)).toEqual([
      "(a)Find $v(t)$.",
      "(b)Find $x(t)$.",
    ])
    expect(screen.getByText("2 parts")).toBeInTheDocument()
    expect(screen.getAllByText(/Pages 3–4/).length).toBeGreaterThan(0)
    expect(
      screen.getByText("Fall 2016 · Problem Set 1, problem 1 · Pages 3–4"),
    ).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Original PDF" })).toHaveAttribute(
      "href",
      "https://ocw.mit.edu/ps1.pdf#page=3",
    )
    expect(
      screen.getByRole("link", { name: "Find this course" }),
    ).toHaveAttribute(
      "href",
      expect.stringContaining(
        "resource=123&resource_title=classical-mechanics",
      ),
    )
    expect(screen.getByText(/Transcribed by AI/)).toBeInTheDocument()
    // the default drawer content is not shown
    expect(screen.queryByTestId("drawer-cta")).not.toBeInTheDocument()
  })

  test.each([
    { inUserList: false, label: "Save for later" },
    { inUserList: true, label: "Saved" },
  ])(
    "Save button adds the problem to a list (inUserList=$inUserList)",
    async ({ inUserList, label }) => {
      const { resource, onAddToUserListClick } = setup(
        factories.learningResources.practiceProblem(),
        { inUserList },
      )
      await user.click(screen.getByRole("button", { name: label }))
      expect(onAddToUserListClick).toHaveBeenCalledWith(
        expect.anything(),
        resource.id,
      )
    },
  )

  test("A document that is not a problem shows the default drawer", () => {
    setup(null)
    expect(screen.getByTestId("drawer-cta")).toBeInTheDocument()
    expect(
      screen.queryByTestId("practice-problem-statement"),
    ).not.toBeInTheDocument()
    expect(screen.getByText("Practice & Assignment")).toBeInTheDocument()
  })
})
