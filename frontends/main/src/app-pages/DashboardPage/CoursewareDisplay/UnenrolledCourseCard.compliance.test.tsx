import React from "react"
import {
  renderWithProviders,
  screen,
  setMockResponse,
  setupLocationMock,
  user,
  waitFor,
  within,
} from "@/test-utils"
import * as mitxonline from "api/mitxonline-test-utils"
import { makeRequest } from "api/test-utils"
import { faker } from "@faker-js/faker/locale/en"
import { UnenrolledCourseCard } from "./UnenrolledCourseCard"

/**
 * Kept out of UnenrolledCourseCard.test.tsx deliberately. This is the only test
 * that drives a full enroll → gate → dialog → enroll round trip, and running it
 * after that file's ~70 tests made it flaky: an earlier test's request resolves
 * after its own test ended, by which point jest has cleared the mock registry,
 * and the stray call is attributed here. Its own file gives it clean state.
 */
describe("UnenrolledCourseCard — resuming enrollment after the compliance gate", () => {
  setupLocationMock()

  test("completing the just-in-time dialog resumes the B2B enrollment, including program_id", async () => {
    // The dialog no longer enrolls; it only saves the profile and hands control
    // back, so the enrollment must still carry the program context it was
    // triggered with.
    const parentProgramReadableIds = ["program-v1:MITx+DEDP"]
    const userData = mitxonline.factories.user.user({
      compliance_missing_fields: [],
      legal_address: {
        first_name: "Ada",
        last_name: "Lovelace",
        country: "GB",
        street_address_1: "1 Main St",
        city: "London",
      },
      // The only outstanding field, so the dialog opens with everything else
      // already filled in and needs a single selection to satisfy.
      user_profile: { year_of_birth: null },
    })
    const b2bContractId = faker.number.int()
    const run = mitxonline.factories.courses.courseRun({
      b2b_contract: b2bContractId,
      is_enrollable: true,
    })
    const course = mitxonline.factories.courses.course({
      courseruns: [run],
      next_run_id: run.id,
    })
    const enrollmentUrl = mitxonline.urls.b2b.courseEnrollment(
      run.courseware_id,
    )

    setMockResponse.get(mitxonline.urls.userMe.get(), userData)
    setMockResponse.get(mitxonline.urls.enrollment.enrollmentsListV3(), [])
    setMockResponse.get(mitxonline.urls.countries.list(), [
      { code: "GB", name: "United Kingdom", states: [] },
    ])
    setMockResponse.patch(mitxonline.urls.userMe.get(), null)
    setMockResponse.post(enrollmentUrl, { result: "b2b-enroll-success" })

    renderWithProviders(
      <UnenrolledCourseCard
        course={course}
        contractId={b2bContractId}
        ancestorContext={{ parentProgramReadableIds }}
      />,
    )

    const card = screen.getByTestId("enrollment-card-desktop")
    await user.click(within(card).getByTestId("courseware-button"))

    const dialog = await screen.findByRole("dialog", {
      name: "Just a Few More Details",
    })
    await user.click(
      within(dialog).getByRole("combobox", { name: "Year of Birth" }),
    )
    await user.click(await screen.findByRole("option", { name: "1988" }))
    await user.click(within(dialog).getByRole("button", { name: "Submit" }))

    await waitFor(() =>
      expect(makeRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "post",
          url: enrollmentUrl,
          body: expect.objectContaining({
            program_id: "program-v1:MITx+DEDP",
          }),
        }),
      ),
    )
  })
})
