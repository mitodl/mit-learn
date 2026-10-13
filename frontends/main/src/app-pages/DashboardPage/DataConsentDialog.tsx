import React from "react"
import { Dialog, DialogActions, LoadingSpinner, styled } from "ol-components"
import { Alert, Button, Checkbox } from "@mitodl/smoot-design"

const Paragraph = styled.p(({ theme }) => ({
  ...theme.typography.body2,
  lineHeight: theme.typography.pxToRem(22),
  color: theme.custom.colors.black,
  margin: 0,
}))

const Body = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "28px",
})

// smoot-design's Checkbox has a fixed 24px height (this label wraps), and it
// only darkens the label on hover or when checked; keep it dark throughout.
const ConsentCheckbox = styled(Checkbox)(({ theme }) => ({
  "&&": { height: "auto" },
  '&& input[type="checkbox"] + .checkbox-label': {
    color: theme.custom.colors.darkGray2,
  },
}))

// While submitting, the buttons use aria-disabled instead of disabled so the
// pressed button keeps focus; smoot-design only styles :disabled.
const ActionButton = styled(Button)(({ theme, variant }) => ({
  '&&&[aria-disabled="true"], &&&[aria-disabled="true"]:hover': {
    cursor: "default",
    boxShadow: "none",
    ...(variant === "primary"
      ? { backgroundColor: theme.custom.colors.silverGray }
      : {
          backgroundColor: "transparent",
          color: theme.custom.colors.silverGray,
        }),
  },
}))

const Actions = styled(DialogActions)({
  gap: "12px",
  "> *": {
    flex: 1,
  },
})

type DataConsentDialogProps = {
  open: boolean
  contractName: string
  onAccept: () => void
  onDecline: () => void
  submitting?: "accept" | "decline" | null
  isError?: boolean
}

const DataConsentDialog: React.FC<DataConsentDialogProps> = ({
  open,
  contractName,
  onAccept,
  onDecline,
  submitting = null,
  isError = false,
}) => {
  const [agreed, setAgreed] = React.useState(false)
  const spinner = <LoadingSpinner color="inherit" loading size={16} />
  const busy = submitting !== null
  const unlessBusy = (action: () => void) => () => {
    if (!busy) action()
  }

  return (
    <Dialog
      open={open}
      // Only Accept or Decline can close it, not Escape or a backdrop click.
      onClose={() => {}}
      showCloseButton={false}
      title="Data Consent - Requirement for Enrollment"
      maxWidth="sm"
      fullWidth
      actions={
        <Actions>
          <ActionButton
            variant="secondary"
            onClick={unlessBusy(onDecline)}
            aria-disabled={busy}
            aria-busy={submitting === "decline"}
            endIcon={submitting === "decline" ? spinner : undefined}
          >
            Decline
          </ActionButton>
          <ActionButton
            variant="primary"
            onClick={unlessBusy(onAccept)}
            disabled={!agreed}
            aria-disabled={busy}
            aria-busy={submitting === "accept"}
            endIcon={submitting === "accept" ? spinner : undefined}
          >
            Agree and continue
          </ActionButton>
        </Actions>
      }
    >
      <Body>
        <Paragraph>
          I understand that my organization has paid for my participation in the{" "}
          {contractName}. I hereby consent and authorize MIT to share the
          following information about my participation and progress in the
          Program with my organization: (a) Program completion status; (b)
          module progress and completion dates; (c) assessment scores and
          performance metrics; (d) certificates earned; and (e) any other
          progression or assessment data maintained by MIT.
        </Paragraph>
        <Paragraph>
          I understand that the data will be used solely to evaluate program
          effectiveness, track learner development and assess return on training
          investment.
        </Paragraph>
        <Paragraph>
          I understand that sharing of this data is a condition of my
          participation in the Program; I acknowledge that my organization is
          funding the training; and I have been informed of what data will be
          shared and with whom.
        </Paragraph>
        <ConsentCheckbox
          name="data_consent"
          label="I have read and consent to the data sharing described above."
          checked={agreed}
          onChange={(event) => setAgreed(event.target.checked)}
        />
        {isError ? (
          <Alert severity="error">
            We couldn't save your response. Please try again.
          </Alert>
        ) : null}
      </Body>
    </Dialog>
  )
}

export { DataConsentDialog }
export type { DataConsentDialogProps }
