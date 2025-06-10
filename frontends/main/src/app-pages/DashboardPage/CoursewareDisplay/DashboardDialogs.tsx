import React from "react"
import {
  Typography,
  styled,
  FormDialog,
  DialogActions,
  Stack,
} from "ol-components"
import { Button, Checkbox, Alert } from "@mitodl/smoot-design"

import NiceModal, { muiDialogV5 } from "@ebay/nice-modal-react"
import { useFormik } from "formik"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  enrollmentKeys,
  enrollmentMutations,
} from "api/mitxonline-hooks/enrollment"

const BoldText = styled.span(({ theme }) => ({
  ...theme.typography.subtitle1,
}))

type DashboardDialogProps = {
  title: string
  id: number
}
const EmailSettingsDialogInner: React.FC<DashboardDialogProps> = ({
  title,
}) => {
  const modal = NiceModal.useModal()
  const formik = useFormik({
    enableReinitialize: true,
    validateOnChange: false,
    validateOnBlur: false,
    initialValues: {
      recieve_emails: true,
    },
    onSubmit: async () => {
      // TODO: Handle form submission
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
          <Button variant="primary" type="submit" disabled={!formik.dirty}>
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
          <Typography variant="body2" color="textPrimary">
            Unchecking the box will prevent you from receiving important course
            updates and emails.
          </Typography>
        </Alert>
        <Checkbox
          name="recieve_emails"
          label="Receive course emails"
          checked={formik.values.recieve_emails}
          onChange={formik.handleChange}
        />
      </Stack>
    </FormDialog>
  )
}

const UnenrollDialogInner: React.FC<DashboardDialogProps> = ({ title, id }) => {
  const modal = NiceModal.useModal()
  const queryClient = useQueryClient()
  const { mutate, isSuccess } = useMutation(
    enrollmentMutations.destroyEnrollment(id),
  )
  const formik = useFormik({
    enableReinitialize: true,
    validateOnChange: false,
    validateOnBlur: false,
    initialValues: {},
    onSubmit: async () => {
      mutate()
      if (isSuccess) {
        queryClient.invalidateQueries({
          queryKey: enrollmentKeys.enrollmentsList(),
        })
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
          <Button variant="primary" type="submit">
            Unenroll
          </Button>
        </DialogActions>
      }
    >
      <Typography variant="body1">
        Are you sure you want to unenroll from {title}?
      </Typography>
    </FormDialog>
  )
}

const EmailSettingsDialog = NiceModal.create(EmailSettingsDialogInner)
const UnenrollDialog = NiceModal.create(UnenrollDialogInner)

export { EmailSettingsDialog, UnenrollDialog }
