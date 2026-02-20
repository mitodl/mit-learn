import React from "react"
import {
  renderWithProviders,
  screen,
  setMockResponse,
  setupLocationMock,
  user,
  within,
} from "@/test-utils"
import { EnrollmentDisplay } from "./EnrollmentDisplay"
import { DashboardCard, DashboardType } from "./DashboardCard"
import { dashboardCourse, setupEnrollments } from "./test-utils"
import * as mitxonline from "api/mitxonline-test-utils"
import {
  urls as testUrls,
  factories as testFactories,
  mockAxiosInstance,
} from "api/test-utils"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { faker } from "@faker-js/faker/locale/en"
import invariant from "tiny-invariant"
import { getDescriptionFor } from "ol-test-utilities"
import type { User as MitxUser } from "@mitodl/mitxonline-api-axios/v2"
import type { PartialDeep } from "type-fest"

jest.mock("posthog-js/react")
const mockedUseFeatureFlagEnabled = jest
  .mocked(useFeatureFlagEnabled)
  .mockImplementation(() => false)

describe("DashboardDialogs", () => {
  const setupApis = (includeExpired: boolean = true) => {
    const mitxOnlineUser = mitxonline.factories.user.user()
    setMockResponse.get(mitxonline.urls.userMe.get(), mitxOnlineUser)
    const { enrollments, completed, expired, started, notStarted } =
      setupEnrollments(includeExpired)

    mockedUseFeatureFlagEnabled.mockReturnValue(true)
    setMockResponse.get(
      mitxonline.urls.enrollment.enrollmentsListV2(),
      enrollments,
    )
    setMockResponse.get(
      mitxonline.urls.programEnrollments.enrollmentsListV3(),
      [],
    )
    setMockResponse.get(mitxonline.urls.contracts.contractsList(), [])

    return { enrollments, completed, expired, started, notStarted }
  }

  test("Opening the email settings dialog and submitting it fires the proper API call", async () => {
    const { enrollments } = setupApis()
    const enrollment = faker.helpers.arrayElement(enrollments)

    setMockResponse.patch(
      mitxonline.urls.enrollment.courseEnrollment(enrollment.id),
      null,
    )
    renderWithProviders(<EnrollmentDisplay />)

    await screen.findByRole("heading", { name: "My Learning" })

    const cards = await screen.findAllByTestId("enrollment-card-desktop")
    expect(cards.length).toBe(enrollments.length)

    const card = cards.find(
      (c) => !!within(c).queryByText(enrollment.run.title),
    )
    invariant(card)

    const contextMenuButton = await within(card).findByLabelText("More options")
    await user.click(contextMenuButton)

    const emailSettingsButton = await screen.findByRole("menuitem", {
      name: "Email Settings",
    })
    await user.click(emailSettingsButton)

    const dialog = await screen.findByRole("dialog", {
      name: "Email Settings",
    })
    expect(dialog).toBeInTheDocument()

    const checkbox = within(dialog).getByRole("checkbox", {
      name: "Receive course emails",
    })
    expect(checkbox).toBeInTheDocument()
    await user.click(checkbox)

    const confirmButton = within(dialog).getByRole("button", {
      name: "Save Settings",
    })
    expect(confirmButton).toBeEnabled()

    await user.click(confirmButton)

    expect(mockAxiosInstance.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "PATCH",
        url: mitxonline.urls.enrollment.courseEnrollment(enrollment.id),
      }),
    )
  })

  test("Opening the unenroll dialog and confirming the unenroll fires the proper API call", async () => {
    const { enrollments } = setupApis()
    const enrollment = faker.helpers.arrayElement(enrollments)

    setMockResponse.delete(
      mitxonline.urls.enrollment.courseEnrollment(enrollment.id),
      null,
    )
    renderWithProviders(<EnrollmentDisplay />)

    await screen.findByRole("heading", { name: "My Learning" })

    const cards = await screen.findAllByTestId("enrollment-card-desktop")
    expect(cards.length).toBe(enrollments.length)

    const card = cards.find(
      (c) => !!within(c).queryByText(enrollment.run.title),
    )
    invariant(card)

    const contextMenuButton = await within(card).findByLabelText("More options")
    await user.click(contextMenuButton)

    const unenrollButton = await screen.findByRole("menuitem", {
      name: "Unenroll",
    })
    await user.click(unenrollButton)

    const confirmButton = await screen.findByRole("button", {
      name: "Unenroll",
    })
    expect(confirmButton).toBeEnabled()

    await user.click(confirmButton)

    expect(mockAxiosInstance.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "DELETE",
        url: mitxonline.urls.enrollment.courseEnrollment(enrollment.id),
      }),
    )
  })
})

describe("JustInTimeDialog", () => {
  const getFields = (root: HTMLElement) => {
    return {
      country: within(root).getByRole("combobox", { name: "Country" }),
      year_of_birth: within(root).getByRole("combobox", {
        name: "Year of Birth",
      }),
    }
  }

  setupLocationMock()

  type SetupJitOptions = {
    userOverrides?: PartialDeep<MitxUser>
  }

  const setupJustInTimeTest = ({
    userOverrides = {},
  }: SetupJitOptions = {}) => {
    // Setup MIT Learn user
    const mitLearnUser = testFactories.user.user()
    setMockResponse.get(testUrls.userMe.get(), mitLearnUser)

    // Setup incomplete mitxonline user (missing country and year_of_birth)
    const incompleteMitxUser = mitxonline.factories.user.user({
      legal_address: null,
      user_profile: null,
      ...userOverrides,
    })
    setMockResponse.get(mitxonline.urls.userMe.get(), incompleteMitxUser)

    // Setup countries data
    const countries = [
      { code: "US", name: "United States" },
      { code: "CA", name: "Canada" },
      { code: "GB", name: "United Kingdom" },
    ]
    setMockResponse.get(mitxonline.urls.countries.list(), countries)

    // Setup course for enrollment
    const b2bContractId = faker.number.int()
    const run = mitxonline.factories.courses.courseRun({
      b2b_contract: b2bContractId,
      is_enrollable: true,
      live: true,
      enrollment_start: faker.date.past().toISOString(),
      enrollment_end: faker.date.future().toISOString(),
    })
    const course = dashboardCourse({
      courseruns: [run],
      next_run_id: run.id,
    })

    // Setup enrollment API
    setMockResponse.post(
      mitxonline.urls.b2b.courseEnrollment(course.readable_id),
      null,
    )

    return { mitLearnUser, incompleteMitxUser, countries, course, run }
  }

  test("Opens just-in-time dialog when enrolling with incomplete mitxonline user data", async () => {
    const { course } = setupJustInTimeTest()

    renderWithProviders(
      <DashboardCard resource={{ type: DashboardType.Course, data: course }} />,
    )

    const enrollButtons = await screen.findAllByTestId("courseware-button")
    await user.click(enrollButtons[0]) // Use the first (desktop) button

    const dialog = await screen.findByRole("dialog", {
      name: "Just a Few More Details",
    })
    expect(dialog).toBeInTheDocument()

    expect(
      within(dialog).getByText(
        "We need a bit more info before you can enroll.",
      ),
    ).toBeInTheDocument()
    const fields = getFields(dialog)
    expect(fields.country).toBeVisible()
    expect(fields.year_of_birth).toBeInTheDocument()
  })

  test.each([
    {
      userOverrides: { legal_address: { country: "CA" } },
      expectCountry: "Canada",
      expectYob: "Please Select",
    },
    {
      userOverrides: { user_profile: { year_of_birth: 1988 } },
      expectCountry: "Please Select",
      expectYob: "1988",
    },
  ])(
    "Dialog pre-populates with user data if available",
    async ({ userOverrides, expectCountry, expectYob }) => {
      const { course } = setupJustInTimeTest({ userOverrides })
      renderWithProviders(
        <DashboardCard
          resource={{ type: DashboardType.Course, data: course }}
        />,
      )
      const enrollButtons = await screen.findAllByTestId("courseware-button")
      await user.click(enrollButtons[0]) // Use the first (desktop) button
      const dialog = await screen.findByRole("dialog", {
        name: "Just a Few More Details",
      })
      const fields = getFields(dialog)
      expect(fields.country).toHaveTextContent(expectCountry)
      expect(fields.year_of_birth).toHaveTextContent(expectYob)
    },
  )

  test("Validates required fields in just-in-time dialog", async () => {
    const { course } = setupJustInTimeTest()

    renderWithProviders(
      <DashboardCard resource={{ type: DashboardType.Course, data: course }} />,
    )

    const enrollButtons = await screen.findAllByTestId("courseware-button")
    await user.click(enrollButtons[0]) // Use the first (desktop) button

    const dialog = await screen.findByRole("dialog", {
      name: "Just a Few More Details",
    })

    const submitButton = within(dialog).getByRole("button", {
      name: "Submit",
    })

    // Try submitting with empty fields - should show validation errors
    await user.click(submitButton)

    // Should show validation errors
    const fields = getFields(dialog)
    expect(fields.country).toBeInvalid()
    expect(fields.year_of_birth).toBeInvalid()
    expect(getDescriptionFor(fields.country)).toHaveTextContent(
      "Country is required",
    )
    expect(getDescriptionFor(fields.year_of_birth)).toHaveTextContent(
      "Year of birth is required",
    )
  })

  test("Generates correct year of birth options (minimum age 13)", async () => {
    const { course } = setupJustInTimeTest()

    renderWithProviders(
      <DashboardCard resource={{ type: DashboardType.Course, data: course }} />,
    )

    const enrollButtons = await screen.findAllByTestId("courseware-button")
    await user.click(enrollButtons[0]) // Use the first (desktop) button

    const dialog = await screen.findByRole("dialog", {
      name: "Just a Few More Details",
    })
    const fields = getFields(dialog)
    await user.click(fields.year_of_birth)

    const currentYear = new Date().getFullYear()
    const maxYear = currentYear - 13
    const options = screen.getAllByRole("option")
    const optionValues = options.map((opt) => opt.textContent)
    const expectedYears = Array.from({ length: maxYear - 1900 + 1 }, (_, i) =>
      (maxYear - i).toString(),
    )
    expect(expectedYears.length).toBeGreaterThan(50) // sanity
    expect(optionValues).toEqual(["Please Select", ...expectedYears])
  })

  test("Shows expected countries in country dropdown", async () => {
    const { course, countries } = setupJustInTimeTest()

    renderWithProviders(
      <DashboardCard resource={{ type: DashboardType.Course, data: course }} />,
    )

    const enrollButtons = await screen.findAllByTestId("courseware-button")
    await user.click(enrollButtons[0]) // Use the first (desktop) button

    const dialog = await screen.findByRole("dialog", {
      name: "Just a Few More Details",
    })
    const fields = getFields(dialog)
    await user.click(fields.country)

    const options = screen.getAllByRole("option")
    expect(countries.length).toBeGreaterThan(1) // sanity
    const optionValues = options.map((opt) => opt.textContent)
    expect(optionValues).toEqual([
      "Please Select",
      ...countries.map((c) => c.name),
    ])
  })

  test("Cancels just-in-time dialog without making API calls", async () => {
    const { course } = setupJustInTimeTest()

    renderWithProviders(
      <DashboardCard resource={{ type: DashboardType.Course, data: course }} />,
    )

    const enrollButtons = await screen.findAllByTestId("courseware-button")
    await user.click(enrollButtons[0]) // Use the first (desktop) button

    const dialog = await screen.findByRole("dialog", {
      name: "Just a Few More Details",
    })

    const cancelButton = within(dialog).getByRole("button", {
      name: "Cancel",
    })
    await user.click(cancelButton)

    // No PATCH calls should have been made
    expect(mockAxiosInstance.request).not.toHaveBeenCalledWith(
      expect.objectContaining({
        method: "PATCH",
        url: mitxonline.urls.userMe.get(),
      }),
    )
  })

  test("Submitting just-in-time dialog makes proper API calls", async () => {
    const { course, run } = setupJustInTimeTest({
      userOverrides: { user_profile: { year_of_birth: 1988 } },
    })

    renderWithProviders(
      <DashboardCard resource={{ type: DashboardType.Course, data: course }} />,
    )
    const enrollButtons = await screen.findAllByTestId("courseware-button")
    await user.click(enrollButtons[0]) // Use the first (desktop) button

    const dialog = await screen.findByRole("dialog", {
      name: "Just a Few More Details",
    })
    const fields = getFields(dialog)
    await user.click(fields.country)

    const option = screen.getByRole("option", { name: "Canada" })
    await user.click(option) // Select third option (first is "Please Select")

    invariant(course.readable_id)
    const spies = {
      createEnrollment: jest.fn(),
      patchUser: jest.fn(),
    }
    setMockResponse.patch(mitxonline.urls.userMe.get(), spies.patchUser, {
      requestBody: {
        user_profile: { year_of_birth: 1988 },
        legal_address: { country: "CA" },
      },
    })
    setMockResponse.post(
      mitxonline.urls.b2b.courseEnrollment(run.courseware_id),
      spies.createEnrollment,
    )

    const submitButton = within(dialog).getByRole("button", {
      name: "Submit",
    })

    await user.click(submitButton)
    await expect(spies.patchUser).toHaveBeenCalled()
    await expect(spies.createEnrollment).toHaveBeenCalled()
    expect(window.location.assign).toHaveBeenCalledWith(run.courseware_url)
  })
})
