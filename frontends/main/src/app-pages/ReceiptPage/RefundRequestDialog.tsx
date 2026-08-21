import React from "react"
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

const CONSENT_LABEL =
  "I understand that my grades and progress towards a certificate will be removed after the refund is processed."

type FormValues = {
  refund_reason: RefundReasonEnum | ""
  refund_reason_text: string
  consent_given: boolean
}

/** The design marks required fields with a red asterisk after the label. */
const Required = styled.span(({ theme }) => ({
  color: theme.custom.colors.red,
}))

const Field = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "4px",
})

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
  if ((isLate || values.refund_reason === RefundReasonEnum.Other) && !text) {
    errors.refund_reason_text = "Please tell us why you're requesting a refund."
  }
  if (text.length > REASON_TEXT_MAX) {
    errors.refund_reason_text = `Please keep this under ${REASON_TEXT_MAX} characters.`
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
}

const RefundRequestDialogInner: React.FC<RefundRequestDialogProps> = ({
  order,
  title,
  isLate,
}) => {
  const modal = NiceModal.useModal()
  const createRefundRequest = useCreateRefundRequest()

  /**
   * Refunding usually drops the learner to the audit track, but some courses
   * have none and disappear from the dashboard instead. Assume the harsher
   * outcome if the order somehow has no line, rather than promising access
   * that may not survive the refund.
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
          refund_reason_text: values.refund_reason_text.trim(),
          consent_given: values.consent_given,
        },
        { onSuccess: () => modal.hide() },
      )
    },
  })

  const showReasonText =
    isLate || formik.values.refund_reason === RefundReasonEnum.Other

  return (
    <FormDialog
      title={isLate ? "Request refund review" : "Request refund"}
      fullWidth
      onReset={formik.resetForm}
      onSubmit={formik.handleSubmit}
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
      <Body>
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

        {isLate ? null : (
          <Field>
            <Reasons
              name="refund_reason"
              label={
                <>
                  Reason for refund request <Required aria-hidden>*</Required>
                </>
              }
              choices={REFUND_REASONS}
              value={formik.values.refund_reason}
              onChange={formik.handleChange}
            />
            <Description error={Boolean(formik.errors.refund_reason)}>
              {formik.errors.refund_reason ??
                "Select the main reason you're requesting a refund."}
            </Description>
          </Field>
        )}

        {showReasonText ? (
          <div>
            <TextField
              fullWidth
              multiline={isLate}
              minRows={isLate ? 4 : undefined}
              name="refund_reason_text"
              // The asterisk is rendered rather than set via `required`: that
              // would mark the input required to the browser, whose native
              // validation blocks submit before formik can report anything.
              label={
                <>
                  {isLate ? "Reason for request" : "Please Specify"}{" "}
                  <Required aria-hidden>*</Required>
                </>
              }
              helpText={
                isLate
                  ? "Tell us what happened and why you're requesting a refund"
                  : undefined
              }
              placeholder={
                isLate
                  ? "Share details to help our team review your request."
                  : "Tell us your reason"
              }
              value={formik.values.refund_reason_text}
              onChange={formik.handleChange}
              error={Boolean(formik.errors.refund_reason_text)}
              errorText={formik.errors.refund_reason_text}
            />
            {isLate ? (
              <Counter aria-hidden>
                {`${formik.values.refund_reason_text.length} / ${REASON_TEXT_MAX}`}
              </Counter>
            ) : null}
          </div>
        ) : null}

        <Field>
          <Checkbox
            name="consent_given"
            label={CONSENT_LABEL}
            checked={formik.values.consent_given}
            onChange={formik.handleChange}
          />
          {formik.errors.consent_given ? (
            <Description error>{formik.errors.consent_given}</Description>
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
