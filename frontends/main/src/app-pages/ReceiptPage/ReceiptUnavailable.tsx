import React from "react"
import { Container, Typography, styled } from "ol-components"
import { ButtonLink } from "@mitodl/smoot-design"
import { env } from "@/env"
import * as urls from "@/common/urls"

const SUPPORT_EMAIL = env("NEXT_PUBLIC_MITOL_SUPPORT_EMAIL") || ""

const PageContainer = styled(Container)({
  paddingTop: "40px",
  paddingBottom: "80px",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "16px",
})

const SupportLink = styled.a(({ theme }) => ({
  color: theme.custom.colors.red,
  textDecoration: "none",
  ":hover": {
    textDecoration: "underline",
  },
}))

type Reason =
  /** We checked the order history and nothing paid for this run/program. */
  | "no-order"
  /** We could not reach the order history, so we do not know. */
  | "lookup-failed"

const COPY: Record<Reason, string> = {
  "no-order":
    "We couldn't find a receipt for this enrollment. Receipts are only available for enrollments you paid for directly — if your access came from a program purchase, an enrollment code, or your organization, the receipt is attached to that purchase instead.",
  "lookup-failed":
    "We couldn't load your order history, so we weren't able to find this receipt. Please try again in a moment.",
}

/**
 * Shown instead of a receipt when there is nothing to show.
 *
 * Deliberately not the generic 404 page: a learner arriving here followed a
 * "Receipt" link that looked valid, and "Looks like we couldn't find what you
 * were looking for!" gives them no way to tell a broken link from an enrollment
 * that legitimately has no receipt of its own.
 */
const ReceiptUnavailable: React.FC<{ reason: Reason }> = ({ reason }) => (
  <PageContainer>
    <Typography component="h1" variant="h3">
      Receipt
    </Typography>
    <Typography variant="body1">
      {COPY[reason]}{" "}
      {SUPPORT_EMAIL ? (
        <>
          Need help?{" "}
          <SupportLink href={`mailto:${SUPPORT_EMAIL}`}>
            Contact support
          </SupportLink>
          .
        </>
      ) : null}
    </Typography>
    <ButtonLink variant="secondary" href={urls.DASHBOARD_HOME}>
      Back to Dashboard
    </ButtonLink>
  </PageContainer>
)

export { ReceiptUnavailable }
export type { Reason as ReceiptUnavailableReason }
