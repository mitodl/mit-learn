"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { Stack, Tooltip, Typography, styled } from "ol-components"
import { Alert, Button, VisuallyHidden } from "@mitodl/smoot-design"
import {
  isValidEmail,
  extractEmailsFromCsvRows,
  parseEmailsForSubmit,
  pluralize,
} from "ol-utilities"
import Papa from "papaparse"
import { AssignSeatsConfirmModal } from "./AssignSeatsConfirmModal"
import { useBulkAssignSeats } from "api/mitxonline-hooks/organizations"
import type { BulkAssignError } from "@mitodl/mitxonline-api-axios/v2"

// Shared metrics — must be identical between EmailHighlightLayer and EmailTextarea
// so the overlay and the real textarea render text in exactly the same position.
const TA_PADDING = "16px"
const TA_FONT_SIZE = "14px"
const TA_LINE_HEIGHT = "22px"
const TA_MIN_HEIGHT = "80px"

const SectionCard = styled.div(({ theme }) => ({
  backgroundColor: theme.custom.colors.white,
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  borderRadius: "8px",
  padding: "24px",
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  [theme.breakpoints.down("md")]: {
    padding: "16px",
  },
}))

const SectionTitle = styled(Typography)(({ theme }) => ({
  ...theme.typography.h5,
  color: theme.custom.colors.black,
})) as typeof Typography

const MutedText = styled(Typography)(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.custom.colors.silverGrayDark,
})) as typeof Typography

const ButtonWrapper = styled.span(({ theme }) => ({
  [theme.breakpoints.down("sm")]: {
    width: "100%",
    "& > button": { width: "100%" },
  },
}))

const ActiveLink = styled.span(({ theme }) => ({
  ...theme.typography.subtitle2,
  color: theme.custom.colors.darkRed,
  textDecoration: "underline",
  cursor: "pointer",
  "&:hover": { opacity: 0.8 },
}))

const DisabledLink = styled.span(({ theme }) => ({
  ...theme.typography.subtitle2,
  color: theme.custom.colors.darkRed,
  textDecoration: "underline",
  cursor: "not-allowed",
  opacity: 0.5,
}))

const CountBadge = styled.div<{ $variant: "valid" | "warning" | "default" }>(
  ({ theme, $variant }) => ({
    display: "inline-flex",
    backgroundColor:
      $variant === "warning"
        ? theme.custom.colors.white
        : theme.custom.colors.lightGray1,
    border: `1px solid ${$variant === "warning" ? theme.custom.colors.darkRed : theme.custom.colors.lightGray2}`,
    borderRadius: "4px",
    padding: "8px 16px",
    ...theme.typography.subtitle3,
    fontWeight: theme.typography.fontWeightMedium as number,
    color:
      $variant === "valid"
        ? theme.custom.colors.darkGreen
        : $variant === "warning"
          ? theme.custom.colors.darkRed
          : theme.custom.colors.darkGray2,
  }),
)

/**
 * Wrapper for the textarea + highlight overlay. We use a custom textarea here
 * rather than smoot-design's Input because rendering per-token colors requires
 * an absolutely-positioned overlay that must share exact metrics with the
 * underlying textarea — something the smoot Input wrapper doesn't expose.
 */
const EmailInputRoot = styled.div<{ $focused: boolean }>(
  ({ theme, $focused }) => ({
    position: "relative",
    border: `1px solid ${theme.custom.colors.silverGrayLight}`,
    borderRadius: "4px",
    backgroundColor: theme.custom.colors.white,
    width: "100%",
    ...($focused && {
      // outline draws outside the border box so there's no layout shift
      outline: `1px solid ${theme.custom.colors.darkGray2}`,
      borderColor: theme.custom.colors.darkGray2,
    }),
  }),
)

/** Absolutely-positioned div that renders colored email tokens behind the textarea. */
const EmailHighlightLayer = styled.div({
  position: "absolute",
  inset: 0,
  padding: TA_PADDING,
  fontSize: TA_FONT_SIZE,
  lineHeight: TA_LINE_HEIGHT,
  fontFamily: "inherit",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  overflowWrap: "break-word",
  pointerEvents: "none",
  userSelect: "none",
  overflow: "hidden",
  boxSizing: "border-box",
})

const InvalidEmailSegment = styled.span(({ theme }) => ({
  color: theme.custom.colors.darkRed,
}))

const EmailTextarea = styled("textarea")<{ $transparent: boolean }>(
  ({ theme, $transparent }) => ({
    display: "block",
    position: "relative",
    width: "100%",
    minHeight: TA_MIN_HEIGHT,
    padding: TA_PADDING,
    // `color` keeps the placeholder visible; `-webkit-text-fill-color` makes
    // only the typed text transparent so the overlay shows through.
    color: $transparent ? "transparent" : theme.custom.colors.darkGray2,
    WebkitTextFillColor: $transparent
      ? "transparent"
      : theme.custom.colors.darkGray2,
    caretColor: theme.custom.colors.darkGray2,
    background: "transparent",
    border: "none",
    outline: "none",
    resize: "vertical",
    fontFamily: "inherit",
    fontSize: TA_FONT_SIZE,
    lineHeight: TA_LINE_HEIGHT,
    boxSizing: "border-box",
    "&::placeholder": {
      color: theme.custom.colors.silverGrayDark,
      WebkitTextFillColor: theme.custom.colors.silverGrayDark,
    },
  }),
)

/**
 * Split input into segments preserving the original text (including delimiters
 * and whitespace) so each segment can be colored independently in the overlay.
 *
 * A token is "committed" (and therefore colored) when a delimiter follows it
 * in the string — i.e., the user has moved on to the next email. If
 * `allCommitted` is true (e.g. on blur) every token is colored regardless.
 * The token currently being typed has no trailing delimiter yet, so it stays
 * neutral, avoiding red-on-first-keypress.
 */
const tokenizeInput = (input: string, allCommitted: boolean) => {
  const parts = input.split(/([\r\n,]+)/)
  return parts.map((part, i) => {
    if (/^[\r\n,]+$/.test(part) || !part.trim()) {
      return { text: part, valid: null }
    }
    const prevPart = parts[i - 1]
    const nextPart = parts[i + 1]
    const isLastToken = parts
      .slice(i + 1)
      .every((p) => /^[\r\n,]+$/.test(p) || !p.trim())
    const committed =
      allCommitted ||
      (nextPart !== undefined && /^[\r\n,]+$/.test(nextPart)) ||
      (isLastToken && prevPart !== undefined && /^[\r\n,]+$/.test(prevPart))
    return { text: part, valid: committed ? isValidEmail(part.trim()) : null }
  })
}

const ResultErrorList = styled.ul(({ theme }) => ({
  margin: "8px 0 0",
  paddingLeft: "20px",
  ...theme.typography.body2,
}))

type ModalData = {
  validEmails: string[]
  invalidEmails: string[]
  duplicateEmails: string[]
  skippedCount: number
}

/**
 * Outcome of a bulk-assign request, surfaced in an inline Alert.
 * `errors: null` means the request itself failed (network/server error);
 * `errors: []` means every code was assigned successfully.
 */
type AssignResult = {
  assignedCount: number
  errors: BulkAssignError[] | null
}

type AssignSeatsSectionProps = {
  orgId: number
  contractId: number
  availableSeats: number
}

const AssignSeatsSection: React.FC<AssignSeatsSectionProps> = ({
  orgId,
  contractId,
  availableSeats,
}) => {
  const [emailInput, setEmailInput] = useState("")
  const [focused, setFocused] = useState(false)
  const [csvReadError, setCsvReadError] = useState(false)
  const [csvNoValid, setCsvNoValid] = useState(false)
  const [modalData, setModalData] = useState<ModalData | null>(null)
  const [result, setResult] = useState<AssignResult | null>(null)
  const [debouncedAnnouncement, setDebouncedAnnouncement] = useState("")
  const [errorAnnouncement, setErrorAnnouncement] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const bulkAssign = useBulkAssignSeats()

  const submitResult = useMemo(
    () => parseEmailsForSubmit(emailInput),
    [emailInput],
  )
  const validCount = submitResult.valid.length
  const invalidCount = submitResult.invalid.length
  const duplicateCount = submitResult.duplicateEmails.length
  const hasEmails = emailInput.trim().length > 0
  const canSubmit = validCount > 0

  // Overlay is always visible when there is content. Tokens are colored as soon
  // as a delimiter follows them (commit-on-delimiter); on blur all tokens commit.
  const tokens = useMemo(
    () => tokenizeInput(emailInput, !focused),
    [emailInput, focused],
  )
  const showOverlay = hasEmails

  const overCapacity = validCount > availableSeats
  const ignoreWarning =
    !overCapacity && (invalidCount > 0 || duplicateCount > 0)
      ? `. ${[
          duplicateCount > 0
            ? `${duplicateCount} duplicate ${pluralize("email address", duplicateCount, "email addresses")}`
            : "",
          invalidCount > 0
            ? `${invalidCount} invalid ${pluralize("email address", invalidCount, "email addresses")}`
            : "",
        ]
          .filter(Boolean)
          .join(" and ")} will be ignored`
      : ""
  let announcement = ""
  if (hasEmails) {
    const parts = [`${validCount} valid ${pluralize("email", validCount)}`]
    if (invalidCount > 0) parts.push(`${invalidCount} invalid`)
    if (duplicateCount > 0)
      parts.push(`${duplicateCount} ${pluralize("duplicate", duplicateCount)}`)
    announcement = parts.join(", ") + ignoreWarning
    if (overCapacity) {
      const excess = validCount - availableSeats
      const seatsClause =
        availableSeats > 1
          ? `${availableSeats} unassigned ${pluralize("seat", availableSeats)} are available.`
          : `${availableSeats} unassigned seat is available.`
      announcement += `. Error: You entered ${validCount} ${pluralize("email", validCount)}, but only ${seatsClause} Remove ${excess} more email ${pluralize("address", excess, "addresses")} to continue.`
    }
  }

  // Debounce the live-region text so screen readers aren't spammed on every keystroke.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedAnnouncement(announcement), 600)
    return () => clearTimeout(id)
  }, [announcement])

  // Severity and headline message for the bulk-assign outcome, derived from the
  // result shape (and surfaced via an inline Alert).
  const resultContent = useMemo(() => {
    if (!result) return null
    const { assignedCount, errors } = result
    const assigned = `${assignedCount} ${pluralize("seat", assignedCount)} assigned.`
    if (errors === null) {
      return {
        severity: "error" as const,
        message: "Something went wrong assigning seats. Please try again.",
      }
    }
    if (errors.length === 0) {
      return { severity: "success" as const, message: assigned }
    }
    const failed = `${errors.length} could not be assigned:`
    return {
      severity: assignedCount > 0 ? ("warning" as const) : ("error" as const),
      message:
        assignedCount > 0
          ? `${assigned} ${failed}`
          : `No seats assigned. ${failed}`,
      errors,
    }
  }, [result])

  // Derive the assertive announcement from all error sources in one place so
  // the two concerns can't clear each other. Two separate effects sharing one
  // setState caused the second effect to wipe the first when resultContent
  // went null (e.g. user closes the success Alert).
  const errorAnnouncementText = useMemo(() => {
    if (csvReadError) return "Error: Could not read the file. Please try again."
    if (csvNoValid) return "Error: No valid email addresses found in this file."
    if (resultContent) {
      const prefix =
        resultContent.severity === "error" ||
        resultContent.severity === "warning"
          ? `${resultContent.severity}: `
          : ""
      const errorDetails = resultContent.errors
        ?.map((e) => `${e.email} — ${e.detail}`)
        .join(", ")
      return (
        prefix +
        resultContent.message +
        (errorDetails ? ` ${errorDetails}` : "")
      )
    }
    return ""
  }, [csvReadError, csvNoValid, resultContent])

  // Reset-then-set with a short delay so the assertive live region fires after
  // smoot-design Alert's role="alert" has been processed by NVDA. Without the
  // delay, both fire in the same frame and NVDA drops the live-region update.
  useEffect(() => {
    if (!errorAnnouncementText) {
      setErrorAnnouncement("")
      return
    }
    setErrorAnnouncement("")
    const id = setTimeout(
      () => setErrorAnnouncement(errorAnnouncementText),
      100,
    )
    return () => clearTimeout(id)
  }, [errorAnnouncementText])

  const handleCsvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (fileInputRef.current) fileInputRef.current.value = ""
    setCsvReadError(false)
    setCsvNoValid(false)
    setModalData(null)
    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      const { data } = Papa.parse<string[]>(text, {
        skipEmptyLines: true,
      })
      const { valid, invalid, duplicateEmails, skippedCount } =
        extractEmailsFromCsvRows(data)
      setEmailInput("")
      if (valid.length === 0) {
        setCsvNoValid(true)
        return
      }
      setModalData({
        validEmails: valid,
        invalidEmails: invalid,
        duplicateEmails,
        skippedCount,
      })
    }
    reader.onerror = () => setCsvReadError(true)
    reader.readAsText(file)
  }

  const handleAssignSeats = () => {
    setModalData({
      validEmails: submitResult.valid,
      invalidEmails: submitResult.invalid,
      duplicateEmails: submitResult.duplicateEmails,
      skippedCount: submitResult.skippedCount,
    })
  }

  const handleModalClose = () => setModalData(null)

  const handleModalConfirm = async () => {
    const emails = modalData?.validEmails ?? []
    if (emails.length === 0) return
    setResult(null)
    try {
      const { data } = await bulkAssign.mutateAsync({
        id: contractId,
        parent_lookup_organization: orgId,
        AssignRevokeCodeRequestRequest: emails.map((email) => ({ email })),
      })
      setResult({ assignedCount: data.assigned.length, errors: data.errors })
      setEmailInput("")
    } catch {
      setResult({ assignedCount: 0, errors: null })
    }
    // The Dialog closes itself once this resolves (see Dialog.handleConfirm).
  }

  return (
    <SectionCard>
      <div>
        <SectionTitle component="h2">Assign Seats</SectionTitle>
        <MutedText>
          Each learner will receive an email with a link to claim their seat and
          access the program.
        </MutedText>
      </div>
      {/* Always-mounted live region — debounced so screen readers aren't spammed on every keystroke */}
      <VisuallyHidden aria-live="polite" aria-atomic="true">
        {debouncedAnnouncement}
      </VisuallyHidden>
      {/* Assertive region for errors — workaround for smoot-design Alert announcing
          only its aria-describedby ("error message") instead of the children text */}
      <VisuallyHidden aria-live="assertive" aria-atomic="true">
        {errorAnnouncement}
      </VisuallyHidden>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        gap="24px"
        alignItems="flex-start"
      >
        <Stack
          flex={1}
          gap="8px"
          minWidth={0}
          alignItems="flex-start"
          width="100%"
        >
          <EmailInputRoot $focused={focused}>
            {showOverlay && (
              <EmailHighlightLayer
                aria-hidden="true"
                data-email-overlay
                style={{ overflow: "auto" }}
              >
                {tokens.map((token, i) =>
                  token.valid === false ? (
                    <InvalidEmailSegment
                      key={`${i}-${token.text}`}
                      data-invalid-email
                    >
                      {token.text}
                    </InvalidEmailSegment>
                  ) : (
                    <span key={`${i}-${token.text}`}>{token.text}</span>
                  ),
                )}
              </EmailHighlightLayer>
            )}
            <EmailTextarea
              aria-label="Employee emails"
              placeholder="Enter employee emails (one per line or comma-separated)"
              autoComplete="off"
              spellCheck={false}
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onScroll={(e) => {
                const overlay = e.currentTarget.parentElement?.querySelector(
                  "[data-email-overlay]",
                ) as HTMLDivElement | null
                if (overlay) {
                  overlay.scrollTop = e.currentTarget.scrollTop
                  overlay.scrollLeft = e.currentTarget.scrollLeft
                }
              }}
              $transparent={showOverlay}
            />
          </EmailInputRoot>
          {hasEmails && (
            <Stack
              direction="row"
              alignItems="center"
              flexWrap="wrap"
              gap="8px"
            >
              <CountBadge $variant="valid" aria-hidden="true">
                {validCount} valid
              </CountBadge>
              {invalidCount > 0 && (
                <CountBadge $variant="warning" aria-hidden="true">
                  {invalidCount} invalid
                </CountBadge>
              )}
              {duplicateCount > 0 && (
                <CountBadge $variant="warning" aria-hidden="true">
                  {duplicateCount} {pluralize("duplicate", duplicateCount)}
                </CountBadge>
              )}
            </Stack>
          )}
        </Stack>
        <ButtonWrapper>
          <Button
            variant="primary"
            disabled={!canSubmit || overCapacity}
            onClick={handleAssignSeats}
          >
            Assign Seats
          </Button>
        </ButtonWrapper>
      </Stack>
      <Stack direction="row" gap="4px" alignItems="center" flexWrap="wrap">
        <MutedText>Paste multiple emails or</MutedText>
        {/* Hidden file input triggered by the button below */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          aria-hidden="true"
          tabIndex={-1}
          style={{ display: "none" }}
          onChange={handleCsvChange}
        />
        <ActiveLink
          role="button"
          tabIndex={0}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              fileInputRef.current?.click()
            }
          }}
        >
          import from CSV
        </ActiveLink>
        <Tooltip title="Coming soon" describeChild>
          <DisabledLink role="button" aria-disabled="true" tabIndex={0}>
            (download sample CSV)
          </DisabledLink>
        </Tooltip>
      </Stack>
      {!overCapacity && (invalidCount > 0 || duplicateCount > 0) && (
        <Alert severity="warning">
          {[
            duplicateCount > 0
              ? `${duplicateCount} duplicate ${pluralize("email address", duplicateCount, "email addresses")}`
              : "",
            invalidCount > 0
              ? `${invalidCount} invalid ${pluralize("email address", invalidCount, "email addresses")}`
              : "",
          ]
            .filter(Boolean)
            .join(" and ")}{" "}
          will be ignored
        </Alert>
      )}
      {overCapacity && (
        <Alert severity="error">
          {availableSeats > 1
            ? `You entered ${validCount} ${pluralize("email", validCount)}, but only ${availableSeats} unassigned ${pluralize("seat", availableSeats)} are available.`
            : `You entered ${validCount} ${pluralize("email", validCount)}, but only ${availableSeats} unassigned seat is available.`}{" "}
          Remove {validCount - availableSeats} more email{" "}
          {pluralize("address", validCount - availableSeats, "addresses")} to
          continue.
        </Alert>
      )}
      {csvReadError && (
        <Alert severity="error" closable onClose={() => setCsvReadError(false)}>
          Could not read the file. Please try again.
        </Alert>
      )}
      {csvNoValid && (
        <Alert severity="error" closable onClose={() => setCsvNoValid(false)}>
          No valid email addresses found in this file.
        </Alert>
      )}
      {resultContent && (
        <Alert
          severity={resultContent.severity}
          closable
          onClose={() => setResult(null)}
        >
          {resultContent.message}
          {resultContent.errors && resultContent.errors.length > 0 && (
            <ResultErrorList>
              {resultContent.errors.map((err) => (
                <li key={err.email}>
                  {err.email} — {err.detail}
                </li>
              ))}
            </ResultErrorList>
          )}
        </Alert>
      )}
      {modalData && (
        <AssignSeatsConfirmModal
          open
          onClose={handleModalClose}
          onConfirm={handleModalConfirm}
          validCount={modalData.validEmails.length}
          availableSeats={availableSeats}
          invalidEmails={modalData.invalidEmails}
          duplicateEmails={modalData.duplicateEmails}
          skippedCount={modalData.skippedCount}
        />
      )}
    </SectionCard>
  )
}

export { AssignSeatsSection }
