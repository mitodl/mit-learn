import * as Yup from "yup"
import type {
  Country,
  LegalAddressRequest,
  PatchedUserRequest,
  User,
} from "@mitodl/mitxonline-api-axios/v2"

/**
 * Fields the just-in-time dialog collects, in display order.
 *
 * Country leads the address block because the subdivision and postal code
 * requirements — and the list of state options — depend on it.
 *
 * Two entries are not export-compliance fields:
 *  - `street_address_2` is never required, but belongs to an address form.
 *  - `year_of_birth` backs MIT's minimum-age requirement, which Learn enforces
 *    itself. It is deliberately absent from `compliance_missing_fields`: that
 *    list is CyberSource-shaped and read-only, and year of birth is not a
 *    bill-to field. We read it straight off `user_profile` instead.
 *
 * Email is deliberately not collected here: it comes from the user's SSO
 * identity, so editing it would silently diverge the MITx Online account from
 * Keycloak, and the dialog can't change it anyway.
 */
const JIT_FIELDS = [
  "first_name",
  "last_name",
  "country",
  "street_address_1",
  "street_address_2",
  "city",
  "state",
  "postal_code",
  "year_of_birth",
] as const

type JitField = (typeof JIT_FIELDS)[number]

type JitFormValues = Record<JitField, string>

type FieldSpec = {
  label: string
  /**
   * Which control renders this field. `country`, `state` and `year` are
   * selects over generated option lists.
   */
  kind: "text" | "country" | "state" | "year"
  /** Branch of the PATCH payload this field belongs to, or null if not written. */
  patch: "legal_address" | "user_profile" | null
}

const FIELD_SPECS: Record<JitField, FieldSpec> = {
  first_name: { label: "First Name", kind: "text", patch: "legal_address" },
  last_name: { label: "Last Name", kind: "text", patch: "legal_address" },
  country: { label: "Country", kind: "country", patch: "legal_address" },
  street_address_1: { label: "Address", kind: "text", patch: "legal_address" },
  street_address_2: {
    label: "Address Line 2 (optional)",
    kind: "text",
    patch: "legal_address",
  },
  city: { label: "City", kind: "text", patch: "legal_address" },
  state: { label: "State/Province", kind: "state", patch: "legal_address" },
  postal_code: { label: "Postal Code", kind: "text", patch: "legal_address" },
  year_of_birth: {
    label: "Year of Birth",
    kind: "year",
    patch: "user_profile",
  },
}

/**
 * Countries for which CyberSource requires a subdivision and postal code.
 *
 * Mirrors `_missing_bill_to_fields` in mitxonline's `compliance/api.py`, which
 * adds `administrative_area` and `postal_code` to the required set only for
 * these countries. We have to mirror the rule rather than read it off
 * `compliance_missing_fields`, because that list is computed from the country
 * *already stored* on the profile — a user with no country on file gets a list
 * with no state/postal in it, then picks "United States" in this dialog. If we
 * trusted the list verbatim they could submit an address that still fails the
 * export check.
 */
const SUBDIVISION_COUNTRIES = new Set(["US", "CA"])

const requiresSubdivision = (country: string | null | undefined): boolean =>
  SUBDIVISION_COUNTRIES.has((country ?? "").trim().toUpperCase())

/**
 * The postal-code field's label follows local terminology: US calls it a
 * "Zip Code", everywhere else (including Canada) calls it a "Postal Code".
 * The field itself is only shown for {@link SUBDIVISION_COUNTRIES}, so the
 * fallback here never actually renders — it exists so a label is always
 * defined rather than undefined mid-render while the country is unset.
 */
const postalCodeLabel = (country: string | null | undefined): string =>
  (country ?? "").trim().toUpperCase() === "US" ? "Zip Code" : "Postal Code"

type CountrySubdivision = { code: string; name: string }

/**
 * Subdivisions for a country, as `{ code, name }` where code is ISO-3166-2
 * (e.g. `US-MA`). The spec types `states` as an untyped object array
 * (`additionalProperties: {}`), so entries are narrowed rather than cast; the
 * array is empty for every country outside {@link SUBDIVISION_COUNTRIES}.
 *
 * The full ISO code is what we store — mitxonline's
 * `_normalize_administrative_area` strips the country prefix when building the
 * CyberSource payload.
 */
const subdivisionOptions = (
  country: Country | undefined,
): CountrySubdivision[] =>
  (country?.states ?? []).flatMap((state) =>
    typeof state.code === "string" && typeof state.name === "string"
      ? [{ code: state.code, name: state.name }]
      : [],
  )

/** MIT requires learners to be at least this old. */
const MINIMUM_AGE = 13

const EARLIEST_BIRTH_YEAR = 1900

/** Year options from the newest year satisfying {@link MINIMUM_AGE} back to 1900. */
const yearOfBirthOptions = (): string[] => {
  const maxYear = new Date().getFullYear() - MINIMUM_AGE
  return Array.from({ length: maxYear - EARLIEST_BIRTH_YEAR + 1 }, (_, i) =>
    (maxYear - i).toString(),
  )
}

/**
 * `compliance_missing_fields` entries this dialog can actually resolve.
 *
 * mitxonline flags `state`/`postal_code` as missing whenever they're empty,
 * for *every* country (mitodl/mitxonline#3850) — not just
 * {@link SUBDIVISION_COUNTRIES}, unlike the CyberSource check itself. The
 * dialog only collects those two fields for US/CA, so for anyone else they
 * can never be cleared. Counting them here would gate that entire population
 * on every enroll attempt, forever, with no field in the form to fix it —
 * so they're disregarded unless the stored country actually requires them.
 */
const relevantMissingFields = (user: User): string[] => {
  const missing = user.compliance_missing_fields ?? []
  if (requiresSubdivision(user.legal_address?.country)) return missing
  return missing.filter((field) => field !== "state" && field !== "postal_code")
}

/**
 * Whether the user must supply profile information before enrolling.
 *
 * Two independent reasons, either of which opens the dialog: MITx Online
 * reports missing export-compliance fields, or we have no year of birth for
 * the minimum-age requirement.
 */
const needsComplianceInfo = (user: User | undefined): boolean => {
  if (!user) return false
  return (
    relevantMissingFields(user).length > 0 || !user.user_profile?.year_of_birth
  )
}

/**
 * Seed the form from the profile we already have.
 *
 * Every field is prefilled, not just the ones reported missing, so a value
 * that is present but wrong can be corrected here — a field can also be
 * reported missing while holding a whitespace-only value, which the backend
 * treats as absent.
 */
const initialJitValues = (user: User | undefined): JitFormValues => {
  const address = user?.legal_address
  const yearOfBirth = user?.user_profile?.year_of_birth
  return {
    first_name: address?.first_name ?? "",
    last_name: address?.last_name ?? "",
    country: address?.country ?? "",
    street_address_1: address?.street_address_1 ?? "",
    street_address_2: address?.street_address_2 ?? "",
    city: address?.city ?? "",
    state: address?.state ?? "",
    postal_code: address?.postal_code ?? "",
    year_of_birth: yearOfBirth ? yearOfBirth.toString() : "",
  }
}

/** Fields export compliance requires regardless of country, plus year of birth. */
const ALWAYS_REQUIRED_FIELDS = [
  "first_name",
  "last_name",
  "country",
  "street_address_1",
  "city",
  "year_of_birth",
] as const satisfies readonly JitField[]

/** Fields required only for {@link SUBDIVISION_COUNTRIES}. */
const SUBDIVISION_REQUIRED_FIELDS = [
  "state",
  "postal_code",
] as const satisfies readonly JitField[]

/**
 * Whether a field is required given the currently *selected* country.
 *
 * Single source of truth: {@link jitSchema} validates against this, and the
 * dialog marks inputs `required` from it, so the two cannot drift.
 */
const isFieldRequired = (
  field: JitField,
  country: string | null | undefined,
): boolean => {
  if ((ALWAYS_REQUIRED_FIELDS as readonly string[]).includes(field)) return true
  return (
    (SUBDIVISION_REQUIRED_FIELDS as readonly string[]).includes(field) &&
    requiresSubdivision(country)
  )
}

/**
 * A string field whose required-ness is resolved from {@link isFieldRequired}
 * against the sibling `country` value.
 */
const requiredWhen = (field: JitField, message: string) =>
  Yup.string().when("country", {
    is: (country: string) => isFieldRequired(field, country),
    then: (schema) => schema.trim().required(message),
    otherwise: (schema) => schema.optional(),
  })

/**
 * Validation for the collected fields. `state` and `postal_code` become
 * required reactively based on the selected country, per
 * {@link SUBDIVISION_COUNTRIES}.
 *
 * `country` is declared directly rather than via {@link requiredWhen}: a
 * `when("country")` on `country` itself would be a cyclic dependency.
 */
const jitSchema = Yup.object().shape({
  first_name: requiredWhen("first_name", "First name is required"),
  last_name: requiredWhen("last_name", "Last name is required"),
  country: Yup.string().trim().required("Country is required"),
  street_address_1: requiredWhen("street_address_1", "Address is required"),
  street_address_2: Yup.string(),
  city: requiredWhen("city", "City is required"),
  state: requiredWhen("state", "State or province is required"),
  // Generic on purpose: the field's own label switches between "Zip Code"
  // (US) and "Postal Code" (CA), and this message has to read sensibly under
  // either without needing its own country-reactive lookup.
  postal_code: requiredWhen("postal_code", "ZIP/postal code is required"),
  year_of_birth: requiredWhen("year_of_birth", "Year of birth is required"),
})

/**
 * Build the `users/me` PATCH body.
 *
 * Because the dialog renders the whole address, we submit it whole rather
 * than diffing, which sidesteps partial-update semantics on the nested
 * serializer.
 *
 * `user_profile` is the exception: it is only included when `year_of_birth`
 * actually changed from `currentYearOfBirth`. mitxonline's `UserSerializer`
 * recomputes `addl_field_flag` from whatever keys are present in the
 * `user_profile` payload rather than the stored profile, so a PATCH
 * containing only `year_of_birth` unconditionally resets that flag to
 * `false` — sending the branch on every submit would silently clobber it for
 * any user who already had it set.
 */
const jitPatchPayload = (
  values: JitFormValues,
  currentYearOfBirth: number | null | undefined,
): PatchedUserRequest => {
  const legalAddress: LegalAddressRequest = {
    first_name: values.first_name.trim(),
    last_name: values.last_name.trim(),
    country: values.country,
    street_address_1: values.street_address_1.trim(),
    street_address_2: values.street_address_2.trim(),
    city: values.city.trim(),
    // A US state, or a postal code entered while the field was visible, is
    // meaningless under a country that has no subdivisions, so a
    // previously-stored value is dropped rather than carried over.
    state: requiresSubdivision(values.country) ? values.state : "",
    postal_code: requiresSubdivision(values.country)
      ? values.postal_code.trim()
      : "",
  }
  const yearOfBirth = Number.parseInt(values.year_of_birth, 10)
  const payload: PatchedUserRequest = { legal_address: legalAddress }
  if (yearOfBirth !== currentYearOfBirth) {
    payload.user_profile = { year_of_birth: yearOfBirth }
  }
  return payload
}

export {
  JIT_FIELDS,
  FIELD_SPECS,
  MINIMUM_AGE,
  requiresSubdivision,
  postalCodeLabel,
  subdivisionOptions,
  isFieldRequired,
  yearOfBirthOptions,
  needsComplianceInfo,
  initialJitValues,
  jitSchema,
  jitPatchPayload,
}
export type { JitField, JitFormValues }
