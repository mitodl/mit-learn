import React, { useRef } from "react"
import NiceModal, { muiDialogV5 } from "@ebay/nice-modal-react"
import { useFormik } from "formik"
import {
  FormDialog,
  DialogActions,
  LoadingSpinner,
  styled,
} from "ol-components"
import {
  Alert,
  Button,
  Checkbox,
  Description,
  RadioChoiceField,
  TextField,
} from "@mitodl/smoot-design"
import { RefundReasonEnum } from "@mitodl/mitxonline-api-axios/v2"
import type { Order } from "@mitodl/mitxonline-api-axios/v2"
import { useCreateRefundRequest } from "api/mitxonline-hooks/orders"
import { SILENCE_ERROR_TOAST } from "api/mutation-meta"
import { formatMoney } from "./receiptUtils"

/**
 * The reasons the design offers, in the wording it uses.
 *
 * "Other" is last rather than fourth, where the design puts it. Everything after
 * it there is still a specific reason, so both the tab order and the rendered
 * column read as though the list restarts. The set of options is unchanged.
 */
const REFUND_REASONS = [
  { value: RefundReasonEnum.NotEnoughTime, label: "I do not have enough time" },
  {
    value: RefundReasonEnum.CourseNotAsExpected,
    label: "Course is not what I expected",
  },
  {
    value: RefundReasonEnum.TechnicalDifficulties,
    label: "I had a technical issue",
  },
  {
    value: RefundReasonEnum.CourseTooDifficult,
    label: "Course is too difficult",
  },
  {
    value: RefundReasonEnum.PurchasedByMistake,
    label: "I purchased by mistake",
  },
  { value: RefundReasonEnum.PreferNotToSay, label: "Prefer not to say" },
  { value: RefundReasonEnum.Other, label: "Other" },
]

const REASON_TEXT_MAX = 1000

const Body = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "24px",
})

const Intro = styled.p(({ theme }) => ({
  ...theme.typography.body1,
  color: theme.custom.colors.darkGray2,
  margin: 0,
}))

const Emphasis = styled.span(({ theme }) => ({
  fontWeight: theme.typography.fontWeightBold,
}))

/** Amount and method, boxed and ruled like the design's two-row table. */
const Summary = styled.dl(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: "16px 24px",
  margin: 0,
  padding: "16px",
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  borderRadius: "4px",
  "> dt": {
    ...theme.typography.body2,
    color: theme.custom.colors.darkGray2,
  },
  "> dd": {
    ...theme.typography.body2,
    color: theme.custom.colors.darkGray2,
    margin: 0,
    textAlign: "right",
  },
}))

/**
 * Two columns on desktop, one on mobile. `RadioChoiceField` renders a single
 * column, so the layout is applied to its group from here.
 *
 * The grid flows down the first column before starting the second, as the design
 * does. Row-major would scatter the options into a different arrangement than
 * the list order, so reading across a row would suggest a pairing that is not
 * there.
 */
const Reasons = styled(RadioChoiceField)(({ theme }) => ({
  ".MuiRadioGroup-root": {
    display: "grid",
    gridAutoFlow: "column",
    gridTemplateRows: `repeat(${Math.ceil(REFUND_REASONS.length / 2)}, auto)`,
    columnGap: "24px",
    [theme.breakpoints.down("sm")]: {
      gridAutoFlow: "row",
      gridTemplateRows: "none",
    },
  },
}))

const Counter = styled.div(({ theme }) => ({
  ...theme.typography.body3,
  color: theme.custom.colors.silverGrayDark,
  textAlign: "right",
}))

/**
 * `Description` on its own is only styling. An error a screen reader will
 * actually hear needs a live region.
 *
 * `role="alert"` carries this alone, without a matching `aria-describedby` on
 * the input: neither `Checkbox` nor `RadioChoiceField` forwards arbitrary props
 * to the control, and describing the wrapper instead does nothing, since
 * `aria-describedby` is only read from the focused element.
 */
const ErrorText: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Description error role="alert">
    {children}
  </Description>
)

/*
 * The requirement is stated in the label because smoot-design's `Checkbox`
 * takes no `required` prop and forwards nothing to its input, so there is no
 * way to mark it programmatically. Without this, assistive technology only
 * learns the box is mandatory after a failed submit.
 */
const CONSENT_LABEL =
  "I understand that my grades and progress towards a certificate will be removed after the refund is processed. (required)"

type FormValues = {
  refund_reason: RefundReasonEnum | ""
  refund_reason_text: string
  consent_given: boolean
}

const Field = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "4px",
})

/**
 * smoot-design's `Checkbox` gives its container a fixed `height: 24px`, which
 * assumes a label that fits on one line. This consent label wraps, so the text
 * overflows the box and the error underneath is spaced off it. Remove once the
 * height is `auto` upstream.
 *
 * `&&` because the override and the component's own style are both single
 * emotion classes on the same element, so specificity has to break the tie
 * rather than injection order.
 */
const ConsentCheckbox = styled(Checkbox)({
  "&&": { height: "auto" },
})

/**
 * Whether the free-text box is on screen.
 *
 * Validation and submission both key off this. Anything it hides is neither
 * checked nor sent: an error on a field the learner cannot see is one they
 * cannot clear, and text they typed under "Other" does not describe the reason
 * they ended up choosing.
 */
const showsReasonText = (values: FormValues, isLate: boolean) =>
  isLate || values.refund_reason === RefundReasonEnum.Other

/**
 * Mirrors what `RefundRequestSerializer` will accept, so the learner is told
 * what is wrong before the request is sent rather than after a 400.
 */
const validate = (values: FormValues, isLate: boolean) => {
  const errors: Partial<Record<keyof FormValues, string>> = {}
  const text = values.refund_reason_text.trim()

  if (!isLate && !values.refund_reason) {
    errors.refund_reason = "Please select a reason for your refund request."
  }
  // The API requires free text whenever no preset reason explains the request:
  // after the window there are no presets, and "Other" says nothing on its own.
  if (showsReasonText(values, isLate)) {
    if (!text) {
      errors.refund_reason_text =
        "Please tell us why you're requesting a refund."
    } else if (text.length > REASON_TEXT_MAX) {
      errors.refund_reason_text = `Please keep this to ${REASON_TEXT_MAX} characters or fewer.`
    }
  }
  if (!values.consent_given) {
    errors.consent_given = "Please acknowledge this before continuing."
  }
  return errors
}

type RefundRequestDialogProps = {
  order: Order
  /** The line the learner is refunding, named in the dialog's opening line. */
  title: string
  /**
   * Past the refund window: no preset reasons, the request goes for review
   * rather than straight through, and the wording says so.
   */
  isLate: boolean
  /**
   * Called once the request is accepted, before the dialog closes. The card
   * behind it already re-renders from the invalidated receipt, so this exists
   * for the page to confirm the submission outright rather than leave the
   * learner inferring it from a changed panel.
   */
  onSubmitted?: () => void
}

const RefundRequestDialogInner: React.FC<RefundRequestDialogProps> = ({
  order,
  title,
  isLate,
  onSubmitted,
}) => {
  const modal = NiceModal.useModal()
  // The dialog reports a rejected request inline, next to the submit button it
  // came from, so the global toast would duplicate it somewhere less useful.
  const createRefundRequest = useCreateRefundRequest({
    meta: SILENCE_ERROR_TOAST,
  })

  /**
   * Refunding usually drops the learner to the audit track, but some courses
   * have none and disappear from the dashboard instead. Assume the harsher
   * outcome if the order somehow has no line, rather than promising access
   * that may not survive the refund.
   *
   * Reading line 0 alone assumes one line per order. mitxonline can model more
   * — `create_from_basket` writes a `Line` per product — but no checkout has
   * ever produced a multi-line order. If one ever does, this needs to consider
   * every line and say something sensible about a mixed order, since the
   * request refunds the whole thing.
   */
  const hasFreeAudit = order.lines[0]?.has_free_audit ?? false

  const formik = useFormik<FormValues>({
    initialValues: {
      refund_reason: "",
      refund_reason_text: "",
      consent_given: false,
    },
    validateOnChange: false,
    validateOnBlur: false,
    validate: (values) => validate(values, isLate),
    // `mutate` rather than `mutateAsync`: a rejected request is already
    // surfaced through `isError` below, and awaiting it here would leave the
    // rejection for formik to catch and warn about.
    onSubmit: (values) => {
      createRefundRequest.mutate(
        {
          order: order.id,
          // After the window the API takes the free text alone; sending a
          // preset reason too would misreport what the learner chose.
          refund_reason: isLate ? undefined : values.refund_reason || undefined,
          // Only ever send what was on screen. Text typed under "Other" and
          // then abandoned for a preset reason describes neither.
          refund_reason_text: showsReasonText(values, isLate)
            ? values.refund_reason_text.trim()
            : "",
          consent_given: values.consent_given,
        },
        {
          onSuccess: () => {
            onSubmitted?.()
            modal.hide()
          },
        },
      )
    },
  })

  const showReasonText = showsReasonText(formik.values, isLate)

  // `FormDialog` owns the form element's props, so the ref goes on the body it
  // renders instead. Every field lives inside it.
  const bodyRef = useRef<HTMLDivElement>(null)

  /**
   * Send focus to whatever failed, in the order the fields appear. Without it a
   * submit from the bottom of the dialog reports an error the learner may never
   * scroll back to, and leaves a screen reader sitting on the button.
   */
  const focusFirstError = (
    errors: Partial<Record<keyof FormValues, string>>,
  ) => {
    const first = (
      ["refund_reason", "refund_reason_text", "consent_given"] as const
    ).find((name) => errors[name])
    if (!first) return
    bodyRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus()
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const errors = await formik.validateForm()
    if (Object.keys(errors).length > 0) {
      // Formik sets these itself on submit, but it cannot tell us which field
      // to move to, so they are applied here alongside the focus move.
      formik.setErrors(errors)
      focusFirstError(errors)
      return
    }
    formik.handleSubmit(event)
  }

  /**
   * Errors are raised on submit, not on change, so a stale one would otherwise
   * sit there after the learner has fixed it. Clearing the field's own error as
   * they act on it keeps the message tied to the current state without
   * validating fields they have not reached yet.
   */
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    formik.handleChange(event)
    if (formik.errors[event.target.name as keyof FormValues]) {
      formik.setFieldError(event.target.name, undefined)
    }
  }

  return (
    <FormDialog
      title={isLate ? "Request refund review" : "Request refund"}
      fullWidth
      // Fields are marked `required` for assistive tech, but the browser's own
      // validation would block submit before formik could report anything.
      noValidate
      onReset={formik.resetForm}
      onSubmit={handleSubmit}
      {...muiDialogV5(modal)}
      actions={
        <DialogActions>
          <Button variant="secondary" onClick={() => modal.hide()}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            disabled={createRefundRequest.isPending}
            endIcon={
              createRefundRequest.isPending ? (
                <LoadingSpinner color="inherit" loading={true} size={16} />
              ) : undefined
            }
          >
            {isLate ? "Submit for Review" : "Submit Refund Request"}
          </Button>
        </DialogActions>
      }
    >
      <Body ref={bodyRef}>
        {isLate ? (
          <>
            <Intro>
              Automatic refunds are no longer available for this order. You can
              submit a request for review.
            </Intro>
            <Intro>
              A support team member will review your request. Approval is not
              guaranteed.
            </Intro>
            <Intro>
              <Emphasis>Estimated processing time: 3-5 business days.</Emphasis>
            </Intro>
          </>
        ) : (
          <Intro>
            {`You're requesting a refund for ${title}. `}
            <Emphasis>Estimated processing time: 3-5 business days.</Emphasis>
          </Intro>
        )}

        <Summary>
          <dt>Refund amount</dt>
          <dd>{formatMoney(order.total_price_paid)}</dd>
          <dt>Refund method</dt>
          <dd>Original payment method</dd>
        </Summary>

        <Alert severity="warning" label="What happens after refund" closable>
          {hasFreeAudit
            ? "You'll be moved to the free version of this course. You can continue viewing available course materials, but certificate-track access, graded assignments, and certificate progress will be removed."
            : "This course does not have a free audit version. After the refund is processed, the course will be removed from your dashboard and you'll lose access to the course materials."}
        </Alert>

        {/*
         * The error still announces itself through `role="alert"` rather than
         * an `aria-describedby` on the group: `RadioChoiceField` takes no
         * `errorText`, and describing the wrapper instead does nothing, since
         * `aria-describedby` is only read from the focused element.
         */}
        {isLate ? null : (
          <Field>
            <Reasons
              name="refund_reason"
              label="Reason for refund request"
              required
              choices={REFUND_REASONS}
              value={formik.values.refund_reason}
              onChange={handleChange}
            />
            {formik.errors.refund_reason ? (
              <ErrorText>{formik.errors.refund_reason}</ErrorText>
            ) : (
              <Description>
                Select the main reason you're requesting a refund.
              </Description>
            )}
          </Field>
        )}

        {showReasonText ? (
          <div>
            <TextField
              fullWidth
              required
              multiline={isLate}
              minRows={isLate ? 4 : undefined}
              name="refund_reason_text"
              label={isLate ? "Reason for request" : "Please Specify"}
              // The limit belongs in the description, not only in the counter:
              // otherwise it is discoverable only by being rejected for it.
              helpText={
                isLate
                  ? `Tell us what happened and why you're requesting a refund. Up to ${REASON_TEXT_MAX} characters.`
                  : `Up to ${REASON_TEXT_MAX} characters.`
              }
              placeholder={
                isLate
                  ? "Share details to help our team review your request."
                  : "Tell us your reason"
              }
              inputProps={{ maxLength: REASON_TEXT_MAX }}
              value={formik.values.refund_reason_text}
              onChange={handleChange}
              error={Boolean(formik.errors.refund_reason_text)}
              errorText={formik.errors.refund_reason_text}
            />
            {isLate ? (
              // Announced only when it settles, so it does not interrupt on
              // every keystroke.
              <Counter aria-live="polite">
                {`${formik.values.refund_reason_text.length} / ${REASON_TEXT_MAX} characters`}
              </Counter>
            ) : null}
          </div>
        ) : null}

        <Field>
          <ConsentCheckbox
            name="consent_given"
            label={CONSENT_LABEL}
            checked={formik.values.consent_given}
            onChange={handleChange}
          />
          {formik.errors.consent_given ? (
            <ErrorText>{formik.errors.consent_given}</ErrorText>
          ) : null}
        </Field>

        {createRefundRequest.isError ? (
          <Alert severity="error">
            We could not submit your refund request. Please try again in a
            moment.
          </Alert>
        ) : null}
      </Body>
    </FormDialog>
  )
}

const RefundRequestDialog = NiceModal.create(RefundRequestDialogInner)

export { RefundRequestDialog, REFUND_REASONS, REASON_TEXT_MAX }
