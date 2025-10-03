import React from "react"
import {
  Typography,
  styled,
  FormDialog,
  DialogActions,
  Stack,
  LoadingSpinner,
  SimpleSelectField,
} from "ol-components"
import { Button, Checkbox, Alert } from "@mitodl/smoot-design"
import { useQuery } from "@tanstack/react-query"

import NiceModal, { muiDialogV5 } from "@ebay/nice-modal-react"
import { useFormik } from "formik"
import {
  useDestroyEnrollment,
  useUpdateEnrollment,
} from "api/mitxonline-hooks/enrollment"
import { DashboardCourseEnrollment } from "./types"
import {
  mitxUserQueries,
  useUpdateUserMutation,
} from "api/mitxonline-hooks/user"
import * as Yup from "yup"

const BoldText = styled.span(({ theme }) => ({
  ...theme.typography.subtitle1,
}))

const SpinnerContainer = styled.div({
  marginLeft: "8px",
})

const SelectPlaceholder = styled("span")(({ theme }) => ({
  color: theme.custom.colors.silverGrayDark,
}))

type DashboardDialogProps = {
  title: string
  enrollment: DashboardCourseEnrollment
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
      receive_emails: enrollment.receiveEmails ?? true,
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
          >
            Save Settings
            {updateEnrollment.isPending && (
              <SpinnerContainer>
                <LoadingSpinner
                  loading={updateEnrollment.isPending}
                  size={16}
                />
              </SpinnerContainer>
            )}
          </Button>
        </DialogActions>
      }
    >
      <Stack direction="column" gap="24px">
        <Typography variant="body1">
          Update your email preferences for <BoldText>{title}.</BoldText>
        </Typography>
        <Alert severity="warning">
          <Typography variant="body2" color="textPrimary">
            Unchecking the box will prevent you from receiving important course
            updates and emails.
          </Typography>
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
          >
            Unenroll
            {destroyEnrollment.isPending && (
              <SpinnerContainer>
                <LoadingSpinner
                  loading={destroyEnrollment.isPending}
                  size={16}
                />
              </SpinnerContainer>
            )}
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

const JustInTimeDialogInner: React.FC<{ href: string }> = ({ href }) => {
  const { data: countries } = useQuery(mitxUserQueries.countries())
  const updateUserMutation = useUpdateUserMutation()
  const user = useQuery(mitxUserQueries.me())
  const modal = NiceModal.useModal()

  // Generate year options (minimum age 13, so current year - 13 back to 1900)
  const currentYear = new Date().getFullYear()
  const maxYear = currentYear - 13
  const yearOptions = Array.from(
    { length: maxYear - 1900 + 1 },
    (_, i) => maxYear - i,
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
      await updateUserMutation.mutateAsync({
        PatchedUserRequest: {
          user_profile: {
            year_of_birth: parseInt(values.year_of_birth, 10),
          },
          legal_address: {
            country: values.country,
          },
        },
      })
      if (!updateUserMutation.isError) {
        modal.hide()
        if (href) {
          window.location.href = href
        }
      }
    },
  })

  const renderSelectValue = (value: string | string[]) => {
    return value || <SelectPlaceholder>Please Select</SelectPlaceholder>
  }

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
          >
            Submit
            {formik.isSubmitting && (
              <SpinnerContainer>
                <LoadingSpinner loading={formik.isSubmitting} size={16} />
              </SpinnerContainer>
            )}
          </Button>
        </DialogActions>
      }
    >
      <Stack direction="column" gap="24px">
        <Typography variant="body1">
          We need a bit more info before you can enroll.
        </Typography>

        <SimpleSelectField
          options={[
            {
              value: "",
              label: "Please Select",
            },
          ].concat(
            countries
              ? countries.map((country) => ({
                  value: country.code,
                  label: country.name,
                }))
              : [],
          )}
          name="country"
          label="Country"
          value={formik.values.country}
          onChange={formik.handleChange}
          renderValue={renderSelectValue}
          fullWidth
          required
          error={!!formik.errors.country}
          errorText={formik.errors.country}
        />
        <SimpleSelectField
          options={[
            {
              value: "",
              label: "Please Select",
            },
          ].concat(
            yearOptions.map((year) => ({
              value: year.toString(),
              label: year.toString(),
            })),
          )}
          name="year_of_birth"
          label="Year of Birth"
          value={formik.values.year_of_birth}
          onChange={formik.handleChange}
          renderValue={renderSelectValue}
          fullWidth
          required
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
