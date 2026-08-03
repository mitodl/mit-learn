"use client"

import React from "react"
import { useRouter } from "next-nprogress-bar"
import { Container, Skeleton, styled } from "ol-components"
import * as urls from "@/common/urls"
import { ReceiptUnavailable } from "./ReceiptUnavailable"
import {
  useOrderIdForProgram,
  useOrderIdForRun,
} from "@/common/mitxonline/useOrderIdForResource"
import type { OrderIdResolution } from "@/common/mitxonline/useOrderIdForResource"

const PageContainer = styled(Container)({
  paddingTop: "40px",
  paddingBottom: "80px",
  display: "flex",
  flexDirection: "column",
  gap: "16px",
})

/**
 * Resolves a course run or program to the order that paid for it, then replaces
 * the current history entry with that order's receipt.
 *
 * This mirrors MITx Online's `ReceiptByRunView` / `ReceiptByProgramView`, which
 * exist because enrollment payloads do not carry the paying order. `replace` (not
 * `push`) is used so "Back" from the receipt returns to wherever the learner came
 * from rather than bouncing through this route again.
 */
const ReceiptRedirect: React.FC<{ resolution: OrderIdResolution }> = ({
  resolution,
}) => {
  const router = useRouter()
  const { isPending, isError, orderId } = resolution

  React.useEffect(() => {
    if (orderId !== null) {
      router.replace(urls.receiptView(orderId))
    }
  }, [orderId, router])

  if (isPending || orderId !== null) {
    return (
      <PageContainer>
        <Skeleton variant="text" width="30%" height={36} />
        <Skeleton variant="rectangular" width="100%" height={280} />
      </PageContainer>
    )
  }

  /**
   * A verified enrollment does not imply an order of its own: MITx Online also
   * marks runs verified when the learner bought the enclosing program, redeemed a
   * B2B enrollment code, or was upgraded administratively. In all of those cases
   * `PaidCourseRun` is absent and there is no run-level receipt — MITx Online's
   * own `ReceiptByRunView` 404s identically.
   */
  return <ReceiptUnavailable reason={isError ? "lookup-failed" : "no-order"} />
}

const ReceiptByRunRedirect: React.FC<{ runId: number }> = ({ runId }) => {
  const resolution = useOrderIdForRun(runId)
  return <ReceiptRedirect resolution={resolution} />
}

const ReceiptByProgramRedirect: React.FC<{ programId: number }> = ({
  programId,
}) => {
  const resolution = useOrderIdForProgram(programId)
  return <ReceiptRedirect resolution={resolution} />
}

export { ReceiptRedirect, ReceiptByRunRedirect, ReceiptByProgramRedirect }
