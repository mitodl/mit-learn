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

  test("getContactUsSettings omits requestBody when the requester is unknown", () => {
    process.env.NEXT_PUBLIC_LEARN_AI_SUPPORT_ENDPOINT = ENDPOINT
    const settings = getContactUsSettings()
    expect(settings.chat?.apiUrl).toBe(ENDPOINT)
    expect(settings.chat?.requestBody).toBeUndefined()
  })

  test("getContactUsSettings includes user_email when an email is given", () => {
    process.env.NEXT_PUBLIC_LEARN_AI_SUPPORT_ENDPOINT = ENDPOINT
    const settings = getContactUsSettings({ email: "learner@example.com" })
    expect(settings.chat?.requestBody).toEqual({
      user_email: "learner@example.com",
    })
  })

  test("getContactUsSettings includes the name and username when given", () => {
    process.env.NEXT_PUBLIC_LEARN_AI_SUPPORT_ENDPOINT = ENDPOINT
    const settings = getContactUsSettings({
      email: "learner@example.com",
      name: "Ada Lovelace",
      username: "ada",
    })
    expect(settings.chat?.requestBody).toEqual({
      user_email: "learner@example.com",
      user_name: "Ada Lovelace",
      user_username: "ada",
    })
  })

  test("getContactUsSettings omits the keys whose values are blank", () => {
    process.env.NEXT_PUBLIC_LEARN_AI_SUPPORT_ENDPOINT = ENDPOINT
    const settings = getContactUsSettings({
      email: "learner@example.com",
      name: "",
      username: undefined,
    })
    expect(settings.chat?.requestBody).toEqual({
      user_email: "learner@example.com",
    })
  })

  test("getContactUsSettings omits requestBody when every value is blank", () => {
    process.env.NEXT_PUBLIC_LEARN_AI_SUPPORT_ENDPOINT = ENDPOINT
    const settings = getContactUsSettings({ email: "", name: "", username: "" })
    expect(settings.chat?.requestBody).toBeUndefined()
  })
})
