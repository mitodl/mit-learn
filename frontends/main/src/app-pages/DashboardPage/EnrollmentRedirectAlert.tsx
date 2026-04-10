"use client"

import React from "react"
import { useQuery } from "@tanstack/react-query"
import { Alert } from "@mitodl/smoot-design"
import { Link, styled } from "ol-components"
import { orderQueries } from "api/mitxonline-hooks/orders"
import { mitxUserQueries } from "api/mitxonline-hooks/user"
import { DASHBOARD_MY_LEARNING } from "@/common/urls"
import {
  ENROLLMENT_ERROR_PARAM,
  ENROLLMENT_TITLE_PARAM,
  ENROLLMENT_ORG_ID_PARAM,
  ORDER_STATUS_PARAM,
  ORDER_ID_PARAM,
} from "@/common/mitxonline"
import { useConsumeInitialSearchParams } from "@/common/useConsumeInitialSearchParams"

const CONSUMED_PARAMS = [
  ENROLLMENT_ERROR_PARAM,
  ENROLLMENT_TITLE_PARAM,
  ENROLLMENT_ORG_ID_PARAM,
  ORDER_STATUS_PARAM,
  ORDER_ID_PARAM,
] as const

type AlertRequest =
  | { kind: "error" }
  | { kind: "free"; title: string | null }
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
    You have successfully enrolled in "<BoldTitle>{title}</BoldTitle>". It has
    been added to <MyLearningLink />.
  </>
)

const B2bSuccessCopy: React.FC<{ title: string; orgName: string }> = ({
  title,
  orgName,
}) => (
  <>
    You have been enrolled in "<BoldTitle>{title}</BoldTitle>" by {orgName}. It
    has been added to <MyLearningLink />.
  </>
)

const GenericSuccessCopy: React.FC = () => (
  <>
    Your enrollment is confirmed. It has been added to <MyLearningLink />.
  </>
)

const parseAlertRequest = (
  params: Record<(typeof CONSUMED_PARAMS)[number], string | null>,
): AlertRequest | null => {
  if (params[ENROLLMENT_ERROR_PARAM]) {
    return { kind: "error" }
  }

  if (params[ORDER_STATUS_PARAM] === "fulfilled") {
    const orderId = params[ORDER_ID_PARAM]
      ? Number(params[ORDER_ID_PARAM])
      : Number.NaN
    if (Number.isFinite(orderId)) {
      return { kind: "paid", orderId }
    }
    console.warn(
      "Malformed enrollment redirect: order_status=fulfilled but order_id is not a valid number",
      params[ORDER_ID_PARAM],
    )
    return null
  }

  if (params[ENROLLMENT_TITLE_PARAM] !== null) {
    const rawOrgId = params[ENROLLMENT_ORG_ID_PARAM]
    const orgId = rawOrgId ? Number(rawOrgId) : null
    const title = params[ENROLLMENT_TITLE_PARAM] || null

    if (title && orgId !== null && Number.isFinite(orgId)) {
      return { kind: "b2b", title, orgId }
    }
    return { kind: "free", title }
  }

  return null
}

const EnrollmentRedirectAlert: React.FC = () => {
  const consumed = useConsumeInitialSearchParams(CONSUMED_PARAMS)
  const supportEmail = process.env.NEXT_PUBLIC_MITOL_SUPPORT_EMAIL || ""

  const request = consumed ? parseAlertRequest(consumed) : null

  const mitxOnlineUserQuery = useQuery({
    ...mitxUserQueries.me(),
    enabled: request?.kind === "b2b",
  })
  const paidReceipt = useQuery({
    ...orderQueries.receipt(request?.kind === "paid" ? request.orderId : 0),
    enabled: request?.kind === "paid",
  })

  if (request?.kind === "error") {
    return (
      <Alert severity="error" closable label="Enrollment Error - ">
        The Enrollment Code is incorrect or no longer available.{" "}
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
        {request.title ? (
          <FreeSuccessCopy title={request.title} />
        ) : (
          <GenericSuccessCopy />
        )}
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

    return (
      <Alert severity="success" label="Success!">
        {orgName ? (
          <B2bSuccessCopy title={request.title} orgName={orgName} />
        ) : (
          <FreeSuccessCopy title={request.title} />
        )}
      </Alert>
    )
  }

  if (request?.kind === "paid" && paidReceipt.isSuccess) {
    const line = paidReceipt.data.lines[0]
    const title = line?.item_description || line?.product.description || null

    return (
      <Alert severity="success">
        {title ? <FreeSuccessCopy title={title} /> : <GenericSuccessCopy />}
      </Alert>
    )
  }

  if (request?.kind === "paid" && paidReceipt.isError) {
    return (
      <Alert severity="success">
        <GenericSuccessCopy />
      </Alert>
    )
  }

  return null
}

export default EnrollmentRedirectAlert
