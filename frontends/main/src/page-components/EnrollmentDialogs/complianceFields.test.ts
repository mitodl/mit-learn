import type { User } from "@mitodl/mitxonline-api-axios/v2"
import { factories as mitxFactories } from "api/mitxonline-test-utils"
import {
  MINIMUM_AGE,
  initialJitValues,
  isFieldRequired,
  jitPatchPayload,
  needsComplianceInfo,
  requiresSubdivision,
  subdivisionOptions,
  yearOfBirthOptions,
} from "./complianceFields"
import type { JitFormValues } from "./complianceFields"

const values = (overrides: Partial<JitFormValues> = {}): JitFormValues => ({
  first_name: "Ada",
  last_name: "Lovelace",
  country: "US",
  street_address_1: "1 Main St",
  street_address_2: "",
  city: "Cambridge",
  state: "US-MA",
  postal_code: "02139",
  year_of_birth: "1990",
  ...overrides,
})

describe("needsComplianceInfo", () => {
  test("no user yet -> not blocked", () => {
    expect(needsComplianceInfo(undefined)).toBe(false)
  })

  test("complete profile -> not blocked", () => {
    const user = mitxFactories.user.user({
      compliance_missing_fields: [],
      user_profile: { year_of_birth: 1990 },
    })
    expect(needsComplianceInfo(user)).toBe(false)
  })

  test("missing export-compliance fields -> blocked", () => {
    const user = mitxFactories.user.user({
      compliance_missing_fields: ["city", "postal_code"],
      user_profile: { year_of_birth: 1990 },
    })
    expect(needsComplianceInfo(user)).toBe(true)
  })

  test.each([{ year_of_birth: null }, { year_of_birth: 0 }])(
    "missing year of birth ($year_of_birth) -> blocked even when compliance is satisfied",
    (profile) => {
      const user = mitxFactories.user.user({
        compliance_missing_fields: [],
        user_profile: profile,
      })
      expect(needsComplianceInfo(user)).toBe(true)
    },
  )

  test("deployment without compliance_missing_fields -> treated as nothing missing", () => {
    // Production predating mitodl/mitxonline#3818 omits the field entirely. It
    // must not read as "everything is missing".
    const user: User = mitxFactories.user.user({
      user_profile: { year_of_birth: 1990 },
    })
    delete (user as Partial<User>).compliance_missing_fields
    expect(needsComplianceInfo(user)).toBe(false)
  })
})

describe("requiresSubdivision", () => {
  test.each(["US", "CA", "us", " ca "])("%s requires a subdivision", (code) => {
    expect(requiresSubdivision(code)).toBe(true)
  })

  test.each(["GB", "FR", "", null, undefined])(
    "%s does not require a subdivision",
    (code) => {
      expect(requiresSubdivision(code)).toBe(false)
    },
  )
})

describe("isFieldRequired", () => {
  test.each([
    "first_name",
    "last_name",
    "country",
    "street_address_1",
    "city",
    "year_of_birth",
  ] as const)("%s is required regardless of country", (field) => {
    expect(isFieldRequired(field, "GB")).toBe(true)
    expect(isFieldRequired(field, "US")).toBe(true)
  })

  test.each(["state", "postal_code"] as const)(
    "%s is required only for US/CA",
    (field) => {
      expect(isFieldRequired(field, "US")).toBe(true)
      expect(isFieldRequired(field, "CA")).toBe(true)
      expect(isFieldRequired(field, "GB")).toBe(false)
      expect(isFieldRequired(field, "")).toBe(false)
    },
  )

  test("street_address_2 is never required", () => {
    expect(isFieldRequired("street_address_2", "US")).toBe(false)
    expect(isFieldRequired("street_address_2", "GB")).toBe(false)
  })
})

describe("initialJitValues", () => {
  test("prefills from the stored profile, including partial data", () => {
    const user = mitxFactories.user.user({
      legal_address: {
        first_name: "Ada",
        last_name: "",
        country: "US",
        city: "Cambridge",
        state: "US-MA",
      },
      user_profile: { year_of_birth: 1988 },
    })
    expect(initialJitValues(user)).toEqual({
      first_name: "Ada",
      last_name: "",
      country: "US",
      street_address_1: "",
      street_address_2: "",
      city: "Cambridge",
      state: "US-MA",
      postal_code: "",
      year_of_birth: "1988",
    })
  })

  test("no profile at all -> every field empty", () => {
    const user = mitxFactories.user.user({
      legal_address: null,
      user_profile: null,
    })
    expect(Object.values(initialJitValues(user))).toEqual(
      expect.arrayContaining([""]),
    )
    expect(initialJitValues(user).year_of_birth).toBe("")
    expect(initialJitValues(user).country).toBe("")
  })
})

describe("jitPatchPayload", () => {
  test("splits fields between legal_address and user_profile", () => {
    expect(jitPatchPayload(values())).toEqual({
      legal_address: {
        first_name: "Ada",
        last_name: "Lovelace",
        country: "US",
        street_address_1: "1 Main St",
        street_address_2: "",
        city: "Cambridge",
        state: "US-MA",
        postal_code: "02139",
      },
      user_profile: { year_of_birth: 1990 },
    })
  })

  test("never sends email, which is owned by the SSO account", () => {
    const payload = jitPatchPayload(values())
    expect(payload).not.toHaveProperty("email")
    expect(payload.legal_address).not.toHaveProperty("email")
  })

  test("trims whitespace the backend would treat as absent", () => {
    const payload = jitPatchPayload(
      values({
        first_name: "  Ada  ",
        city: " Cambridge ",
        postal_code: " 1 ",
      }),
    )
    expect(payload.legal_address).toMatchObject({
      first_name: "Ada",
      city: "Cambridge",
      postal_code: "1",
    })
  })

  test("drops a subdivision that does not apply to the chosen country", () => {
    // Someone who had US-MA stored and switches to the UK must not submit a US
    // state under a country that has none.
    const payload = jitPatchPayload(values({ country: "GB", state: "US-MA" }))
    expect(payload.legal_address?.state).toBe("")
  })

  test("year of birth is sent as an integer", () => {
    expect(
      jitPatchPayload(values({ year_of_birth: "1975" })).user_profile,
    ).toEqual({ year_of_birth: 1975 })
  })
})

describe("subdivisionOptions", () => {
  test("narrows the loosely-typed states array", () => {
    const country = {
      code: "US",
      name: "United States",
      states: [{ code: "US-MA", name: "Massachusetts" }],
    }
    expect(subdivisionOptions(country)).toEqual([
      { code: "US-MA", name: "Massachusetts" },
    ])
  })

  test("skips malformed entries rather than trusting the shape", () => {
    const country = {
      code: "US",
      name: "United States",
      states: [{ code: "US-MA", name: "Massachusetts" }, { code: 5 }, {}],
    }
    expect(subdivisionOptions(country)).toEqual([
      { code: "US-MA", name: "Massachusetts" },
    ])
  })

  test("countries without subdivisions yield none", () => {
    expect(
      subdivisionOptions({ code: "GB", name: "United Kingdom", states: [] }),
    ).toEqual([])
    expect(subdivisionOptions(undefined)).toEqual([])
  })
})

describe("yearOfBirthOptions", () => {
  test("runs from the newest year satisfying the minimum age back to 1900", () => {
    const options = yearOfBirthOptions()
    const newest = new Date().getFullYear() - MINIMUM_AGE
    expect(options[0]).toBe(newest.toString())
    expect(options.at(-1)).toBe("1900")
    expect(options).toHaveLength(newest - 1900 + 1)
  })
})
