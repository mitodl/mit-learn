import { validateEnv } from "../validateEnv"

// validateEnv() reads process.env directly, so we swap it per-test (mirrors
// bootstrap/api.test.ts) and restore after. This is a smoke test of the schema
// contract, not exhaustive coverage of yup.
const REQUIRED_ENV = {
  NEXT_PUBLIC_ORIGIN: "https://learn.test",
  NEXT_PUBLIC_MITOL_API_BASE_URL: "https://api.learn.test",
  NEXT_PUBLIC_SITE_NAME: "MIT Learn",
  NEXT_PUBLIC_MITOL_SUPPORT_EMAIL: "help@learn.test",
  NEXT_PUBLIC_CSRF_COOKIE_NAME: "csrftoken",
  NEXT_PUBLIC_MITX_ONLINE_LEGACY_BASE_URL: "https://legacy.mitx.test",
  NEXT_PUBLIC_MITX_ONLINE_BASE_URL: "https://mitx.test",
  NEXT_PUBLIC_MITX_ONLINE_CSRF_COOKIE_NAME: "csrf_mitxonline",
}

const originalEnv = process.env

describe("validateEnv", () => {
  beforeEach(() => {
    process.env = { ...originalEnv, ...REQUIRED_ENV }
  })
  afterEach(() => {
    process.env = originalEnv
  })

  test("passes when all required vars are present", () => {
    expect(() => validateEnv()).not.toThrow()
  })

  test("throws, naming the missing required var", () => {
    delete process.env.NEXT_PUBLIC_MITX_ONLINE_LEGACY_BASE_URL
    expect(() => validateEnv()).toThrow(
      /NEXT_PUBLIC_MITX_ONLINE_LEGACY_BASE_URL/,
    )
  })

  test("reports every missing required var at once (abortEarly: false)", () => {
    delete process.env.NEXT_PUBLIC_ORIGIN
    delete process.env.NEXT_PUBLIC_SITE_NAME

    let errors: string[] = []
    try {
      validateEnv()
    } catch (err) {
      errors = (err as { errors: string[] }).errors
    }

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/NEXT_PUBLIC_ORIGIN/),
        expect.stringMatching(/NEXT_PUBLIC_SITE_NAME/),
      ]),
    )
  })
})
