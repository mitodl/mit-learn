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

const ValidationBadge = styled.div(({ theme }) => ({
  display: "inline-flex",
  gap: "24px",
  backgroundColor: theme.custom.colors.lightGray1,
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  borderRadius: "4px",
  padding: "8px 16px",
  ...theme.typography.subtitle3,
  fontWeight: theme.typography.fontWeightMedium as number,
}))

const ValidCount = styled.span(({ theme }) => ({
  color: theme.custom.colors.darkGreen,
}))

const InvalidCount = styled.span(({ theme }) => ({
  color: theme.custom.colors.darkRed,
}))

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
    resize: "none",
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
  duplicateCount: number
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
  const fileInputRef = useRef<HTMLInputElement>(null)

  const bulkAssign = useBulkAssignSeats()

  const submitResult = useMemo(
    () => parseEmailsForSubmit(emailInput),
    [emailInput],
  )
  const validCount = submitResult.valid.length
  const invalidCount = submitResult.invalid.length
  const hasEmails = emailInput.trim().length > 0
  const canSubmit = validCount > 0

  // Overlay is always visible when there is content. Tokens are colored as soon
  // as a delimiter follows them (commit-on-delimiter); on blur all tokens commit.
  const tokens = useMemo(
    () => tokenizeInput(emailInput, !focused),
    [emailInput, focused],
  )
  const showOverlay = hasEmails

  const announcement = hasEmails
    ? `${validCount} valid ${pluralize("email", validCount)}${invalidCount > 0 ? `, ${invalidCount} invalid` : ""}`
    : ""

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
      const { valid, invalid, duplicateCount, skippedCount } =
        extractEmailsFromCsvRows(data)
      if (valid.length === 0) {
        setCsvNoValid(true)
        return
      }
      setEmailInput("")
      setModalData({
        validEmails: valid,
        invalidEmails: invalid,
        duplicateCount,
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
      duplicateCount: submitResult.duplicateCount,
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
      // Clear the input only on a fully successful assignment.
      if (data.errors.length === 0) {
        setEmailInput("")
      }
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
            <ValidationBadge id="assign-seats-validation" aria-hidden="true">
              <ValidCount>{validCount} valid</ValidCount>
              {invalidCount > 0 && (
                <InvalidCount>{invalidCount} invalid</InvalidCount>
              )}
            </ValidationBadge>
          )}
          {validCount > availableSeats && (
            <InvalidCount>
              Only {availableSeats} unassigned{" "}
              {pluralize("seat", availableSeats)} available.
            </InvalidCount>
          )}
        </Stack>
        <ButtonWrapper>
          <Button
            variant="primary"
            disabled={!canSubmit || validCount > availableSeats}
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
          duplicateCount={modalData.duplicateCount}
          skippedCount={modalData.skippedCount}
        />
      )}
    </SectionCard>
  )
}

export { AssignSeatsSection }
