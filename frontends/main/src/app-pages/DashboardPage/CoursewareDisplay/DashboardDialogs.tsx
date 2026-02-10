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
} from "ol-components"
import { Button, Checkbox, Alert } from "@mitodl/smoot-design"
import { useQuery } from "@tanstack/react-query"

import NiceModal, { muiDialogV5 } from "@ebay/nice-modal-react"
import { useFormik } from "formik"
import {
  useCreateB2bEnrollment,
  useDestroyEnrollment,
  useUpdateEnrollment,
} from "api/mitxonline-hooks/enrollment"
import {
  mitxUserQueries,
  useUpdateUserMutation,
} from "api/mitxonline-hooks/user"
import * as Yup from "yup"
import { CourseRunEnrollmentRequestV2 } from "@mitodl/mitxonline-api-axios/v2"

const BoldText = styled.span(({ theme }) => ({
  ...theme.typography.subtitle1,
}))

const SelectPlaceholder = styled("span")(({ theme }) => ({
  color: theme.custom.colors.silverGrayDark,
}))

type DashboardDialogProps = {
  title: string
  enrollment: CourseRunEnrollmentRequestV2
}
const EmailSettingsDialogInner: React.FC<DashboardDialogProps> = ({
  title,
  enrollment,
}) => {
  const modal = NiceModal.useModal()
  const formik = useFormik({
    enableReinitialize: true,
    validateOnChange: false,
    validateOnBlur: false,
    initialValues: {
      receive_emails: enrollment.edx_emails_subscription ?? true,
    },
    onSubmit: async () => {
      await updateEnrollment.mutateAsync({
        id: enrollment.id,
        PatchedUpdateCourseRunEnrollmentRequest: {
          receive_emails: formik.values.receive_emails,
        },
      })
      if (!updateEnrollment.isError) {
        modal.hide()
      }
    },
  })
  const updateEnrollment = useUpdateEnrollment()
  return (
    <FormDialog
      title={"Email Settings"}
      fullWidth
      onReset={formik.resetForm}
      onSubmit={formik.handleSubmit}
      {...muiDialogV5(modal)}
      actions={
        <DialogActions>
          <Button
            variant="secondary"
            onClick={() => {
              modal.hide()
            }}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            disabled={!formik.dirty || updateEnrollment.isPending}
            endIcon={
              updateEnrollment.isPending ? (
                <LoadingSpinner color="inherit" loading={true} size={16} />
              ) : undefined
            }
          >
            Save Settings
          </Button>
        </DialogActions>
      }
    >
      <Stack direction="column" gap="24px">
        <Typography variant="body1">
          Update your email preferences for <BoldText>{title}.</BoldText>
        </Typography>
        <Alert severity="warning">
          Unchecking the box will prevent you from receiving important course
          updates and emails.
        </Alert>
        <Checkbox
          name="receive_emails"
          label="Receive course emails"
          checked={formik.values.receive_emails}
          onChange={formik.handleChange}
        />
        {updateEnrollment.isError && (
          <Alert severity="error">
            There was a problem updating your email settings. Please try again
            later.
          </Alert>
        )}
      </Stack>
    </FormDialog>
  )
}

const UnenrollDialogInner: React.FC<DashboardDialogProps> = ({
  title,
  enrollment,
}) => {
  const modal = NiceModal.useModal()
  const destroyEnrollment = useDestroyEnrollment()
  const formik = useFormik({
    enableReinitialize: true,
    validateOnChange: false,
    validateOnBlur: false,
    initialValues: {},
    onSubmit: async () => {
      await destroyEnrollment.mutateAsync(enrollment.id)
      if (!destroyEnrollment.isError) {
        modal.hide()
      }
    },
  })
  return (
    <FormDialog
      title={`Unenroll from ${title}`}
      fullWidth
      onReset={formik.resetForm}
      onSubmit={formik.handleSubmit}
      {...muiDialogV5(modal)}
      actions={
        <DialogActions>
          <Button
            variant="secondary"
            onClick={() => {
              modal.hide()
            }}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            disabled={destroyEnrollment.isPending}
            endIcon={
              destroyEnrollment.isPending ? (
                <LoadingSpinner color="inherit" loading={true} size={16} />
              ) : undefined
            }
          >
            Unenroll
          </Button>
        </DialogActions>
      }
    >
      <Typography variant="body1">
        Are you sure you want to unenroll from {title}?
      </Typography>
      {destroyEnrollment.isError && (
        <Alert severity="error">
          There was a problem unenrolling you from this course. Please try again
          later.
        </Alert>
      )}
    </FormDialog>
  )
}

const jitSchema = Yup.object().shape({
  country: Yup.string().required("Country is required"),
  year_of_birth: Yup.string().required("Year of birth is required"),
})

const JustInTimeDialogInner: React.FC<{ href: string; readableId: string }> = ({
  href,
  readableId,
}) => {
  const { data: countries } = useQuery(mitxUserQueries.countries())
  const updateUser = useUpdateUserMutation()
  const createEnrollment = useCreateB2bEnrollment()
  const user = useQuery(mitxUserQueries.me())
  const modal = NiceModal.useModal()

  // Generate year options (minimum age 13, so current year - 13 back to 1900)
  const currentYear = new Date().getFullYear()
  const maxYear = currentYear - 13
  const years = Array.from({ length: maxYear - 1900 + 1 }, (_, i) =>
    (maxYear - i).toString(),
  )

  const yob = user?.data?.user_profile?.year_of_birth

  const formik = useFormik({
    enableReinitialize: true,
    validateOnChange: false,
    validateOnBlur: false,
    initialValues: {
      country: user?.data?.legal_address?.country || "",
      year_of_birth: yob ? yob.toString() : "",
    },
    validationSchema: jitSchema,
    onSubmit: async (values) => {
      await updateUser.mutateAsync({
        PatchedUserRequest: {
          user_profile: {
            year_of_birth: parseInt(values.year_of_birth, 10),
          },
          legal_address: {
            country: values.country,
          },
        },
      })
      await createEnrollment.mutateAsync({
        readable_id: readableId,
      })
      window.location.assign(href)
      modal.hide()
    },
  })
  const countryOptions: SimpleSelectOption[] = [
    { value: "", label: "Please Select", disabled: true },
    ...(countries?.map(({ code, name }) => ({ value: code, label: name })) ??
      []),
  ]
  const yobOptions: SimpleSelectOption[] = [
    { value: "", label: "Please Select", disabled: true },
    ...years.map((year): SimpleSelectOption => ({ value: year, label: year })),
  ]

  return (
    <FormDialog
      noValidate
      title="Just a Few More Details"
      fullWidth
      onReset={formik.resetForm}
      onSubmit={formik.handleSubmit}
      {...muiDialogV5(modal)}
      actions={
        <DialogActions>
          <Button variant="secondary" onClick={modal.hide}>
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
      <Stack direction="column" gap="24px">
        <Typography variant="body1">
          We need a bit more info before you can enroll.
        </Typography>

        <SimpleSelectField
          options={countryOptions}
          name="country"
          label="Country"
          value={countries ? formik.values.country : ""}
          onChange={formik.handleChange}
          fullWidth
          required
          renderValue={
            formik.values.country
              ? undefined
              : () => <SelectPlaceholder>Please Select</SelectPlaceholder>
          }
          error={!!formik.errors.country}
          errorText={formik.errors.country}
        />
        <SimpleSelectField
          options={yobOptions}
          name="year_of_birth"
          label="Year of Birth"
          value={formik.values.year_of_birth}
          onChange={formik.handleChange}
          fullWidth
          required
          renderValue={
            formik.values.year_of_birth
              ? undefined
              : () => <SelectPlaceholder>Please Select</SelectPlaceholder>
          }
          error={!!formik.errors.year_of_birth}
          errorText={formik.errors.year_of_birth}
        />
      </Stack>
    </FormDialog>
  )
}

const EmailSettingsDialog = NiceModal.create(EmailSettingsDialogInner)
const UnenrollDialog = NiceModal.create(UnenrollDialogInner)
const JustInTimeDialog = NiceModal.create(JustInTimeDialogInner)

export { EmailSettingsDialog, UnenrollDialog, JustInTimeDialog }
