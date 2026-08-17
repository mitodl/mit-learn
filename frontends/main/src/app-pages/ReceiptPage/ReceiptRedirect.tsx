"use client"

import React from "react"
import { useRouter } from "next-nprogress-bar"
import { Container, Skeleton, styled } from "ol-components"
import { VisuallyHidden } from "@mitodl/smoot-design"
import * as urls from "@/common/urls"
import NotFoundPage from "@/app-pages/ErrorPage/NotFoundPage"
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
 * Resolves a course run or program to its order, then replaces the history entry
 * with that order's receipt. `replace`, not `push`, so "Back" from the receipt
 * skips this route. Mirrors MITx Online's `ReceiptByRunView`.
 */
const ReceiptRedirect: React.FC<{ resolution: OrderIdResolution }> = ({
  resolution,
}) => {
  const router = useRouter()
  const { isPending, orderId } = resolution

  React.useEffect(() => {
    if (orderId !== null) {
      router.replace(urls.receiptView(orderId))
    }
  }, [orderId, router])

  if (isPending || orderId !== null) {
    return (
      <PageContainer>
        {/* Skeletons carry no ARIA, and this route only ever shows them. */}
        <VisuallyHidden role="status" aria-live="polite" aria-atomic="true">
          {isPending ? "Loading receipt." : "Receipt found. Redirecting."}
        </VisuallyHidden>
        <Skeleton variant="text" width="30%" height={36} />
        <Skeleton variant="rectangular" width="100%" height={280} />
      </PageContainer>
    )
  }

  /**
   * No order covers this run/program, or the lookup failed. Generic 404 for both,
   * so a prober cannot tell a well-formed id from an unresolvable one.
   */
  return <NotFoundPage />
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
