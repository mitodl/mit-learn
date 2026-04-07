import React from "react"
import ReCAPTCHA from "react-google-recaptcha"
import styled from "@emotion/styled"
import { Button, Checkbox, TextField } from "@mitodl/smoot-design"
import { ReCaptcha } from "../ReCaptcha"
import { FormFieldWrapper } from "../FormHelpers/FormHelpers"
import { Radio } from "../Radio/Radio"
import { SimpleSelectField } from "../SimpleSelect/SimpleSelect"
import type {
  HubspotFieldType,
  HubspotFormDefinition,
  HubspotFormField,
  HubspotFormFieldGroupInput,
  HubspotFormFieldInput,
  HubspotFormInput,
  HubspotFormValue,
} from "./types"

const Form = styled.form({
  display: "flex",
  flexDirection: "column",
  gap: "20px",
})

const Actions = styled.div({
  display: "flex",
  gap: "8px",
  justifyContent: "flex-end",
})

const Group = styled.fieldset(({ theme }) => ({
  border: 0,
  margin: 0,
  padding: 0,
  minInlineSize: 0,
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  "& > legend": {
    ...theme.typography.subtitle2,
    color: theme.custom.colors.darkGray2,
    marginBottom: "8px",
  },
}))

const OptionList = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
})

const LoadingText = styled.p(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.custom.colors.silverGrayDark,
  margin: 0,
}))

type HubspotFormProps = {
  form?: HubspotFormInput
  onSubmit?: (
    values: Record<string, HubspotFormValue>,
    event: React.FormEvent<HTMLFormElement>,
    recaptchaToken?: string | null,
  ) => void | Promise<void>
  onValuesChange?: (values: Record<string, HubspotFormValue>) => void
  onRecaptchaChange?: (token: string | null) => void
  initialValues?: Record<string, HubspotFormValue>
  recaptchaEnabled?: boolean
  recaptchaSiteKey?: string
  submitLabel?: string
  isSubmitting?: boolean
  isLoading?: boolean
  disabled?: boolean
  className?: string
  hideSubmitButton?: boolean
  submitButton?: React.ReactNode
  actions?: React.ReactNode
}

const normalizeField = (
  field: HubspotFormFieldInput,
): HubspotFormField | null => {
  const name = field.name?.trim()
  const label = field.label?.trim()
  const fieldType = field.field_type

  if (!name || !label || !fieldType) {
    return null
  }

  return {
    name,
    label,
    field_type: fieldType,
    required: field.required ?? undefined,
    hidden: field.hidden ?? undefined,
    description: field.description ?? undefined,
    placeholder: field.placeholder ?? undefined,
    defaultValue: field.defaultValue ?? field.default_value,
    options: field.options
      ?.map((option) => {
        if (!option.value || !option.label) {
          return null
        }
        return {
          value: option.value,
          label: option.label,
          disabled: option.disabled ?? undefined,
        }
      })
      .filter((option): option is NonNullable<typeof option> =>
        Boolean(option),
      ),
  }
}

const normalizeGroup = (group: HubspotFormFieldGroupInput) => {
  return {
    name: group.name ?? undefined,
    fields:
      group.fields
        ?.map(normalizeField)
        .filter((field): field is HubspotFormField => Boolean(field)) || [],
  }
}

const normalizeForm = (form: HubspotFormInput): HubspotFormDefinition => {
  const groupsInput = form.fieldGroups ?? form.field_groups ?? []

  return {
    formId: form.formId ?? form.id ?? "",
    name: form.name ?? undefined,
    submitText: form.submitText ?? form.submit_text ?? undefined,
    recaptchaEnabled: form.configuration?.recaptcha_enabled ?? undefined,
    fieldGroups: groupsInput.map(normalizeGroup),
  }
}

const flattenFields = (
  definition: HubspotFormDefinition,
): HubspotFormField[] => {
  return definition.fieldGroups.flatMap((group) => group.fields)
}

const normalizeDefaultValue = (
  field: HubspotFormField,
  currentValue?: HubspotFormValue,
): HubspotFormValue => {
  if (currentValue !== undefined) {
    return currentValue
  }

  if (field.defaultValue !== undefined) {
    return field.defaultValue
  }

  if (field.field_type === "single_checkbox") {
    return false
  }

  if (field.field_type === "multiple_checkboxes") {
    return []
  }

  return ""
}

const buildInitialValues = (
  definition: HubspotFormDefinition,
  explicitValues?: Record<string, HubspotFormValue>,
): Record<string, HubspotFormValue> => {
  const values: Record<string, HubspotFormValue> = {}

  flattenFields(definition).forEach((field) => {
    values[field.name] = normalizeDefaultValue(
      field,
      explicitValues?.[field.name],
    )
  })

  return values
}

const inputTypeByFieldType: Partial<Record<HubspotFieldType, string>> = {
  datepicker: "date",
  email: "email",
  mobile_phone: "tel",
  number: "number",
  phone: "tel",
  single_line_text: "text",
}

const textInputFieldTypes = new Set<HubspotFieldType>([
  "single_line_text",
  "email",
  "phone",
  "mobile_phone",
  "number",
  "datepicker",
])

const radioFieldTypes = new Set<HubspotFieldType>([
  "radio",
  "payment_link_radio",
])

const HubspotField: React.FC<{
  field: HubspotFormField
  value: HubspotFormValue
  disabled?: boolean
  onChange: (name: string, value: HubspotFormValue) => void
}> = ({ field, value, disabled, onChange }) => {
  const commonTextProps = {
    name: field.name,
    label: field.label,
    required: field.required,
    helperText: field.description || undefined,
    placeholder: field.placeholder || undefined,
    disabled,
    fullWidth: true,
  }

  if (textInputFieldTypes.has(field.field_type)) {
    return (
      <TextField
        {...commonTextProps}
        type={inputTypeByFieldType[field.field_type] || "text"}
        value={typeof value === "string" ? value : ""}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
          onChange(field.name, event.target.value)
        }}
      />
    )
  }

  if (radioFieldTypes.has(field.field_type)) {
    return (
      <FormFieldWrapper
        label={field.label}
        required={field.required}
        helpText={field.description || undefined}
        fullWidth
      >
        {() => (
          <OptionList>
            {field.options?.map((option) => (
              <Radio
                key={`${field.name}-${option.value}`}
                name={field.name}
                value={option.value}
                checked={value === option.value}
                label={option.label}
                onChange={(event) => onChange(field.name, event.target.value)}
              />
            ))}
          </OptionList>
        )}
      </FormFieldWrapper>
    )
  }

  switch (field.field_type) {
    case "multi_line_text":
      return (
        <TextField
          {...commonTextProps}
          value={typeof value === "string" ? value : ""}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            onChange(field.name, event.target.value)
          }}
          multiline
          minRows={3}
        />
      )
    case "dropdown":
      return (
        <SimpleSelectField
          label={field.label}
          required={field.required}
          helpText={field.description || undefined}
          name={field.name}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(field.name, event.target.value)}
          options={
            field.options?.map((option) => ({
              value: option.value,
              label: option.label,
              disabled: option.disabled,
            })) || []
          }
          fullWidth
        />
      )
    case "single_checkbox":
      return (
        <Checkbox
          name={field.name}
          label={field.label}
          checked={Boolean(value)}
          disabled={disabled}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            onChange(field.name, event.target.checked)
          }}
        />
      )
    case "multiple_checkboxes": {
      const checkedValues = Array.isArray(value) ? value : []

      return (
        <FormFieldWrapper
          label={field.label}
          required={field.required}
          helpText={field.description || undefined}
          fullWidth
        >
          {() => (
            <OptionList>
              {field.options?.map((option) => {
                const checked = checkedValues.includes(option.value)

                return (
                  <Checkbox
                    key={`${field.name}-${option.value}`}
                    name={field.name}
                    label={option.label}
                    value={option.value}
                    checked={checked}
                    disabled={disabled || option.disabled}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                      const nextValues = event.target.checked
                        ? [...checkedValues, option.value]
                        : checkedValues.filter(
                            (current) => current !== option.value,
                          )
                      onChange(field.name, nextValues)
                    }}
                  />
                )
              })}
            </OptionList>
          )}
        </FormFieldWrapper>
      )
    }
    case "file":
      return (
        <FormFieldWrapper
          label={field.label}
          required={field.required}
          helpText={field.description || undefined}
          fullWidth
        >
          {(childProps) => (
            <input
              {...childProps}
              type="file"
              name={field.name}
              disabled={disabled}
              onChange={(event) => {
                onChange(field.name, event.target.files?.[0] ?? null)
              }}
            />
          )}
        </FormFieldWrapper>
      )
    default:
      return (
        <TextField
          {...commonTextProps}
          value={typeof value === "string" ? value : ""}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            onChange(field.name, event.target.value)
          }}
        />
      )
  }
}

const HubspotForm = React.forwardRef<HTMLFormElement, HubspotFormProps>(
  function HubspotForm(
    {
      form,
      onSubmit,
      onValuesChange,
      onRecaptchaChange,
      initialValues,
      recaptchaEnabled,
      recaptchaSiteKey,
      submitLabel = "Submit",
      isSubmitting = false,
      isLoading = false,
      disabled = false,
      className,
      hideSubmitButton = false,
      submitButton,
      actions,
    },
    ref,
  ) {
    const [resolvedForm, setResolvedForm] =
      React.useState<HubspotFormDefinition | null>(
        form ? normalizeForm(form) : null,
      )
    const [values, setValues] = React.useState<
      Record<string, HubspotFormValue>
    >({})
    const [recaptchaToken, setRecaptchaToken] = React.useState<string | null>(
      null,
    )
    const [recaptchaError, setRecaptchaError] = React.useState<string | null>(
      null,
    )
    const recaptchaRef = React.useRef<ReCAPTCHA>(null)

    React.useEffect(() => {
      setResolvedForm(form ? normalizeForm(form) : null)
    }, [form])

    React.useEffect(() => {
      if (!resolvedForm) {
        return
      }
      const nextValues = buildInitialValues(resolvedForm, initialValues)
      setValues(nextValues)
      onValuesChange?.(nextValues)
    }, [initialValues, onValuesChange, resolvedForm])

    const handleChange = React.useCallback(
      (name: string, nextValue: HubspotFormValue) => {
        setValues((prevValues) => {
          const nextValues = { ...prevValues, [name]: nextValue }
          onValuesChange?.(nextValues)
          return nextValues
        })
      },
      [onValuesChange],
    )

    const handleRecaptchaChange = React.useCallback(
      (token: string | null) => {
        setRecaptchaToken(token)
        if (token) {
          setRecaptchaError(null)
        }
        onRecaptchaChange?.(token)
      },
      [onRecaptchaChange],
    )

    const shouldRenderRecaptcha =
      recaptchaEnabled ?? resolvedForm?.recaptchaEnabled ?? false

    const handleSubmit = React.useCallback(
      async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        if (shouldRenderRecaptcha && !recaptchaToken) {
          setRecaptchaError("Complete the reCAPTCHA before submitting.")
          return
        }

        await onSubmit?.(values, event, recaptchaToken)
      },
      [onSubmit, recaptchaToken, shouldRenderRecaptcha, values],
    )

    if (!resolvedForm) {
      return null
    }

    const defaultSubmitButton = hideSubmitButton ? null : (
      <Button type="submit" disabled={disabled || isSubmitting}>
        {submitLabel}
      </Button>
    )

    const resolvedSubmitButton =
      submitButton === undefined ? defaultSubmitButton : submitButton

    return (
      <Form ref={ref} className={className} onSubmit={handleSubmit}>
        {isLoading ? <LoadingText>Loading form...</LoadingText> : null}
        {resolvedForm.fieldGroups.map((group, groupIndex) => (
          <Group key={`${group.name || "group"}-${groupIndex}`}>
            {group.name ? <legend>{group.name}</legend> : null}
            {group.fields
              .filter((field) => !field.hidden)
              .map((field) => (
                <HubspotField
                  key={field.name}
                  field={field}
                  value={values[field.name]}
                  disabled={disabled || isSubmitting}
                  onChange={handleChange}
                />
              ))}
          </Group>
        ))}
        {shouldRenderRecaptcha && (
          <ReCaptcha
            ref={recaptchaRef}
            siteKey={
              recaptchaSiteKey ?? process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY
            }
            onChange={handleRecaptchaChange}
            onExpired={() => {
              setRecaptchaToken(null)
              setRecaptchaError("Complete the reCAPTCHA before submitting.")
              recaptchaRef.current?.reset()
            }}
            disabled={disabled || isSubmitting}
            error={Boolean(recaptchaError)}
            helperText={recaptchaError ?? undefined}
          />
        )}
        {actions || resolvedSubmitButton ? (
          <Actions>
            {actions}
            {resolvedSubmitButton}
          </Actions>
        ) : null}
      </Form>
    )
  },
)

export { HubspotForm, buildInitialValues }
export type { HubspotFormProps }
