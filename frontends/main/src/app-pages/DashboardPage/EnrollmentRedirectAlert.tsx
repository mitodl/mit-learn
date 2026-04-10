"use client"

import React from "react"
import { useQuery } from "@tanstack/react-query"
import { Alert } from "@mitodl/smoot-design"
import { Link } from "ol-components"
import { orderQueries } from "api/mitxonline-hooks/orders"
import { mitxUserQueries } from "api/mitxonline-hooks/user"
import { ENROLLMENT_ERROR_QUERY_PARAM } from "@/common/urls"
import {
  ENROLLMENT_TITLE_PARAM,
  ENROLLMENT_ORG_ID_PARAM,
  ORDER_STATUS_PARAM,
  ORDER_ID_PARAM,
} from "@/common/mitxonline"
import { useConsumeSearchParams } from "@/common/useConsumeSearchParams"

const CONSUMED_PARAMS = [
  ENROLLMENT_ERROR_QUERY_PARAM,
  ENROLLMENT_TITLE_PARAM,
  ENROLLMENT_ORG_ID_PARAM,
  ORDER_STATUS_PARAM,
  ORDER_ID_PARAM,
] as const

type AlertRequest =
  | { kind: "error" }
  | { kind: "free"; title: string | null; orgId: number | null }
  | { kind: "paid"; orderId: number }

const successCopy = (title: string) =>
  `You have successfully enrolled in ${title}. It has been added to My Learning.`

const genericSuccessCopy =
  "Your enrollment is confirmed. It has been added to My Learning."

const parseAlertRequest = (
  params: Record<(typeof CONSUMED_PARAMS)[number], string | null>,
): AlertRequest | null => {
  if (params[ENROLLMENT_ERROR_QUERY_PARAM]) {
    return { kind: "error" }
  }

  if (params[ORDER_STATUS_PARAM] === "fulfilled") {
    const orderId = params[ORDER_ID_PARAM]
      ? Number(params[ORDER_ID_PARAM])
      : Number.NaN
    if (Number.isFinite(orderId)) {
      return { kind: "paid", orderId }
    }
    // Malformed order_id: clean up params but don't show an alert
    return null
  }

  if (params[ENROLLMENT_TITLE_PARAM] !== null) {
    const rawOrgId = params[ENROLLMENT_ORG_ID_PARAM]
    const orgId = rawOrgId ? Number(rawOrgId) : null
    return {
      kind: "free",
      title: params[ENROLLMENT_TITLE_PARAM] || null,
      orgId: orgId !== null && Number.isFinite(orgId) ? orgId : null,
    }
  }

  return null
}

const EnrollmentRedirectAlert: React.FC = () => {
  const consumed = useConsumeSearchParams(CONSUMED_PARAMS)
  const supportEmail = process.env.NEXT_PUBLIC_MITOL_SUPPORT_EMAIL || ""

  const request = consumed ? parseAlertRequest(consumed) : null

  const hasOrgId = request?.kind === "free" && request.orgId !== null
  const mitxOnlineUserQuery = useQuery({
    ...mitxUserQueries.me(),
    enabled: hasOrgId,
  })
  const paidReceipt = useQuery({
    ...orderQueries.receipt(request?.kind === "paid" ? request.orderId : 0),
    enabled: request?.kind === "paid",
  })

  if (request?.kind === "error") {
    return (
      <Alert severity="error" closable label="Enrollment Error - ">
        The Enrollment Code is incorrect or no longer available.{" "}
        <Link color="red" href={`mailto:${supportEmail}`}>
          Contact Support
        </Link>{" "}
        for assistance.
      </Alert>
    )
  }

  if (request?.kind === "free") {
    if (request.orgId !== null && mitxOnlineUserQuery.isPending) {
      return null
    }

    const orgName =
      request.orgId === null
        ? null
        : (mitxOnlineUserQuery.data?.b2b_organizations.find(
            (org) => org.id === request.orgId,
          )?.name ?? null)

    if (request.title) {
      const title = orgName ? `${request.title} from ${orgName}` : request.title
      return <Alert severity="success">{successCopy(title)}</Alert>
    }

    return <Alert severity="success">{genericSuccessCopy}</Alert>
  }

  if (request?.kind === "paid" && paidReceipt.isSuccess) {
    const line = paidReceipt.data.lines[0]
    const title = line?.item_description || line?.product.description || null

    return (
      <Alert severity="success">
        {title ? successCopy(title) : genericSuccessCopy}
      </Alert>
    )
  }

  if (request?.kind === "paid" && paidReceipt.isError) {
    return <Alert severity="success">{genericSuccessCopy}</Alert>
  }

  return null
}

export default EnrollmentRedirectAlert
