import React from "react"
import {
  Typography,
  styled,
  FormDialog,
  DialogActions,
  Stack,
  LoadingSpinner,
  SimpleSelectField,
  SimpleSelectOption,
  SelectChangeEvent,
} from "ol-components"
import { Alert, Button, TextField, VisuallyHidden } from "@mitodl/smoot-design"
import { useQuery } from "@tanstack/react-query"
import NiceModal, { muiDialogV5 } from "@ebay/nice-modal-react"
import { useFormik } from "formik"
import {
  mitxUserQueries,
  useUpdateUserMutation,
} from "api/mitxonline-hooks/user"
import { SILENCE_ERROR_TOAST } from "api/mutation-meta"
import {
  FIELD_SPECS,
  JIT_FIELDS,
  initialJitValues,
  isFieldRequired,
  jitPatchPayload,
  jitSchema,
  postalCodeLabel,
  requiresSubdivision,
  subdivisionOptions,
  yearOfBirthOptions,
} from "./complianceFields"
import type { JitField } from "./complianceFields"

const SelectPlaceholder = styled("span")(({ theme }) => ({
  color: theme.custom.colors.silverGrayDark,
}))

const PLACEHOLDER_LABEL = "Please Select"

const placeholderOption: SimpleSelectOption = {
  value: "",
  label: PLACEHOLDER_LABEL,
  disabled: true,
}

/**
 * Focusable control within a field wrapper. A `SimpleSelectField` renders a
 * `role="combobox"` element alongside an `aria-hidden` native input carrying
 * the name, so the hidden input is skipped.
 */
const FOCUSABLE_CONTROL = '[role="combobox"], input:not([aria-hidden="true"])'

/**
 * Collects the profile information MITx Online needs before an enrollment or
 * checkout can proceed: the export-compliance (OFAC) fields it reports via
 * `compliance_missing_fields`, plus the year of birth backing MIT's
 * minimum-age requirement.
 *
 * Every field is rendered and prefilled from the existing profile, not just the
 * ones reported missing, so a value that is present but incorrect can be
 * corrected here.
 *
 * Resolves `true` once the profile has been saved and `false` if the user backs
 * out, so callers can continue or abandon the action that triggered it. This
 * dialog only updates the profile — it does not enroll.
 */
const JustInTimeDialogInner: React.FC = () => {
  const modal = NiceModal.useModal()
  const user = useQuery(mitxUserQueries.me())
  const countries = useQuery(mitxUserQueries.countries())
  // Failures are surfaced by the inline error alert below (driven by
  // `updateUser.isError`), so opt out of the global error toast to avoid a
  // double alert. The caught `mutateAsync` rejection does not suppress the
  // cache-level `onError`, so this opt-out is what prevents it.
  const updateUser = useUpdateUserMutation({ meta: SILENCE_ERROR_TOAST })
  const fieldsRef = React.useRef<HTMLDivElement>(null)
  const [subdivisionNotice, setSubdivisionNotice] = React.useState("")

  const formik = useFormik({
    enableReinitialize: true,
    validateOnChange: false,
    validateOnBlur: false,
    initialValues: initialJitValues(user.data),
    validationSchema: jitSchema,
    onSubmit: async (values) => {
      try {
        await updateUser.mutateAsync({
          PatchedUserRequest: jitPatchPayload(
            values,
            user.data?.user_profile?.year_of_birth,
          ),
        })
      } catch {
        // Keep the dialog open so the entered values survive; the error alert
        // below is driven by updateUser.isError.
        return
      }
      modal.resolve(true)
      modal.hide()
    },
  })

  // Move focus to the first field that failed validation. Errors only change on
  // submit (validateOnChange/Blur are off), so this cannot steal focus mid-typing.
  const { submitCount, errors } = formik
  const focusedSubmitCount = React.useRef(0)
  React.useEffect(() => {
    if (submitCount === focusedSubmitCount.current) return
    const firstInvalid = JIT_FIELDS.find((field) => errors[field])
    if (!firstInvalid) return
    focusedSubmitCount.current = submitCount
    fieldsRef.current
      ?.querySelector(`[data-jit-field="${firstInvalid}"]`)
      ?.querySelector<HTMLElement>(FOCUSABLE_CONTROL)
      ?.focus()
  }, [submitCount, errors])

  const selectedCountry = countries.data?.find(
    ({ code }) => code === formik.values.country,
  )
  const showSubdivision = requiresSubdivision(formik.values.country)

  const handleClose = () => {
    // A save in flight must run to completion: closing mid-submit would
    // resolve this modal `false` while `onSubmit` could still land and
    // resolve/hide it again, letting a cancelled action's caller and a
    // just-completed save race for the final outcome.
    if (formik.isSubmitting) return
    modal.resolve(false)
    modal.hide()
  }

  const handleCountryChange = (event: SelectChangeEvent<string>) => {
    const nextCountry = event.target.value
    formik.setFieldValue("country", nextCountry)
    // A subdivision code (and, similarly, a postal/zip code) is only ever
    // meaningful under the country it was entered for -- e.g. "US-MA" isn't
    // an option in Canada's province list. Clearing both unconditionally,
    // before branching below, avoids a stale value surviving a switch
    // between two countries that both require them (US -> CA), which would
    // otherwise leave the state select holding a value absent from its own
    // options.
    formik.setFieldValue("state", "")
    formik.setFieldValue("postal_code", "")
    const nextName = countries.data?.find(
      ({ code }) => code === nextCountry,
    )?.name
    if (requiresSubdivision(nextCountry)) {
      // State and postal code appear (or become required) as a result of this
      // change, so announce it rather than inserting fields silently.
      setSubdivisionNotice(
        `${FIELD_SPECS.state.label} and ${postalCodeLabel(nextCountry)} are required for ${nextName ?? "this country"}.`,
      )
    } else {
      setSubdivisionNotice("")
    }
  }

  const renderField = (field: JitField) => {
    const spec = FIELD_SPECS[field]

    const name = field
    const value = formik.values[name]
    const shared = {
      name,
      label:
        name === "postal_code"
          ? postalCodeLabel(formik.values.country)
          : spec.label,
      required: isFieldRequired(name, formik.values.country),
      error: !!errors[name],
      errorText: errors[name],
      fullWidth: true,
    }

    if (spec.kind === "text") {
      return (
        <TextField {...shared} value={value} onChange={formik.handleChange} />
      )
    }

    // The remaining kinds are selects. `renderValue` supplies the greyed
    // placeholder that a disabled first option cannot render on its own.
    const options: SimpleSelectOption[] =
      spec.kind === "country"
        ? [
            placeholderOption,
            ...(countries.data?.map(({ code, name: label }) => ({
              value: code,
              label,
            })) ?? []),
          ]
        : spec.kind === "state"
          ? [
              placeholderOption,
              ...subdivisionOptions(selectedCountry).map(
                ({ code, name: label }) => ({ value: code, label }),
              ),
            ]
          : [
              placeholderOption,
              ...yearOfBirthOptions().map((year) => ({
                value: year,
                label: year,
              })),
            ]

    return (
      <SimpleSelectField
        {...shared}
        options={options}
        // Until the countries have loaded, MUI would warn about a value that
        // is not among the options — country's own list is empty, and so is
        // state's (it's derived from the matched country's subdivisions).
        value={
          (spec.kind === "country" || spec.kind === "state") && !countries.data
            ? ""
            : value
        }
        onChange={
          spec.kind === "country" ? handleCountryChange : formik.handleChange
        }
        renderValue={
          value
            ? undefined
            : () => <SelectPlaceholder>{PLACEHOLDER_LABEL}</SelectPlaceholder>
        }
      />
    )
  }

  const visibleFields = JIT_FIELDS.filter(
    (field) =>
      (field !== "state" && field !== "postal_code") || showSubdivision,
  )

  return (
    <FormDialog
      noValidate
      title="Just a Few More Details"
      fullWidth
      onReset={formik.resetForm}
      onSubmit={formik.handleSubmit}
      {...muiDialogV5(modal)}
      onClose={handleClose}
      actions={
        <DialogActions>
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={formik.isSubmitting}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            disabled={formik.isSubmitting}
            endIcon={
              formik.isSubmitting ? (
                <LoadingSpinner color="inherit" loading={true} size={16} />
              ) : undefined
            }
          >
            Submit
          </Button>
        </DialogActions>
      }
    >
      <Stack direction="column" gap="24px" ref={fieldsRef}>
        <Typography variant="body1">
          We need a bit more info before you can enroll.
        </Typography>
        {visibleFields.map((field) => (
          <div key={field} data-jit-field={field}>
            {renderField(field)}
          </div>
        ))}
        <VisuallyHidden aria-live="polite" aria-atomic="true">
          {subdivisionNotice}
        </VisuallyHidden>
        {updateUser.isError && (
          <Alert severity="error">
            There was a problem saving your details. Please try again later.
          </Alert>
        )}
      </Stack>
    </FormDialog>
  )
}

const JustInTimeDialog = NiceModal.create(JustInTimeDialogInner)

export { JustInTimeDialog }
