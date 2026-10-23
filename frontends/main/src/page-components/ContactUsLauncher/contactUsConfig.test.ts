import { isContactUsEnabled, getContactUsSettings } from "./contactUsConfig"

const ENDPOINT = "https://learn-ai.test/http/support_agent/"

describe("contactUsConfig", () => {
  const original = process.env.NEXT_PUBLIC_LEARN_AI_SUPPORT_ENDPOINT

  afterEach(() => {
    if (original === undefined) {
      delete process.env.NEXT_PUBLIC_LEARN_AI_SUPPORT_ENDPOINT
    } else {
      process.env.NEXT_PUBLIC_LEARN_AI_SUPPORT_ENDPOINT = original
    }
  })

  test("isContactUsEnabled is false when the endpoint is unset", () => {
    delete process.env.NEXT_PUBLIC_LEARN_AI_SUPPORT_ENDPOINT
    expect(isContactUsEnabled()).toBe(false)
  })

  test("isContactUsEnabled is true when the endpoint is set", () => {
    process.env.NEXT_PUBLIC_LEARN_AI_SUPPORT_ENDPOINT = ENDPOINT
    expect(isContactUsEnabled()).toBe(true)
  })

  test("getContactUsSettings omits requestBody when no email is given", () => {
    process.env.NEXT_PUBLIC_LEARN_AI_SUPPORT_ENDPOINT = ENDPOINT
    const settings = getContactUsSettings()
    expect(settings.chat?.apiUrl).toBe(ENDPOINT)
    expect(settings.chat?.requestBody).toBeUndefined()
  })

  test("getContactUsSettings includes user_email when an email is given", () => {
    process.env.NEXT_PUBLIC_LEARN_AI_SUPPORT_ENDPOINT = ENDPOINT
    const settings = getContactUsSettings("learner@example.com")
    expect(settings.chat?.requestBody).toEqual({
      user_email: "learner@example.com",
    })
  })
})
