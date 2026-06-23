"use client"

import React, { useEffect, useId, useRef, useState } from "react"
import {
  Dialog,
  DialogActions,
  Stack,
  Typography,
  alpha,
  styled,
} from "ol-components"
import { Button, VisuallyHidden } from "@mitodl/smoot-design"
import { pluralize } from "ol-utilities"
import {
  RiAlertFill,
  RiFileCopyLine,
  RiInformationLine,
  RiMailLine,
} from "@remixicon/react"

// ─── Icon badges ─────────────────────────────────────────────────────────────

const IconBadge = styled("span", {
  shouldForwardProp: (prop) => prop !== "$variant",
})<{ $variant: "warning" | "error" }>(({ theme, $variant }) => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "28px",
  height: "28px",
  borderRadius: "50%",
  backgroundColor:
    $variant === "error" ? theme.custom.colors.red : theme.custom.colors.orange,
  color: theme.custom.colors.white,
  flexShrink: 0,
  "& svg": { width: "20px", height: "20px" },
}))

// ─── Email alert box (invalid / duplicate list) ───────────────────────────────

const EmailAlertBox = styled("div")(({ theme }) => ({
  backgroundColor: alpha(theme.custom.colors.orange, 0.15),
  border: `1px solid ${alpha(theme.custom.colors.orange, 0.5)}`,
  borderRadius: "4px",
  padding: "11px 16px",
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  width: "100%",
}))

const AlertBoxTitle = styled(Typography)(({ theme }) => ({
  ...theme.typography.subtitle3,
  color: theme.custom.colors.darkGray2,
})) as typeof Typography

const EmailListUl = styled("ul")(({ theme }) => ({
  margin: 0,
  paddingLeft: "18px",
  ...theme.typography.body3,
  color: theme.custom.colors.darkGray2,
  "& li": { marginBottom: 0 },
}))

const ShowMoreButton = styled("button")(({ theme }) => ({
  background: "none",
  border: "none",
  padding: 0,
  cursor: "pointer",
  ...theme.typography.body3,
  color: theme.custom.colors.darkGray2,
  textAlign: "left",
  "&:hover": { opacity: 0.8 },
}))

const CopyLink = styled("button")(({ theme }) => ({
  background: "none",
  border: "none",
  padding: "8px 0",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: "4px",
  textDecoration: "underline",
  ...theme.typography.body3,
  color: theme.custom.colors.darkGray2,
  "& svg": { width: "16px", height: "16px", flexShrink: 0 },
  "&:hover": { opacity: 0.8 },
}))

// ─── Info note ────────────────────────────────────────────────────────────────

const InfoNote = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "flex-start",
  gap: "4px",
  ...theme.typography.body3,
  color: theme.custom.colors.silverGrayDark,
  "& svg": { width: "16px", height: "16px", marginTop: "1px", flexShrink: 0 },
}))

// ─── Description text ─────────────────────────────────────────────────────────

const DescriptionText = styled(Typography)(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.custom.colors.darkGray2,
})) as typeof Typography

// ─── Stats card ───────────────────────────────────────────────────────────────

const StatsCard = styled("div", {
  shouldForwardProp: (prop) => prop !== "$variant",
})<{ $variant: "default" | "error" }>(({ theme, $variant }) => ({
  backgroundColor:
    $variant === "error"
      ? theme.custom.colors.white
      : theme.custom.colors.lightGray1,
  border: `1px solid ${$variant === "error" ? theme.custom.colors.red : theme.custom.colors.lightGray2}`,
  borderRadius: "4px",
  padding: "16px",
  display: "flex",
  alignItems: "center",
  gap: "16px",
  width: "100%",
}))

const StatDivider = styled("div")(({ theme }) => ({
  width: "1px",
  alignSelf: "stretch",
  backgroundColor: theme.custom.colors.lightGray2,
  flexShrink: 0,
}))

const StatColumn = styled("div")({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  flex: "1 0 0",
  minWidth: 0,
  gap: "4px",
})

const StatValue = styled(Typography, {
  shouldForwardProp: (prop) => prop !== "$error",
})<{ $error?: boolean }>(({ theme, $error }) => ({
  ...theme.typography.h3,
  color: $error ? theme.custom.colors.red : theme.custom.colors.darkGray2,
  lineHeight: "36px",
  textAlign: "center",
  width: "100%",
}))

const StatLabel = styled(Typography)(({ theme }) => ({
  ...theme.typography.subtitle3,
  color: theme.custom.colors.silverGrayDark,
  textAlign: "center",
  width: "100%",
})) as typeof Typography

// ─── Small helpers ────────────────────────────────────────────────────────────

const SHOW_MORE_THRESHOLD = 3

const EmailListExpand: React.FC<{ emails: string[] }> = ({ emails }) => {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? emails : emails.slice(0, SHOW_MORE_THRESHOLD)
  const hidden = emails.length - SHOW_MORE_THRESHOLD

  return (
    <div>
      <EmailListUl>
        {visible.map((email) => (
          <li key={email}>{email}</li>
        ))}
      </EmailListUl>
      {!expanded && hidden > 0 && (
        <ShowMoreButton
          onClick={() => setExpanded(true)}
          aria-label={`Show ${hidden} more email addresses`}
        >
          + {hidden} more
        </ShowMoreButton>
      )}
    </div>
  )
}

const copyToClipboard = (text: string) => {
  navigator.clipboard?.writeText(text).catch(() => undefined)
}

// ─── Main component ───────────────────────────────────────────────────────────

type AssignSeatsConfirmModalProps = {
  open: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  validCount: number
  availableSeats: number
  invalidEmails: string[]
  duplicateEmails: string[]
  skippedCount: number
}

type Step = "review" | "confirm"

const AssignSeatsConfirmModal: React.FC<AssignSeatsConfirmModalProps> = ({
  open,
  onClose,
  onConfirm,
  validCount,
  availableSeats,
  invalidEmails,
  duplicateEmails,
  skippedCount,
}) => {
  const descriptionId = useId()
  const overCapacitySummaryId = `${descriptionId}-summary`

  const hasInvalid = invalidEmails.length > 0
  const hasDuplicates = duplicateEmails.length > 0
  const hasIssues = hasInvalid || hasDuplicates || skippedCount > 0
  const overCapacity = validCount > availableSeats

  const [step, setStep] = useState<Step>(() =>
    hasIssues && !overCapacity ? "review" : "confirm",
  )
  const [copiedInvalid, setCopiedInvalid] = useState(false)
  const [copiedDuplicate, setCopiedDuplicate] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  // Assertive live region text for step transitions. Using reset-then-set (100ms
  // delay) so NVDA picks up the content change cleanly after focus settles on the
  // new step's first focusable element inside the same persistent dialog.
  const [stepAnnouncement, setStepAnnouncement] = useState("")
  const [sendErrorAnnouncement, setSendErrorAnnouncement] = useState("")
  const prevOpenRef = useRef(open)
  const copyInvalidTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const copyDuplicateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  )
  const stepAnnouncementTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  )
  const sendErrorAnnouncementTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null)

  // Only reset step and copy state when the dialog transitions from closed to
  // open. Without prevOpenRef the effect would also fire when hasIssues or
  // overCapacity change while the dialog is already open (e.g. a parent
  // re-render), resetting the user's progress mid-flow.
  useEffect(() => {
    const wasOpen = prevOpenRef.current
    prevOpenRef.current = open
    if (open && !wasOpen) {
      setStep(hasIssues && !overCapacity ? "review" : "confirm")
      setCopiedInvalid(false)
      setCopiedDuplicate(false)
      setSendError(null)
      setSendErrorAnnouncement("")
      setStepAnnouncement("")
    }
  }, [open, hasIssues, overCapacity])

  useEffect(() => {
    return () => {
      if (copyInvalidTimerRef.current) clearTimeout(copyInvalidTimerRef.current)
      if (copyDuplicateTimerRef.current)
        clearTimeout(copyDuplicateTimerRef.current)
      if (stepAnnouncementTimerRef.current)
        clearTimeout(stepAnnouncementTimerRef.current)
      if (sendErrorAnnouncementTimerRef.current)
        clearTimeout(sendErrorAnnouncementTimerRef.current)
    }
  }, [])

  const handleCopyInvalid = () => {
    copyToClipboard(invalidEmails.join("\n"))
    setCopiedInvalid(true)
    if (copyInvalidTimerRef.current) clearTimeout(copyInvalidTimerRef.current)
    copyInvalidTimerRef.current = setTimeout(
      () => setCopiedInvalid(false),
      2000,
    )
  }

  const handleCopyDuplicate = () => {
    copyToClipboard(duplicateEmails.join("\n"))
    setCopiedDuplicate(true)
    if (copyDuplicateTimerRef.current)
      clearTimeout(copyDuplicateTimerRef.current)
    copyDuplicateTimerRef.current = setTimeout(
      () => setCopiedDuplicate(false),
      2000,
    )
  }

  const handleSend = async () => {
    setIsSubmitting(true)
    setSendError(null)
    try {
      await onConfirm()
      onClose()
    } catch {
      const msg = "Something went wrong. Please try again."
      setSendError(msg)
      // Announce via assertive live region — same reset-then-set pattern used
      // elsewhere in this file, because dynamically-mounted role="alert" elements
      // are not consistently picked up by NVDA when other live regions are active.
      setSendErrorAnnouncement("")
      if (sendErrorAnnouncementTimerRef.current)
        clearTimeout(sendErrorAnnouncementTimerRef.current)
      sendErrorAnnouncementTimerRef.current = setTimeout(
        () => setSendErrorAnnouncement(msg),
        100,
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const seatsAfterSending = availableSeats - validCount
  const overLimit = validCount - availableSeats

  const reviewTitle = hasInvalid
    ? "Some learners could not be added"
    : hasDuplicates
      ? "Duplicate emails removed"
      : "Some rows were skipped"

  // Advance from the review step to the confirm step within the same dialog
  // instance. Using an assertive live region (reset-then-set) rather than
  // mounting a new Dialog so that focus stays trapped and NVDA doesn't have
  // to re-discover a new role="dialog" element.
  const handleReviewAndConfirm = () => {
    setStep("confirm")
    const confirmText = `Ready to send invitations. You are about to send ${validCount} invitation ${pluralize("email", validCount)} from MIT Learn. Learners will receive an email with a secure link to claim their seat and access the materials. ${seatsAfterSending} seats remaining after sending. Emails will be sent immediately and cannot be recalled.`
    setStepAnnouncement("")
    if (stepAnnouncementTimerRef.current)
      clearTimeout(stepAnnouncementTimerRef.current)
    stepAnnouncementTimerRef.current = setTimeout(
      () => setStepAnnouncement(confirmText),
      100,
    )
  }

  // ── Derived title / actions / description (single Dialog, step-based) ──────

  const dialogTitle = overCapacity ? (
    <>
      <IconBadge $variant="error" aria-hidden="true">
        <RiAlertFill />
      </IconBadge>
      Not enough seats available
    </>
  ) : step === "review" ? (
    <>
      <IconBadge $variant="warning" aria-hidden="true">
        <RiAlertFill />
      </IconBadge>
      {reviewTitle}
    </>
  ) : (
    "Ready to send invitations"
  )

  const dialogActions = overCapacity ? (
    <DialogActions>
      <Button variant="primary" onClick={onClose}>
        Close &amp; Update CSV
      </Button>
    </DialogActions>
  ) : step === "review" ? (
    <DialogActions>
      <Button variant="bordered" color="secondary" onClick={onClose}>
        Cancel
      </Button>
      <Button variant="primary" onClick={handleReviewAndConfirm}>
        Review &amp; Confirm
      </Button>
    </DialogActions>
  ) : (
    <DialogActions>
      <Button variant="bordered" color="secondary" onClick={onClose}>
        Cancel
      </Button>
      <Button variant="primary" onClick={handleSend} disabled={isSubmitting}>
        {isSubmitting
          ? "Sending…"
          : `Send ${validCount} ${pluralize("Invitation", validCount)}`}
      </Button>
    </DialogActions>
  )

  const dialogDescription = overCapacity
    ? `${validCount} learners were imported, but only ${availableSeats} seats remain. ${overLimit} learners exceed the remaining contract capacity and cannot be assigned. Update your CSV to reduce the number of learners before continuing.`
    : step === "review"
      ? [
          `${validCount} learners are ready to invite.`,
          hasInvalid
            ? ` ${invalidEmails.length} ${pluralize("email address", invalidEmails.length, "email addresses")} were invalid and will be excluded.`
            : "",
          hasDuplicates
            ? ` ${duplicateEmails.length} duplicate ${pluralize("email address", duplicateEmails.length, "email addresses")} ${duplicateEmails.length === 1 ? "was" : "were"} removed.`
            : "",
          skippedCount > 0
            ? ` ${skippedCount} ${pluralize("row", skippedCount)} skipped — no email address found.`
            : "",
          " Only valid, unique emails will be assigned.",
        ].join("")
      : `You are about to send ${validCount} invitation ${pluralize("email", validCount)} from MIT Learn. Learners will receive an email with secure link to claim their seat and access the materials. ${seatsAfterSending} seats remaining after sending. Emails will be sent immediately and cannot be recalled.`

  // For overCapacity we point aria-describedby at the visible paragraph so
  // role="alertdialog" reads it exactly once on open. We do NOT programmatically
  // focus that paragraph — focus goes to the first interactive element (close
  // button) so NVDA enters forms mode, preventing browse-mode mouse-hover reads.
  const dialogDescribedBy = overCapacity ? overCapacitySummaryId : descriptionId

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      aria-describedby={dialogDescribedBy}
      PaperProps={overCapacity ? { role: "alertdialog" } : undefined}
      title={dialogTitle}
      actions={dialogActions}
    >
      {/* Static description read when focus first enters the dialog.
          Not rendered for overCapacity — focus on the visible paragraph handles
          that announcement to avoid a double-read. */}
      {!overCapacity && (
        <VisuallyHidden id={descriptionId}>{dialogDescription}</VisuallyHidden>
      )}
      {/* Step-transition announcement — fires after focus settles on the new
          step's content within the same dialog, so NVDA doesn't re-read the
          previous step or miss the new one */}
      <VisuallyHidden aria-live="assertive" aria-atomic="true">
        {stepAnnouncement}
      </VisuallyHidden>
      {/* Send-error announcement — workaround for dynamically-mounted role="alert"
          not being consistently picked up by NVDA when other live regions are active */}
      <VisuallyHidden aria-live="assertive" aria-atomic="true">
        {sendErrorAnnouncement}
      </VisuallyHidden>
      {/* Copy-success announcement — polite so it doesn't interrupt ongoing speech */}
      <VisuallyHidden aria-live="polite" aria-atomic="true">
        {copiedInvalid
          ? "Copied invalid emails to clipboard."
          : copiedDuplicate
            ? "Copied duplicate emails to clipboard."
            : ""}
      </VisuallyHidden>

      {/* ── Over-capacity content ──────────────────────────────────────────── */}
      {overCapacity && (
        <Stack gap="24px">
          <DescriptionText id={overCapacitySummaryId}>
            <strong>{validCount}</strong> learners were imported, but only{" "}
            <strong>{availableSeats} seats</strong> remain.{" "}
            <strong>{overLimit} learners</strong> exceed the remaining contract
            capacity and cannot be assigned.
          </DescriptionText>
          <StatsCard $variant="error" aria-hidden="true">
            <StatColumn role="group" aria-label={`${validCount} imported`}>
              <StatValue aria-hidden="true">{validCount}</StatValue>
              <StatLabel aria-hidden="true">Imported</StatLabel>
            </StatColumn>
            <StatDivider aria-hidden="true" />
            <StatColumn
              role="group"
              aria-label={`${availableSeats} seats available`}
            >
              <StatValue $error aria-hidden="true">
                {availableSeats}
              </StatValue>
              <StatLabel aria-hidden="true">Seats available</StatLabel>
            </StatColumn>
            <StatDivider aria-hidden="true" />
            <StatColumn role="group" aria-label={`${overLimit} over the limit`}>
              <StatValue $error aria-hidden="true">
                {overLimit}
              </StatValue>
              <StatLabel aria-hidden="true">Over the limit</StatLabel>
            </StatColumn>
          </StatsCard>
          <InfoNote>
            <RiInformationLine aria-hidden="true" />
            Update your CSV to reduce the number of learners before continuing.
          </InfoNote>
        </Stack>
      )}

      {/* ── Review step content ────────────────────────────────────────────── */}
      {!overCapacity && step === "review" && (
        <Stack gap="24px">
          <DescriptionText>
            <strong>{validCount} learners are ready</strong> to invite.{" "}
            {hasInvalid && (
              <>
                <strong>{invalidEmails.length}</strong>{" "}
                {pluralize(
                  "email address",
                  invalidEmails.length,
                  "email addresses",
                )}{" "}
                {hasInvalid && hasDuplicates
                  ? "were invalid."
                  : "were invalid and will be excluded."}
              </>
            )}
            {hasInvalid && hasDuplicates && " "}
            {hasDuplicates && (
              <>
                <strong>{duplicateEmails.length}</strong> duplicate{" "}
                {pluralize(
                  "email address",
                  duplicateEmails.length,
                  "email addresses",
                )}{" "}
                {duplicateEmails.length === 1 ? "was" : "were"} removed.
                {!hasInvalid &&
                  " Only the first instance of each email was kept."}
              </>
            )}
            {skippedCount > 0 && (
              <>
                {" "}
                <strong>
                  {skippedCount} {pluralize("row", skippedCount)} skipped
                </strong>{" "}
                — no email address found.
              </>
            )}
          </DescriptionText>

          {hasInvalid && (
            <EmailAlertBox>
              <AlertBoxTitle component="p">
                Invalid email addresses ({invalidEmails.length})
              </AlertBoxTitle>
              <EmailListExpand emails={invalidEmails} />
              <CopyLink onClick={handleCopyInvalid} type="button">
                <RiFileCopyLine aria-hidden="true" />
                {copiedInvalid ? "Copied!" : "Copy all invalid emails"}
              </CopyLink>
            </EmailAlertBox>
          )}

          {hasDuplicates && (
            <EmailAlertBox>
              <AlertBoxTitle component="p">
                Duplicate email addresses ({duplicateEmails.length})
              </AlertBoxTitle>
              <EmailListExpand emails={duplicateEmails} />
              <CopyLink onClick={handleCopyDuplicate} type="button">
                <RiFileCopyLine aria-hidden="true" />
                {copiedDuplicate ? "Copied!" : "Copy all duplicate emails"}
              </CopyLink>
            </EmailAlertBox>
          )}

          <InfoNote>
            <RiInformationLine aria-hidden="true" />
            Only valid, unique emails will be assigned.
          </InfoNote>
        </Stack>
      )}

      {/* ── Confirm step content ───────────────────────────────────────────── */}
      {!overCapacity && step === "confirm" && (
        <Stack gap="24px">
          <DescriptionText>
            You are about to send <strong>{validCount}</strong> invitation{" "}
            {pluralize("email", validCount)} from MIT Learn. Learners will
            receive an email with secure link to claim their seat and access the
            materials.
          </DescriptionText>
          <StatsCard $variant="default">
            <StatColumn
              role="group"
              aria-label={`${validCount} ${pluralize("invitation", validCount)}`}
            >
              <StatValue aria-hidden="true">{validCount}</StatValue>
              <StatLabel aria-hidden="true">Invitations</StatLabel>
            </StatColumn>
            <StatDivider aria-hidden="true" />
            <StatColumn
              role="group"
              aria-label={`${seatsAfterSending} seats remaining after sending`}
            >
              <StatValue aria-hidden="true">{seatsAfterSending}</StatValue>
              <StatLabel aria-hidden="true">
                Seats remaining after sending
              </StatLabel>
            </StatColumn>
            <StatDivider aria-hidden="true" />
            <StatColumn>
              <RiMailLine
                aria-hidden="true"
                style={{ width: "28px", height: "28px" }}
              />
              <StatLabel>
                Emails will be sent immediately and cannot be recalled.
              </StatLabel>
            </StatColumn>
          </StatsCard>
          {sendError && (
            <Typography
              variant="body2"
              component="p"
              color="error"
              role="alert"
            >
              {sendError}
            </Typography>
          )}
        </Stack>
      )}
    </Dialog>
  )
}

export { AssignSeatsConfirmModal }
export type { AssignSeatsConfirmModalProps }
