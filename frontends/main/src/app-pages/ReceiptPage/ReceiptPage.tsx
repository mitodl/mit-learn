"use client"

import React from "react"
import Image from "next/image"
import { useRouter } from "next-nprogress-bar"
import { useQuery } from "@tanstack/react-query"
import { RiArrowLeftLine, RiPrinterLine } from "@remixicon/react"
import { Container, Skeleton, Typography, styled } from "ol-components"
import NiceModal from "@ebay/nice-modal-react"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { Alert, Button, ButtonLink, VisuallyHidden } from "@mitodl/smoot-design"
import { FeatureFlags } from "@/common/feature_flags"
import { orderQueries } from "api/mitxonline-hooks/orders"
import { mitxUserQueries } from "api/mitxonline-hooks/user"
import { RefundStatusEnum } from "@mitodl/mitxonline-api-axios/v2"
import type { Order } from "@mitodl/mitxonline-api-axios/v2"
import type { AxiosError } from "axios"
import NotFoundPage from "@/app-pages/ErrorPage/NotFoundPage"
import mitLearnLogo from "@/public/images/mit-learn-logo-black.svg"
import { env } from "@/env"
import * as urls from "@/common/urls"
import { ReceiptCard, ReceiptCardStack } from "./ReceiptCard"
import { ReceiptDetailList, populatedRows } from "./ReceiptDetailList"
import type { ReceiptDetail } from "./ReceiptDetailList"
import { ReceiptOrderSummary } from "./ReceiptOrderSummary"
import { ReceiptRefundCard } from "./ReceiptRefundCard"
import { RefundRequestDialog } from "./RefundRequestDialog"
import {
  formatDateRange,
  formatMoney,
  formatPaymentMethod,
  formatReceiptDate,
  formatStreetAddress,
  getDiscountCode,
} from "./receiptUtils"

const SUPPORT_EMAIL = env("NEXT_PUBLIC_MITOL_SUPPORT_EMAIL") || ""

/** MIT Learn's own details — not learner data, not from the API. */
const MIT_LEARN_ADDRESS =
  "600 Technology Square, NE49-2000, Cambridge, MA 02139 USA"

const Background = styled.div(({ theme }) => ({
  backgroundColor: theme.custom.colors.lightGray1,
  minHeight: "100%",
}))

const PageContainer = styled(Container)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "24px",
  paddingTop: "64px",
  paddingBottom: "64px",
  [theme.breakpoints.down("sm")]: {
    paddingTop: "32px",
    paddingBottom: "32px",
  },
}))

const TitleRow = styled.div({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
})

const PageHeading = styled.h1(({ theme }) => ({
  ...theme.typography.h3,
  color: theme.custom.colors.black,
  margin: 0,
  [theme.breakpoints.down("sm")]: theme.typography.h5,
}))

const Actions = styled.div(({ theme }) => ({
  display: "flex",
  gap: "32px",
  flexShrink: 0,
  [theme.breakpoints.down("sm")]: {
    gap: "16px",
  },
  // Neither button belongs in a printed receipt.
  "@media print": {
    display: "none",
  },
}))

/**
 * Two columns on desktop with the summary on the right; one column on mobile with
 * the summary first. The summary leads in the DOM so mobile needs no reordering,
 * and desktop places it explicitly in the second column.
 */
const Columns = styled.div(({ theme }) => ({
  display: "grid",
  gap: "40px",
  gridTemplateColumns: "minmax(0, 1fr)",
  alignItems: "start",
  [theme.breakpoints.up("md")]: {
    gridTemplateColumns: "minmax(0, 825fr) minmax(0, 411fr)",
  },
}))

const SummaryColumn = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "32px",
  [theme.breakpoints.up("md")]: {
    gridColumn: 2,
    gridRow: 1,
  },
  // The refund actions are not part of a printed receipt.
  "@media print": {
    gap: 0,
  },
}))

const PrintHiddenRefundCard = styled(ReceiptRefundCard)({
  "@media print": {
    display: "none",
  },
})

// Transient, so it has no place on a printed receipt.
const SubmittedAlert = styled(Alert)({
  "@media print": {
    display: "none",
  },
})

const DetailColumn = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  [theme.breakpoints.up("md")]: {
    gridColumn: 1,
    gridRow: 1,
  },
}))

const SectionHeading = styled.h2(({ theme }) => ({
  ...theme.typography.h5,
  color: theme.custom.colors.red,
  margin: 0,
  [theme.breakpoints.down("sm")]: theme.typography.subtitle1,
}))

const IssuerCard = styled(ReceiptCard)({
  padding: "32px",
})

const IssuerLogo = styled(Image)(({ theme }) => ({
  display: "block",
  alignSelf: "flex-start",
  width: "auto",
  height: "34px",
  [theme.breakpoints.down("sm")]: {
    height: "24px",
  },
}))

const SupportLink = styled.a(({ theme }) => ({
  color: theme.custom.colors.red,
  textDecoration: "none",
  ":hover": {
    textDecoration: "underline",
  },
}))

const ErrorState = styled.div({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "16px",
})

/**
 * One group of rows per line item, then the order-level rows. The design's "Tax"
 * and "HSN" rows are omitted — the payload has no such fields. "CEUs" is wired up
 * but MITx Online always returns null for it today.
 */
const getOrderDetailRows = (order: Order): ReceiptDetail[] => [
  ...order.lines.flatMap((line) => [
    { label: "Order Item:", value: line.content_title },
    { label: "Dates:", value: formatDateRange(line.start_date, line.end_date) },
    { label: "Product Number:", value: line.readable_id },
    { label: "CEUs:", value: line.CEUs },
    { label: "Unit Price:", value: formatMoney(line.price) },
    { label: "Quantity:", value: line.quantity },
    {
      label: "Discount:",
      value:
        Number(line.discount) > 0 ? `-${formatMoney(line.discount)}` : null,
    },
    {
      // Per-line total, as the MITx Online receipt shows. Omitted for a
      // single-line order, where it just restates the order total below.
      label: "Line Total:",
      value: order.lines.length > 1 ? formatMoney(line.total_paid) : null,
    },
  ]),
  { label: "Order Number:", value: order.reference_number },
  { label: "Order Date:", value: formatReceiptDate(order.created_on) },
  { label: "Discount Code:", value: getDiscountCode(order) },
  { label: "Total Paid:", value: formatMoney(order.total_price_paid) },
]

const ReceiptSkeleton: React.FC = () => (
  <DetailColumn>
    <Skeleton variant="rectangular" width="100%" height={280} />
    <Skeleton variant="rectangular" width="100%" height={120} />
  </DetailColumn>
)

const ReceiptPage: React.FC<{ orderId: number }> = ({ orderId }) => {
  const router = useRouter()
  const orderQuery = useQuery(orderQueries.receipt(orderId))
  /**
   * Undefined until the flags arrive, so the card stays hidden rather than
   * appearing and then vanishing for learners who should not see it.
   */
  const refundsEnabled = useFeatureFlagEnabled(FeatureFlags.SelfServiceRefunds)
  const [submitted, setSubmitted] = React.useState(false)
  /**
   * `Order.purchaser` has no name field. The endpoint only returns the requester's
   * own orders, so the logged-in user is the purchaser.
   */
  const userQuery = useQuery(mitxUserQueries.me())

  const order = orderQuery.data
  const user = userQuery.data

  /**
   * Filtered up front so a section with no rows can be dropped along with its
   * heading — zero-value orders have no payment or billing details at all.
   */
  const customerRows = order
    ? populatedRows([
        { label: "Name:", value: user?.name },
        { label: "Email:", value: user?.email },
        { label: "Address:", value: formatStreetAddress(order.street_address) },
      ])
    : []

  const paymentRows = order
    ? populatedRows([
        { label: "Name:", value: order.transactions?.name },
        // PayPal orders carry the payer's email instead of card details.
        { label: "Email:", value: order.transactions?.bill_to_email },
        { label: "Payment Method:", value: formatPaymentMethod(order) },
      ])
    : []

  /**
   * The endpoint is purchaser-scoped, so someone else's order 404s just like a
   * missing one. Both get the generic 404 so a prober cannot tell them apart.
   * Other failures keep the message below, since they say nothing about whether
   * the order exists.
   */
  const isNotFound =
    !orderQuery.isPending &&
    (orderQuery.error as AxiosError | null)?.response?.status === 404

  if (isNotFound) {
    return <NotFoundPage />
  }

  /**
   * `router.back()` is `history.back()`, which does nothing when the receipt is the
   * tab's only entry — a bookmarked or newly opened link. Real history is still
   * preferred, since it returns to the dashboard with its scroll position intact.
   */
  const handleBack = () => {
    if (window.history.length > 1) {
      router.back()
    } else {
      router.push(urls.DASHBOARD_HOME)
    }
  }

  /**
   * The heading and buttons render before the receipt does, and skeletons carry no
   * ARIA, so the swap needs announcing. Failure is left to `ErrorState`, which is
   * an assertive live region of its own.
   */
  const statusMessage = orderQuery.isPending
    ? "Loading receipt."
    : order
      ? "Receipt loaded."
      : null

  return (
    <Background>
      <PageContainer>
        <VisuallyHidden role="status" aria-live="polite" aria-atomic="true">
          {statusMessage}
        </VisuallyHidden>

        <TitleRow>
          <PageHeading>Receipt</PageHeading>
          <Actions>
            <Button
              variant="tertiary"
              startIcon={<RiArrowLeftLine />}
              onClick={handleBack}
            >
              Back
            </Button>
            <Button
              variant="tertiary"
              startIcon={<RiPrinterLine />}
              onClick={() => window.print()}
            >
              Print
            </Button>
          </Actions>
        </TitleRow>

        {orderQuery.isPending ? (
          <ReceiptSkeleton />
        ) : orderQuery.isError || !order ? (
          <ErrorState role="alert">
            <Typography variant="body1">
              We could not load this receipt.{" "}
              {SUPPORT_EMAIL ? (
                <>
                  <SupportLink href={`mailto:${SUPPORT_EMAIL}`}>
                    Contact support
                  </SupportLink>{" "}
                  if the problem persists.
                </>
              ) : (
                "Please try again in a moment."
              )}
            </Typography>
            <ButtonLink variant="secondary" href={urls.DASHBOARD_HOME}>
              Back to Dashboard
            </ButtonLink>
          </ErrorState>
        ) : (
          <Columns>
            <SummaryColumn>
              {/*
               * Deliberately promises no email: the only notification
               * mitxonline sends on a request goes to customer service, not the
               * learner. The refund panel below is where they can follow it.
               */}
              {submitted ? (
                <SubmittedAlert
                  severity="success"
                  label="Request submitted"
                  closable
                  onClose={() => setSubmitted(false)}
                >
                  We've received your refund request. You can follow its status
                  in the Refund panel below.
                </SubmittedAlert>
              ) : null}
              <ReceiptOrderSummary order={order} />
              {refundsEnabled ? (
                <PrintHiddenRefundCard
                  order={order}
                  onRequestRefund={() =>
                    NiceModal.show(RefundRequestDialog, {
                      onSubmitted: () => setSubmitted(true),
                      order,
                      // One line per order in practice; see the note on
                      // `hasFreeAudit` in RefundRequestDialog.
                      title: order.lines[0]?.content_title ?? "this course",
                      isLate:
                        order.refund_status === RefundStatusEnum.WindowClosed,
                    })
                  }
                />
              ) : null}
            </SummaryColumn>

            <DetailColumn>
              <ReceiptCardStack>
                <ReceiptCard as="section">
                  <SectionHeading>Order Information</SectionHeading>
                  <ReceiptDetailList rows={getOrderDetailRows(order)} />
                </ReceiptCard>

                {customerRows.length > 0 ? (
                  <ReceiptCard as="section">
                    <SectionHeading>Customer Information</SectionHeading>
                    <ReceiptDetailList rows={customerRows} />
                  </ReceiptCard>
                ) : null}

                {paymentRows.length > 0 ? (
                  <ReceiptCard as="section">
                    <SectionHeading>Payment Information</SectionHeading>
                    <ReceiptDetailList rows={paymentRows} />
                  </ReceiptCard>
                ) : null}
              </ReceiptCardStack>

              <IssuerCard as="section">
                <IssuerLogo src={mitLearnLogo} alt="MIT Learn" />
                <ReceiptDetailList
                  rows={[
                    { label: "Address:", value: MIT_LEARN_ADDRESS },
                    {
                      label: "Support:",
                      value: SUPPORT_EMAIL ? (
                        <SupportLink href={`mailto:${SUPPORT_EMAIL}`}>
                          {SUPPORT_EMAIL}
                        </SupportLink>
                      ) : null,
                    },
                  ]}
                />
              </IssuerCard>
            </DetailColumn>
          </Columns>
        )}
      </PageContainer>
    </Background>
  )
}

export default ReceiptPage
export { getOrderDetailRows }
