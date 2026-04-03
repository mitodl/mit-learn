export const HUBSPOT_KNOWN_FIELD_TYPES = [
  "datepicker",
  "dropdown",
  "email",
  "file",
  "mobile_phone",
  "multi_line_text",
  "multiple_checkboxes",
  "number",
  "payment_link_radio",
  "phone",
  "radio",
  "single_checkbox",
  "single_line_text",
] as const

type HubspotKnownFieldType = (typeof HUBSPOT_KNOWN_FIELD_TYPES)[number]

/**
 * `string & {}` preserves autocomplete for known values while still allowing
 * forward compatibility if HubSpot introduces new field types.
 */
type HubspotFieldType = HubspotKnownFieldType | (string & {})

type HubspotFormValue = string | boolean | string[] | File | null

interface HubspotFormOption {
  value: string
  label: string
  disabled?: boolean
}

interface HubspotFormOptionInput {
  value?: string | null
  label?: string | null
  disabled?: boolean | null
}

interface HubspotFormField {
  name: string
  label: string
  field_type: HubspotFieldType
  required?: boolean
  hidden?: boolean
  description?: string | null
  placeholder?: string | null
  defaultValue?: HubspotFormValue
  options?: HubspotFormOption[]
}

interface HubspotFormFieldInput {
  name?: string | null
  label?: string | null
  field_type?: HubspotFieldType | null
  required?: boolean | null
  hidden?: boolean | null
  description?: string | null
  placeholder?: string | null
  defaultValue?: HubspotFormValue
  default_value?: HubspotFormValue
  options?: HubspotFormOptionInput[]
}

interface HubspotFormFieldGroup {
  name?: string
  fields: HubspotFormField[]
}

interface HubspotFormFieldGroupInput {
  name?: string | null
  fields?: HubspotFormFieldInput[] | null
}

interface HubspotFormDefinition {
  formId: string
  name?: string
  submitText?: string
  recaptchaEnabled?: boolean
  fieldGroups: HubspotFormFieldGroup[]
}

interface HubspotFormInputConfiguration {
  recaptcha_enabled?: boolean | null
}

interface HubspotFormInput {
  id?: string | null
  formId?: string | null
  name?: string | null
  submitText?: string | null
  submit_text?: string | null
  configuration?: HubspotFormInputConfiguration | null
  fieldGroups?: HubspotFormFieldGroupInput[] | null
  field_groups?: HubspotFormFieldGroupInput[] | null
}

export type {
  HubspotKnownFieldType,
  HubspotFieldType,
  HubspotFormValue,
  HubspotFormOption,
  HubspotFormOptionInput,
  HubspotFormField,
  HubspotFormFieldInput,
  HubspotFormFieldGroup,
  HubspotFormFieldGroupInput,
  HubspotFormDefinition,
  HubspotFormInput,
  HubspotFormInputConfiguration,
}
