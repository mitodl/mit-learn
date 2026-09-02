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
  useDestroyProgramEnrollment,
  useUpdateEnrollment,
} from "api/mitxonline-hooks/enrollment"
import { SILENCE_ERROR_TOAST } from "api/mutation-meta"
import { CourseRunEnrollmentV3 } from "@mitodl/mitxonline-api-axios/v2"
import {
  trackCourseUnenrolled,
  trackProgramUnenrolled,
} from "@/common/analytics/gtm"
import { formatRunDateRange } from "./courseDateUtils"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { FeatureFlags } from "@/common/feature_flags"

const BoldText = styled.span(({ theme }) => ({
  ...theme.typography.subtitle1,
}))

/**
 * The run being acted on, or null when it should not be named. A learner
 * enrolled in several runs of one course reaches these dialogs from a specific
 * row, and the course title alone can't tell them whether the row they clicked
 * was the one they meant.
 *
 * Behind the same flag as the per-run row menus, so turning the flag off
 * restores the previous dialogs exactly rather than leaving new copy behind.
 * Null for a run with no dates, rather than an empty label.
 */
const useRunDateRange = (enrollment: CourseRunEnrollmentV3): string | null => {
  const enabled = useFeatureFlagEnabled(FeatureFlags.MultipleRunContextMenus)
  const dateRange = formatRunDateRange(
    enrollment.run?.start_date,
    enrollment.run?.end_date,
  )
  return enabled && dateRange ? dateRange : null
}

/**
 * Names the run in the dialog body, and is pulled into the dialog's accessible
 * name via `additionalLabelledBy`.
 *
 * Verified with Orca: it announces a dialog's accessible name on open and
 * nothing else — not the body copy, and not a container-level
 * `aria-describedby`. So this line has to join the name to be spoken at all,
 * while the heading itself stays short.
 */
const RunLabel: React.FC<{ id: string; dateRange: string }> = ({
  id,
  dateRange,
}) => (
  <Typography id={id} variant="body1">
    Course run: <BoldText>{dateRange}</BoldText>
  </Typography>
)

type DashboardDialogProps = {
  title: string
  enrollment: CourseRunEnrollmentV3
}
const EmailSettingsDialogInner: React.FC<DashboardDialogProps> = ({
  title,
  enrollment,
}) => {
  const modal = NiceModal.useModal()
  const runDateRange = useRunDateRange(enrollment)
  const runLabelId = React.useId()
  const formik = useFormik({
    enableReinitialize: true,
    validateOnChange: false,
    validateOnBlur: false,
    initialValues: {
      receive_emails: enrollment.edx_emails_subscription ?? true,
    },
    onSubmit: () => {
      updateEnrollment.mutate(
        {
          id: enrollment.id,
          PatchedUpdateCourseRunEnrollmentRequest: {
            receive_emails: formik.values.receive_emails,
          },
        },
        { onSuccess: () => modal.hide() },
      )
    },
  })
  // Renders its own inline error below (updateEnrollment.isError), so suppress
  // the global error toast.
  const updateEnrollment = useUpdateEnrollment({ meta: SILENCE_ERROR_TOAST })
  return (
    <FormDialog
      title="Email Settings"
      fullWidth
      additionalLabelledBy={runDateRange ? runLabelId : undefined}
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
        {runDateRange && <RunLabel id={runLabelId} dateRange={runDateRange} />}
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
  const runDateRange = useRunDateRange(enrollment)
  const runLabelId = React.useId()
  // Renders its own inline error below (destroyEnrollment.isError), so suppress
  // the global error toast.
  const destroyEnrollment = useDestroyEnrollment({ meta: SILENCE_ERROR_TOAST })
  const formik = useFormik({
    enableReinitialize: true,
    validateOnChange: false,
    validateOnBlur: false,
    initialValues: {},
    onSubmit: () => {
      destroyEnrollment.mutate(enrollment.id, {
        onSuccess: () => {
          trackCourseUnenrolled(title)
          modal.hide()
        },
      })
    },
  })
  return (
    <FormDialog
      title={`Unenroll from ${title}`}
      fullWidth
      additionalLabelledBy={runDateRange ? runLabelId : undefined}
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
      <Stack direction="column" gap="16px">
        <Typography variant="body1">
          Are you sure you want to unenroll from {title}?
        </Typography>
        {runDateRange && <RunLabel id={runLabelId} dateRange={runDateRange} />}
        {destroyEnrollment.isError && (
          <Alert severity="error">
            There was a problem unenrolling you from this course. Please try
            again later.
          </Alert>
        )}
      </Stack>
    </FormDialog>
  )
}

const EmailSettingsDialog = NiceModal.create(EmailSettingsDialogInner)
const UnenrollDialog = NiceModal.create(UnenrollDialogInner)

type UnenrollProgramDialogProps = {
  title: string
  programId: number
}

const UnenrollProgramDialogInner: React.FC<UnenrollProgramDialogProps> = ({
  title,
  programId,
}) => {
  const modal = NiceModal.useModal()
  // Renders its own inline error below (destroyProgramEnrollment.isError), so
  // suppress the global error toast.
  const destroyProgramEnrollment = useDestroyProgramEnrollment({
    meta: SILENCE_ERROR_TOAST,
  })
  const formik = useFormik({
    enableReinitialize: true,
    validateOnChange: false,
    validateOnBlur: false,
    initialValues: {},
    onSubmit: () => {
      destroyProgramEnrollment.mutate(programId, {
        onSuccess: () => {
          trackProgramUnenrolled(title)
          modal.hide()
        },
      })
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
            disabled={destroyProgramEnrollment.isPending}
            endIcon={
              destroyProgramEnrollment.isPending ? (
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
      {destroyProgramEnrollment.isError && (
        <Alert severity="error">
          There was a problem unenrolling you from this program. Please try
          again later.
        </Alert>
      )}
    </FormDialog>
  )
}

const UnenrollProgramDialog = NiceModal.create(UnenrollProgramDialogInner)

export { EmailSettingsDialog, UnenrollDialog, UnenrollProgramDialog }
