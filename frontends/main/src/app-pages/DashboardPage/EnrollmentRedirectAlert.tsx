"use client"

import React from "react"
import { useQuery } from "@tanstack/react-query"
import { Alert } from "@mitodl/smoot-design"
import { Link } from "ol-components"
import { useSearchParams } from "next/navigation"
import { useRouter } from "next-nprogress-bar"
import { orderQueries } from "api/mitxonline-hooks/orders"
import { mitxUserQueries } from "api/mitxonline-hooks/user"
import { ENROLLMENT_ERROR_QUERY_PARAM } from "@/common/urls"
import {
  ENROLLMENT_TITLE_PARAM,
  ENROLLMENT_ORG_ID_PARAM,
} from "@/common/mitxonline"

type AlertRequest =
  | { kind: "error" }
  | { kind: "free"; title: string | null; orgId: number | null }
  | { kind: "paid"; orderId: number }

const successCopy = (title: string) =>
  `You have successfully enrolled in ${title}. It has been added to My Learning.`

const genericSuccessCopy =
  "Your enrollment is confirmed. It has been added to My Learning."

const EnrollmentRedirectAlert: React.FC = () => {
  const searchParams = useSearchParams()
  const router = useRouter()
  const supportEmail = process.env.NEXT_PUBLIC_MITOL_SUPPORT_EMAIL || ""
  const [request, setRequest] = React.useState<AlertRequest | null>(null)
  const processed = React.useRef(false)

  React.useEffect(() => {
    if (processed.current) return

    const enrollmentError = searchParams.get(ENROLLMENT_ERROR_QUERY_PARAM)
    const enrollmentTitle = searchParams.get(ENROLLMENT_TITLE_PARAM)
    const orderStatus = searchParams.get("order_status")
    const orderId = searchParams.get("order_id")
    const parsedOrderId = orderId ? Number(orderId) : Number.NaN
    const rawOrgId = searchParams.get(ENROLLMENT_ORG_ID_PARAM)
    const orgId = rawOrgId ? Number(rawOrgId) : null

    if (enrollmentError) {
      setRequest({ kind: "error" })
    } else if (orderStatus === "fulfilled") {
      if (Number.isFinite(parsedOrderId)) {
        setRequest({ kind: "paid", orderId: parsedOrderId })
      }
    } else if (enrollmentTitle !== null) {
      setRequest({
        kind: "free",
        title: enrollmentTitle || null,
        orgId: orgId !== null && Number.isFinite(orgId) ? orgId : null,
      })
    } else {
      return
    }

    processed.current = true

    const newParams = new URLSearchParams(searchParams.toString())
    newParams.delete(ENROLLMENT_ERROR_QUERY_PARAM)
    newParams.delete(ENROLLMENT_TITLE_PARAM)
    newParams.delete(ENROLLMENT_ORG_ID_PARAM)
    newParams.delete("order_status")
    newParams.delete("order_id")

    const newUrl = newParams.toString()
      ? `${window.location.pathname}?${newParams.toString()}`
      : window.location.pathname

    router.replace(newUrl)
  }, [router, searchParams])

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
