import React from "react"
import {
  ChoiceBox,
  DialogActions,
  FormDialog,
  LoadingSpinner,
  SimpleSelectField,
  SimpleSelectOption,
  Stack,
  Typography,
  styled,
} from "ol-components"
import { Alert, Button } from "@mitodl/smoot-design"
import NiceModal, { muiDialogV5 } from "@ebay/nice-modal-react"
import { RiInformationFill } from "@remixicon/react"
import type { CourseWithCourseRunsSerializerV2 } from "@mitodl/mitxonline-api-axios/v2"
import type { BaseCourseRun } from "@mitodl/mitxonline-api-axios/v3"
import { formatDate, LocalDate } from "ol-utilities"
import {
  useCreateEnrollment,
  useCreateVerifiedProgramEnrollment,
} from "api/mitxonline-hooks/enrollment"
import { SILENCE_ERROR_TOAST } from "api/mutation-meta"
import { badRequestDetail } from "api/mutation-errors"
import { useComplianceGate } from "@/common/mitxonline/useComplianceGate"
import ErrorMessageWithSupport from "@/components/ErrorMessageWithSupport/ErrorMessageWithSupport"
import { analytics } from "@/common/analytics"

const RunSelectField = styled(SimpleSelectField)(({ theme }) => ({
  "&&& label": {
    ...theme.typography.subtitle2,
    marginBottom: "8px",
  },
})) as typeof SimpleSelectField

const Content = styled(Stack)(({ theme }) => ({
  color: theme.custom.colors.darkGray2,
}))

const Question = styled(Stack)({
  gap: "4px",
})

const QuestionHint = styled.span(({ theme }) => ({
  ...theme.typography.body3,
  color: theme.custom.colors.silverGrayDark,
}))

const ModeLine = styled.span({
  fontStyle: "italic",
  strong: {
    fontWeight: "inherit",
  },
})

const Note = styled.div(({ theme }) => ({
  ...theme.typography.body3,
  display: "flex",
  alignItems: "flex-start",
  gap: "8px",
  padding: "8px 12px",
  borderRadius: "4px",
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  background: theme.custom.colors.lightGray1,
  marginTop: "4px",
  color: theme.custom.colors.darkGray2,
  svg: {
    flexShrink: 0,
    width: "20px",
    height: "20px",
    color: theme.custom.colors.silverGrayDark,
  },
}))

type StartMode = "certificate" | "practice"

const runLabel = (run: BaseCourseRun) => {
  const dates = [run.start_date, run.end_date]
    .filter((d): d is string => typeof d === "string")
    .map((d) => formatDate(d))
    .join(" – ")
  return run.is_upgradable
    ? `${dates} (Certificate available)`
    : `${dates} (No certificate available)`
}

type ProgramCourseStartDialogProps = {
  course: CourseWithCourseRunsSerializerV2
  /** Runs the learner can start, in display order. */
  runs: BaseCourseRun[]
  initialRunId?: number
  /** Program readable ids that the certificate enrollment is credited to. */
  programReadableIds: string[]
  onEnrolled: (run: BaseCourseRun) => void
}

const ProgramCourseStartDialogInner: React.FC<
  ProgramCourseStartDialogProps
> = ({ course, runs, initialRunId, programReadableIds, onEnrolled }) => {
  const modal = NiceModal.useModal()
  const [runId, setRunId] = React.useState(
    () => (runs.find((r) => r.id === initialRunId) ?? runs[0])?.id,
  )
  const run = runs.find((r) => r.id === runId)
  // A run without a verified mode, or past its upgrade deadline, can only be
  // taken in practice mode.
  const certificateAvailable = !!run?.is_upgradable
  const [chosenMode, setChosenMode] = React.useState<StartMode>("certificate")
  const mode: StartMode = certificateAvailable ? chosenMode : "practice"

  const createVerifiedEnrollment = useCreateVerifiedProgramEnrollment({
    meta: SILENCE_ERROR_TOAST,
  })
  const createAuditEnrollment = useCreateEnrollment({
    meta: SILENCE_ERROR_TOAST,
  })
  const activeMutation =
    mode === "certificate" ? createVerifiedEnrollment : createAuditEnrollment
  const { mutateWithCompliance } = useComplianceGate()
  const isPending =
    createVerifiedEnrollment.isPending || createAuditEnrollment.isPending

  const onSuccess = (enrolledRun: BaseCourseRun) => {
    modal.hide()
    onEnrolled(enrolledRun)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!run || isPending) return
    if (mode === "certificate") {
      await mutateWithCompliance(
        createVerifiedEnrollment,
        { courserun_id: run.courseware_id, request_body: programReadableIds },
        { onSuccess: () => onSuccess(run) },
      )
    } else {
      await mutateWithCompliance(
        createAuditEnrollment,
        { run_id: run.id },
        {
          onSuccess: () => {
            analytics.courseEnrolled(course.title)
            onSuccess(run)
          },
        },
      )
    }
  }

  const runOptions: SimpleSelectOption[] = runs.map((r) => ({
    label: runLabel(r),
    value: String(r.id),
  }))
  const singleRun = runs.length === 1

  return (
    <FormDialog
      title={course.title}
      fullWidth
      onSubmit={handleSubmit}
      {...muiDialogV5(modal)}
      // Closing mid-request would still enroll the learner, but skip the
      // redirect and leave them unaware, so stay open until it settles.
      onClose={isPending ? () => {} : () => modal.hide()}
      actions={
        <DialogActions>
          <Button
            variant="secondary"
            onClick={() => modal.hide()}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            disabled={!run || isPending}
            endIcon={
              isPending ? (
                <LoadingSpinner color="inherit" loading={true} size={16} />
              ) : undefined
            }
          >
            Continue
          </Button>
        </DialogActions>
      }
    >
      <Content gap="24px">
        <RunSelectField
          label="Choose a date"
          options={runOptions}
          value={runId === undefined ? "" : String(runId)}
          onChange={(e) => setRunId(Number(e.target.value))}
          readOnly={singleRun}
          SelectDisplayProps={singleRun ? { "aria-disabled": true } : undefined}
          fullWidth
        />
        <Question>
          <Typography variant="subtitle2" component="h2" id="start-mode-label">
            How would you like to take this course?
          </Typography>
          {certificateAvailable ? (
            <QuestionHint>
              Your program purchase includes certificate enrollment for this
              course.
            </QuestionHint>
          ) : null}
        </Question>
        <Stack role="radiogroup" aria-labelledby="start-mode-label" gap="12px">
          {certificateAvailable ? (
            <ChoiceBox
              type="radio"
              name="start-mode"
              value="certificate"
              checked={mode === "certificate"}
              onChange={() => setChosenMode("certificate")}
              label="Work toward a certificate"
              description={
                <Stack gap="6px">
                  <span>
                    Complete course requirements to earn credit toward your
                    program.
                  </span>
                  <ModeLine>
                    <strong>Certificate enrollment</strong> · Included with your
                    program
                  </ModeLine>
                </Stack>
              }
            />
          ) : null}
          <ChoiceBox
            type="radio"
            name="start-mode"
            value="practice"
            checked={mode === "practice"}
            onChange={() => setChosenMode("practice")}
            label="Try the course first"
            description={
              <Stack gap="6px">
                <span>
                  Learn and practice with available course materials without
                  working toward a certificate.
                </span>
                <ModeLine>
                  <strong>Practice mode</strong> · No certificate credit
                </ModeLine>
                <Note>
                  <RiInformationFill aria-hidden="true" />
                  {certificateAvailable ? (
                    <span>
                      Your progress will be saved when you switch, but you may
                      need to complete additional assessments.
                      {run?.upgrade_deadline ? (
                        <>
                          {" "}
                          To earn credit for this session,{" "}
                          <strong>
                            you must switch by{" "}
                            <LocalDate date={run.upgrade_deadline} />
                          </strong>
                          .
                        </>
                      ) : null}
                    </span>
                  ) : (
                    <span>
                      A certificate isn't available for this date.
                      {singleRun
                        ? null
                        : " Choose another date to work toward a certificate."}
                    </span>
                  )}
                </Note>
              </Stack>
            }
          />
        </Stack>
        {activeMutation.isError && (
          <Alert severity="error">
            <ErrorMessageWithSupport>
              {badRequestDetail(activeMutation.error) ??
                "There was a problem enrolling you in this course. Please try again later."}
            </ErrorMessageWithSupport>
          </Alert>
        )}
      </Content>
    </FormDialog>
  )
}

const ProgramCourseStartDialog = NiceModal.create(ProgramCourseStartDialogInner)

export { ProgramCourseStartDialog }
export type { ProgramCourseStartDialogProps }
