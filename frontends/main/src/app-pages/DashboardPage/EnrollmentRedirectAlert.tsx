"use client"

import { env } from "@/env"
import React from "react"
import { useQuery } from "@tanstack/react-query"
import { Alert } from "@mitodl/smoot-design"
import { Link, Skeleton, styled } from "ol-components"
import { orderQueries } from "api/mitxonline-hooks/orders"
import { mitxUserQueries } from "api/mitxonline-hooks/user"
import { DASHBOARD_MY_LEARNING } from "@/common/urls"
import { analytics } from "@/common/analytics"
import {
  ENROLLMENT_STATUS_PARAM,
  ENROLLMENT_ERROR_TYPE_PARAM,
  ENROLLMENT_TITLE_PARAM,
  ENROLLMENT_ORG_ID_PARAM,
  ORDER_STATUS_PARAM,
  ORDER_ID_PARAM,
  EnrollmentAlertStatus,
  EnrollmentErrorType,
  EnrollmentErrorTypeValue,
  OrderAlertStatus,
} from "@/common/mitxonline"
import {
  useConsumeSearchParamsOnce,
  type ConsumedSearchParamsResult,
} from "@/common/useConsumeSearchParamsOnce"
import type { RegisteredSearchParams } from "@/common/searchParams"

type AlertRequest =
  | { kind: "error"; errorType: string | null }
  | { kind: "free"; title: string }
  | { kind: "b2b"; title: string; orgId: number }
  | { kind: "paid"; orderId: number }
  | { kind: "paymentProcessing" }
  | { kind: "paymentError"; copy: ErrorAlertCopy }

type ErrorAlertCopy = {
  label: string
  message: string
  /** Whether to follow the message with a "Contact Support" link. */
  contactSupport: boolean
}

const GENERIC_ENROLLMENT_ERROR: ErrorAlertCopy = {
  label: "Enrollment Error - ",
  message: "Something went wrong processing your enrollment.",
  contactSupport: true,
}

/**
 * Copy for each known `error_type`. Unknown types get GENERIC_ENROLLMENT_ERROR.
 * The MITx Online types mirror the text MITx Online shows for the same
 * message on its own pages.
 */
const ENROLLMENT_ERROR_COPY: Record<EnrollmentErrorTypeValue, ErrorAlertCopy> =
  {
    [EnrollmentErrorType.INVALID_ENROLLMENT_CODE]: {
      label: "Enrollment Error - ",
      message: "The Enrollment Code is incorrect or no longer available.",
      contactSupport: true,
    },
    [EnrollmentErrorType.ENROLL_FAILED]: GENERIC_ENROLLMENT_ERROR,
    [EnrollmentErrorType.ENROLL_BLOCKED]: {
      label: "Enrollment Error - ",
      message:
        "We're sorry, your country is currently blocked from enrolling in this course.",
      contactSupport: false,
    },
    [EnrollmentErrorType.ENROLL_DUPLICATED]: {
      label: "Enrollment Error - ",
      message: "You are already enrolled in this course.",
      contactSupport: true,
    },
    [EnrollmentErrorType.PAYMENT_ERROR_UNKNOWN]: {
      label: "Payment Error - ",
      message: "Something went wrong completing your order.",
      contactSupport: true,
    },
  }

/**
 * Copy for an `order_status` that says the payment did not go through.
 */
type OrderAlertStatusValue =
  (typeof OrderAlertStatus)[keyof typeof OrderAlertStatus]

const PAYMENT_ERROR_COPY: Partial<
  Record<OrderAlertStatusValue, ErrorAlertCopy>
> = {
  [OrderAlertStatus.DECLINED]: {
    label: "Payment Error - ",
    message: "Your payment was declined. Please try again.",
    contactSupport: false,
  },
  [OrderAlertStatus.CANCELED]: {
    label: "Payment Error - ",
    message: "Your payment was cancelled.",
    contactSupport: false,
  },
  [OrderAlertStatus.ERRORED]: {
    label: "Payment Error - ",
    message: "There was an error processing your payment. Please try again.",
    contactSupport: true,
  },
}

/**
 * Look up copy by a value read from the URL. Only own keys count, so a param
 * like `error_type=constructor` can't match an Object.prototype member.
 */
const lookupCopy = (
  table: Record<string, ErrorAlertCopy>,
  key: string | null,
): ErrorAlertCopy | undefined =>
  key !== null && Object.hasOwn(table, key) ? table[key] : undefined

const PAYMENT_PROCESSING_STATUSES: string[] = [
  OrderAlertStatus.PENDING,
  OrderAlertStatus.REVIEW,
]

const BoldTitle = styled.strong(({ theme }) => ({
  fontWeight: theme.typography.fontWeightBold,
}))

const UnderlinedLink = styled(Link)({
  textDecoration: "underline",
})

const MyLearningLink: React.FC = () => (
  <UnderlinedLink color="red" href={DASHBOARD_MY_LEARNING}>
    My Learning
  </UnderlinedLink>
)

const FreeSuccessCopy: React.FC<{ title: string }> = ({ title }) => (
  <>
    You've been enrolled in "<BoldTitle>{title}</BoldTitle>". It has been added
    to <MyLearningLink />.
  </>
)

const PaidSuccessCopy: React.FC<{ title: string }> = ({ title }) => (
  <>
    You've enrolled in the certificate track for "<BoldTitle>{title}</BoldTitle>
    ". It has been added to <MyLearningLink />.
  </>
)

const B2bSuccessCopy: React.FC<{ title: string; orgName: string }> = ({
  title,
  orgName,
}) => (
  <>
    As a member of <BoldTitle>{orgName}</BoldTitle>, you have been enrolled in "
    <BoldTitle>{title}</BoldTitle>".
  </>
)

const PaidGenericSuccessCopy: React.FC = () => (
  <>
    Your certificate track enrollment is confirmed. It has been added to{" "}
    <MyLearningLink />.
  </>
)

const ErrorAlert: React.FC<{ copy: ErrorAlertCopy; supportEmail: string }> = ({
  copy,
  supportEmail,
}) => (
  <Alert severity="error" closable label={copy.label}>
    {copy.message}
    {copy.contactSupport ? (
      <>
        {" "}
        <UnderlinedLink color="red" href={`mailto:${supportEmail}`}>
          Contact Support
        </UnderlinedLink>{" "}
        for assistance.
      </>
    ) : null}
  </Alert>
)

/**
 * Renders a skeleton that matches the height of a single-line Alert.
 * MUI Skeleton with children infers dimensions from the (hidden) child.
 */
const AlertPlaceholder: React.FC<{ severity: "success" | "error" }> = ({
  severity,
}) => (
  <Skeleton variant="rounded" width="100%">
    <Alert severity={severity}>&nbsp;</Alert>
  </Skeleton>
)

const parseAlertRequest = (
  searchParams: RegisteredSearchParams,
): ConsumedSearchParamsResult<AlertRequest> | null => {
  const enrollmentStatus = searchParams.get(ENROLLMENT_STATUS_PARAM)

  if (enrollmentStatus === EnrollmentAlertStatus.ERROR) {
    return {
      value: {
        kind: "error",
        errorType: searchParams.get(ENROLLMENT_ERROR_TYPE_PARAM),
      },
      keysToRemove: [ENROLLMENT_STATUS_PARAM, ENROLLMENT_ERROR_TYPE_PARAM],
    }
  }

  const orderStatus = searchParams.get(ORDER_STATUS_PARAM)

  if (orderStatus === OrderAlertStatus.FULFILLED) {
    const rawOrderId = searchParams.get(ORDER_ID_PARAM)
    const orderId = rawOrderId ? Number(rawOrderId) : Number.NaN
    if (Number.isFinite(orderId)) {
      return {
        value: { kind: "paid", orderId },
        keysToRemove: [ORDER_STATUS_PARAM, ORDER_ID_PARAM],
      }
    }
    console.warn(
      "Malformed enrollment redirect: order_status=fulfilled but order_id is not a valid number",
      rawOrderId,
    )
    return {
      value: undefined,
      keysToRemove: [ORDER_STATUS_PARAM, ORDER_ID_PARAM],
    }
  }

  if (orderStatus) {
    const keysToRemove = [ORDER_STATUS_PARAM, ORDER_ID_PARAM] as const
    if (PAYMENT_PROCESSING_STATUSES.includes(orderStatus)) {
      return { value: { kind: "paymentProcessing" }, keysToRemove }
    }
    const paymentErrorCopy = lookupCopy(PAYMENT_ERROR_COPY, orderStatus)
    if (paymentErrorCopy) {
      return {
        value: { kind: "paymentError", copy: paymentErrorCopy },
        keysToRemove,
      }
    }
    console.warn("Unrecognized order_status in redirect:", orderStatus)
    return { value: undefined, keysToRemove }
  }

  if (enrollmentStatus === EnrollmentAlertStatus.SUCCESS) {
    const title = searchParams.get(ENROLLMENT_TITLE_PARAM)
    if (!title) {
      console.warn(
        "enrollment_status=success without enrollment_title — not showing alert",
      )
      return {
        value: undefined,
        keysToRemove: [
          ENROLLMENT_STATUS_PARAM,
          ENROLLMENT_TITLE_PARAM,
          ENROLLMENT_ORG_ID_PARAM,
        ],
      }
    }

    const rawOrgId = searchParams.get(ENROLLMENT_ORG_ID_PARAM)
    if (!rawOrgId) {
      return {
        value: { kind: "free", title },
        keysToRemove: [ENROLLMENT_STATUS_PARAM, ENROLLMENT_TITLE_PARAM],
      }
    }

    const orgId = Number(rawOrgId)
    if (!Number.isFinite(orgId)) {
      console.warn("Malformed enrollment_org_id param:", rawOrgId)
      return {
        value: { kind: "error", errorType: null },
        keysToRemove: [
          ENROLLMENT_STATUS_PARAM,
          ENROLLMENT_TITLE_PARAM,
          ENROLLMENT_ORG_ID_PARAM,
        ],
      }
    }
    return {
      value: { kind: "b2b", title, orgId },
      keysToRemove: [
        ENROLLMENT_STATUS_PARAM,
        ENROLLMENT_TITLE_PARAM,
        ENROLLMENT_ORG_ID_PARAM,
      ],
    }
  }

  return null
}

const EnrollmentRedirectAlert: React.FC = () => {
  const request = useConsumeSearchParamsOnce(parseAlertRequest)
  const supportEmail = env("NEXT_PUBLIC_MITOL_SUPPORT_EMAIL") || ""

  const mitxOnlineUserQuery = useQuery({
    ...mitxUserQueries.me(),
    enabled: request?.kind === "b2b",
  })
  const paidReceipt = useQuery({
    ...orderQueries.receipt(request?.kind === "paid" ? request.orderId : 0),
    enabled: request?.kind === "paid",
  })

  const checkoutCompletedTracked = React.useRef(false)
  React.useEffect(() => {
    if (request?.kind !== "paid") return
    if (paidReceipt.isPending) return
    if (checkoutCompletedTracked.current) return
    checkoutCompletedTracked.current = true

    const parsedValue = paidReceipt.data
      ? Number(paidReceipt.data.total_price_paid)
      : NaN

    const courseName = paidReceipt.data?.lines[0]?.content_title
    const value = Number.isNaN(parsedValue) ? null : parsedValue

    const line = paidReceipt.data?.lines[0]
    analytics.checkoutCompleted({
      orderId: request.orderId,
      courseName,
      value,
      readableId: line?.readable_id,
      contentType: line?.content_type,
    })
  }, [request, paidReceipt.isPending, paidReceipt.data])

  if (request?.kind === "error") {
    const copy =
      lookupCopy(ENROLLMENT_ERROR_COPY, request.errorType) ??
      GENERIC_ENROLLMENT_ERROR
    return <ErrorAlert copy={copy} supportEmail={supportEmail} />
  }

  if (request?.kind === "paymentError") {
    return <ErrorAlert copy={request.copy} supportEmail={supportEmail} />
  }

  if (request?.kind === "paymentProcessing") {
    return (
      <Alert severity="success" label="Thank you!">
        Your payment is being processed. Your enrollment will be updated once it
        is complete.
      </Alert>
    )
  }

  if (request?.kind === "free") {
    return (
      <Alert severity="success" label="Success!">
        <FreeSuccessCopy title={request.title} />
      </Alert>
    )
  }

  if (request?.kind === "b2b") {
    if (mitxOnlineUserQuery.isPending) {
      return <AlertPlaceholder severity="success" />
    }

    const orgName = mitxOnlineUserQuery.data?.b2b_organizations.find(
      (org) => org.id === request.orgId,
    )?.name

    if (!orgName) {
      return (
        <ErrorAlert
          copy={GENERIC_ENROLLMENT_ERROR}
          supportEmail={supportEmail}
        />
      )
    }

    return (
      <Alert severity="success" label="Success!">
        <B2bSuccessCopy title={request.title} orgName={orgName} />
      </Alert>
    )
  }

  if (request?.kind === "paid") {
    if (paidReceipt.isPending) {
      return <AlertPlaceholder severity="success" />
    }

    if (paidReceipt.isError) {
      return (
        <Alert severity="success" label="Success!">
          <PaidGenericSuccessCopy />
        </Alert>
      )
    }

    const title = paidReceipt.data?.lines[0]?.content_title
    return (
      <Alert severity="success" label="Success!">
        {title ? <PaidSuccessCopy title={title} /> : <PaidGenericSuccessCopy />}
      </Alert>
    )
  }

  return null
}

export default EnrollmentRedirectAlert
