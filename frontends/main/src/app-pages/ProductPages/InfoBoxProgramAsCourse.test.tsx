import React from "react"
import { renderWithProviders, screen } from "@/test-utils"
import {
  setMockResponse,
  urls as learnUrls,
  factories as learnFactories,
} from "api/test-utils"
import { factories, urls } from "api/mitxonline-test-utils"
import ProgramAsCourseInfoBox from "./InfoBoxProgramAsCourse"

const makeProgram = factories.programs.program

describe("ProgramAsCourseInfoBox", () => {
  test("Renders with Course Information heading", () => {
    const program = makeProgram()
    setMockResponse.get(
      learnUrls.userMe.get(),
      learnFactories.user.user({ is_authenticated: false }),
    )
    setMockResponse.get(urls.programEnrollments.enrollmentsListV3(), [])
    renderWithProviders(<ProgramAsCourseInfoBox program={program} />)
    expect(screen.getByText("Course Information")).toBeInTheDocument()
  })

  test("Renders enrollment button", async () => {
    const program = makeProgram({
      enrollment_modes: [
        factories.courses.enrollmentMode({ requires_payment: false }),
      ],
    })
    setMockResponse.get(
      learnUrls.userMe.get(),
      learnFactories.user.user({ is_authenticated: false }),
    )
    setMockResponse.get(urls.programEnrollments.enrollmentsListV3(), [])
    renderWithProviders(<ProgramAsCourseInfoBox program={program} />)
    await screen.findByRole("button", { name: /enroll/i })
  })
})
