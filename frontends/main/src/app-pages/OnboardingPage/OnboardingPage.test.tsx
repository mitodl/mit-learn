import React from "react"
import { merge, times } from "lodash"
import mockRouter from "next-router-mock"
import {
  renderWithProviders,
  screen,
  waitFor,
  setMockResponse,
  user,
} from "../../test-utils"
import { allowConsoleErrors } from "ol-test-utilities"
import { urls } from "api/test-utils"
import * as factories from "api/test-utils/factories"
import {
  GoalsEnum,
  DeliveryEnum,
  CurrentEducationEnum,
  CertificateDesiredEnum,
  type Profile,
} from "api/v0"
import OnboardingPage from "./OnboardingPage"

jest.mock("next/navigation", () =>
  jest.requireActual("next-router-mock/navigation"),
)

const STEPS_DATA: Partial<Profile>[] = [
  {
    topic_interests: [factories.learningResources.topic()],
  },
  {
    goals: [GoalsEnum.LifelongLearning],
  },
  {
    certificate_desired: CertificateDesiredEnum.Yes,
  },
  {
    current_education: CurrentEducationEnum.SecondaryHighSchool,
  },
  {
    delivery: [DeliveryEnum.Hybrid],
  },
]

const baseProfile = factories.user.profile()

const profileForStep = (step: number) => {
  const stepsData = STEPS_DATA.slice(0, step)
  return merge({}, baseProfile, ...stepsData)
}

const STEP_TITLES = [
  "What are you interested in learning about?",
  "What are your learning goals?",
  "Are you seeking a certificate?",
  "What is your current level of education?",
  "What course format are you interested in?",
].map((title, index) => ({
  title,
  step: index,
}))

const PROFILES_FOR_STEPS = times(STEPS_DATA.length, profileForStep)

const setup = async (profile: Profile, url?: string) => {
  allowConsoleErrors()
  setMockResponse.get(urls.userMe.get(), factories.user.user())
  setMockResponse.get(urls.profileMe.get(), profile)
  setMockResponse.patch(urls.profileMe.patch(), (req: Partial<Profile>) => ({
    ...profile,
    ...req,
  }))

  renderWithProviders(<OnboardingPage />, url ? { url } : undefined)
}

// this function sets up the test and progresses the UI to the designated step
const setupAndProgressToStep = async (step: number, url?: string) => {
  await setup(PROFILES_FOR_STEPS[step], url)

  for (let stepIdx = 0; stepIdx < step; stepIdx++) {
    await user.click(await findNextButton())
  }
}

const findNextButton = async () => screen.findByRole("button", { name: "Next" })
const findBackButton = async () => screen.findByRole("button", { name: "Back" })
const findFinishButton = async () =>
  screen.findByRole("button", { name: "Finish" })

const queryNextButton = () => screen.queryByRole("button", { name: "Next" })
const queryBackButton = () => screen.queryByRole("button", { name: "Back" })
const queryFinishButton = () => screen.queryByRole("button", { name: "Finish" })

describe("OnboardingPage", () => {
  test.each(STEP_TITLES)(
    "Has expected title (step: $step)",
    async ({ step, title }) => {
      await setupAndProgressToStep(step)
      const heading = await screen.findByRole("heading", {
        name: new RegExp(title),
      })
      expect(heading).toBeInTheDocument()
    },
  )

  test.each(STEP_TITLES)(
    "Navigation to next step (start: $step)",
    async ({ step }) => {
      const nextStep = step + 1
      await setupAndProgressToStep(step)
      if (step === STEP_TITLES.length - 1) {
        await findFinishButton()
        expect(queryBackButton()).not.toBeNil()
        return
      }

      const nextButton = await findNextButton()
      expect(!!queryBackButton()).toBe(step !== 0)
      expect(queryFinishButton()).toBeNil()

      await user.click(nextButton)

      // "Next" button should focus the form so its title is read
      const form = screen.getByRole("form")
      await waitFor(() => expect(form).toHaveFocus())
      expect(form).toHaveAccessibleName(
        expect.stringContaining(STEP_TITLES[nextStep].title),
      )
    },
  )

  test.each(STEP_TITLES)(
    "Navigation to prev step (start: $step)",
    async ({ step }) => {
      const prevStep = step - 1
      await setupAndProgressToStep(step)
      if (step === 0) {
        await findNextButton()
        expect(queryBackButton()).toBeNil()
        expect(queryFinishButton()).toBeNil()
        return
      }

      const backButton = await findBackButton()
      expect(!!queryNextButton()).toBe(step !== STEPS_DATA.length - 1)
      expect(!!queryFinishButton()).toBe(step === STEPS_DATA.length - 1)
      await user.click(backButton)

      // "Prev" button should focus the form so its title is read
      const form = screen.getByRole("form")
      await waitFor(() => expect(form).toHaveFocus())
      expect(form).toHaveAccessibleName(
        expect.stringContaining(STEP_TITLES[prevStep].title),
      )
    },
  )

  test("Redirects to next url after completion if present", async () => {
    const nextUrl = encodeURIComponent(
      `${process.env.NEXT_PUBLIC_ORIGIN}/search?resource=184`,
    )
    const url = `${process.env.NEXT_PUBLIC_ORIGIN}/onboarding?next=${nextUrl}`
    await setupAndProgressToStep(STEPS_DATA.length - 1, url)
    const finishButton = await findFinishButton()
    await user.click(finishButton)

    expect(mockRouter.asPath).toEqual("/search?resource=184")
  })
})
