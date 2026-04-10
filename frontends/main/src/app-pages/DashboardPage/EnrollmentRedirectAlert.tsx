"use client"

import React from "react"
import { useQuery } from "@tanstack/react-query"
import { Alert } from "@mitodl/smoot-design"
import { Link, styled } from "ol-components"
import { orderQueries } from "api/mitxonline-hooks/orders"
import { mitxUserQueries } from "api/mitxonline-hooks/user"
import { DASHBOARD_MY_LEARNING } from "@/common/urls"
import {
  ENROLLMENT_STATUS_PARAM,
  ENROLLMENT_ERROR_TYPE_PARAM,
  ENROLLMENT_TITLE_PARAM,
  ENROLLMENT_ORG_ID_PARAM,
  ORDER_STATUS_PARAM,
  ORDER_ID_PARAM,
  EnrollmentAlertStatus,
  EnrollmentErrorType,
} from "@/common/mitxonline"
import {
  useConsumeSearchParamsOnce,
  type ConsumedSearchParamsResult,
} from "@/common/useConsumeSearchParamsOnce"

type AlertRequest =
  | { kind: "error"; errorType: string | null }
  | { kind: "free"; title: string }
  | { kind: "b2b"; title: string; orgId: number }
  | { kind: "paid"; orderId: number }

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
    You've enrolled in "<BoldTitle>{title}</BoldTitle>". It has been added to{" "}
    <MyLearningLink />.
  </>
)

const PaidSuccessCopy: React.FC<{ title: string }> = ({ title }) => (
  <>
    You've enrolled in "<BoldTitle>{title}</BoldTitle>". It has been added to{" "}
    <MyLearningLink />.
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

const GenericSuccessCopy: React.FC = () => (
  <>
    Your enrollment is confirmed. It has been added to <MyLearningLink />.
  </>
)

const parseAlertRequest = (
  searchParams: URLSearchParams,
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

  if (searchParams.get(ORDER_STATUS_PARAM) === "fulfilled") {
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
  const supportEmail = process.env.NEXT_PUBLIC_MITOL_SUPPORT_EMAIL || ""

  const mitxOnlineUserQuery = useQuery({
    ...mitxUserQueries.me(),
    enabled: request?.kind === "b2b",
  })
  const paidReceipt = useQuery({
    ...orderQueries.receipt(request?.kind === "paid" ? request.orderId : 0),
    enabled: request?.kind === "paid",
  })

  if (request?.kind === "error") {
    const errorMessage =
      request.errorType === EnrollmentErrorType.INVALID_ENROLLMENT_CODE
        ? "The Enrollment Code is incorrect or no longer available."
        : "Something went wrong processing your enrollment."

    return (
      <Alert severity="error" closable label="Enrollment Error - ">
        {errorMessage}{" "}
        <UnderlinedLink color="red" href={`mailto:${supportEmail}`}>
          Contact Support
        </UnderlinedLink>{" "}
        for assistance.
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
      return null
    }

    const orgName = mitxOnlineUserQuery.data?.b2b_organizations.find(
      (org) => org.id === request.orgId,
    )?.name

    if (!orgName) {
      return (
        <Alert severity="error" closable label="Enrollment Error - ">
          Something went wrong processing your enrollment.{" "}
          <UnderlinedLink color="red" href={`mailto:${supportEmail}`}>
            Contact Support
          </UnderlinedLink>{" "}
          for assistance.
        </Alert>
      )
    }

    return (
      <Alert severity="success" label="Success!">
        <B2bSuccessCopy title={request.title} orgName={orgName} />
      </Alert>
    )
  }

  if (request?.kind === "paid" && paidReceipt.isSuccess) {
    const title = paidReceipt.data.lines[0]?.content_title

    return (
      <Alert severity="success" label="Success!">
        {title ? <PaidSuccessCopy title={title} /> : <GenericSuccessCopy />}
      </Alert>
    )
  }

  if (request?.kind === "paid" && paidReceipt.isError) {
    return (
      <Alert severity="success" label="Success!">
        <GenericSuccessCopy />
      </Alert>
    )
  }

  return null
}

export default EnrollmentRedirectAlert
