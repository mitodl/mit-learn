import React from "react"
import {
  Typography,
  styled,
  FormDialog,
  DialogActions,
  Stack,
  LoadingSpinner,
} from "ol-components"
import { Button, Checkbox, Alert } from "@mitodl/smoot-design"

import NiceModal, { muiDialogV5 } from "@ebay/nice-modal-react"
import { useFormik } from "formik"
import {
  useDestroyEnrollment,
  useUpdateEnrollment,
} from "api/mitxonline-hooks/enrollment"
import { DashboardCourseEnrollment } from "./types"

const BoldText = styled.span(({ theme }) => ({
  ...theme.typography.subtitle1,
}))

const SpinnerContainer = styled.div({
  marginLeft: "8px",
})

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
      await updateEnrollment.mutateAsync()
      if (!updateEnrollment.isError) {
        modal.hide()
      }
    },
  })
  const updateEnrollment = useUpdateEnrollment({
    id: enrollment.id,
    PatchedUpdateCourseRunEnrollmentRequest: {
      receive_emails: formik.values.receive_emails,
    },
  })
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
  const destroyEnrollment = useDestroyEnrollment(enrollment.id)
  const formik = useFormik({
    enableReinitialize: true,
    validateOnChange: false,
    validateOnBlur: false,
    initialValues: {},
    onSubmit: async () => {
      await destroyEnrollment.mutateAsync()
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

const EmailSettingsDialog = NiceModal.create(EmailSettingsDialogInner)
const UnenrollDialog = NiceModal.create(UnenrollDialogInner)

export { EmailSettingsDialog, UnenrollDialog }
