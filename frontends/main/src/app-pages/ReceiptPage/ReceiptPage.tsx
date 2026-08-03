"use client"

import React from "react"
import Image from "next/image"
import { useRouter } from "next-nprogress-bar"
import { useQuery } from "@tanstack/react-query"
import { RiArrowLeftLine, RiPrinterLine } from "@remixicon/react"
import { Container, Skeleton, Typography, styled } from "ol-components"
import { Button, ButtonLink } from "@mitodl/smoot-design"
import { orderQueries } from "api/mitxonline-hooks/orders"
import { mitxUserQueries } from "api/mitxonline-hooks/user"
import type { Order } from "@mitodl/mitxonline-api-axios/v2"
import type { AxiosError } from "axios"
import NotFoundPage from "@/app-pages/ErrorPage/NotFoundPage"
import mitLearnLogo from "@/public/images/mit-learn-logo-black.svg"
import { env } from "@/env"
import * as urls from "@/common/urls"
import { ReceiptDetailList, populatedGroups } from "./ReceiptDetailList"
import type { ReceiptDetailGroup } from "./ReceiptDetailList"
import { ReceiptOrderSummary } from "./ReceiptOrderSummary"
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

const PageContainer = styled(Container)({
  paddingTop: "40px",
  paddingBottom: "80px",
})

const ButtonBar = styled.div({
  display: "flex",
  gap: "8px",
  justifyContent: "space-between",
  // Neither button belongs in a printed receipt.
  "@media print": {
    display: "none",
  },
})

const Columns = styled.div(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 424px",
  gap: "32px",
  alignItems: "start",
  paddingTop: "16px",
  [theme.breakpoints.down("md")]: {
    gridTemplateColumns: "minmax(0, 1fr)",
  },
}))

const MainColumn = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "32px",
})

const Section = styled.section({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
})

const IssuerLogo = styled(Image)({
  display: "block",
  // `Section` stretches its children, which would scale the logo up.
  alignSelf: "flex-start",
  width: "auto",
  height: "40px",
})

const TitleSection = styled.div({
  paddingTop: "32px",
  paddingBottom: "4px",
})

const SupportLink = styled.a(({ theme }) => ({
  color: theme.custom.colors.red,
  textDecoration: "none",
  ":hover": {
    textDecoration: "underline",
  },
}))

/**
 * One group of rows per line item, then the order-level rows. The design's "Tax"
 * and "HSN" rows are omitted — the payload has no such fields. "CEUs" is wired up
 * but MITx Online always returns null for it today.
 */
const getOrderDetailGroups = (order: Order): ReceiptDetailGroup[] => {
  const lineGroups: ReceiptDetailGroup[] = order.lines.map((line) => [
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
  ])

  return [
    ...lineGroups,
    [
      { label: "Order Number:", value: order.reference_number },
      { label: "Order Date:", value: formatReceiptDate(order.created_on) },
      { label: "Discount Code:", value: getDiscountCode(order) },
      { label: "Total Paid:", value: formatMoney(order.total_price_paid) },
    ],
  ]
}

const ReceiptSkeleton: React.FC = () => (
  <MainColumn>
    <Skeleton variant="text" width="30%" height={36} />
    <Skeleton variant="rectangular" width="100%" height={280} />
    <Skeleton variant="rectangular" width="100%" height={120} />
  </MainColumn>
)

const ReceiptPage: React.FC<{ orderId: number }> = ({ orderId }) => {
  const router = useRouter()
  const orderQuery = useQuery(orderQueries.receipt(orderId))
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
  const customerGroups = order
    ? populatedGroups([
        [
          { label: "Name:", value: user?.name },
          { label: "Email:", value: user?.email },
          {
            label: "Address:",
            value: formatStreetAddress(order.street_address),
          },
        ],
      ])
    : []

  const paymentGroups = order
    ? populatedGroups([
        [
          { label: "Name:", value: order.transactions?.name },
          { label: "Payment Method:", value: formatPaymentMethod(order) },
        ],
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

  return (
    <Background>
      <PageContainer>
        <ButtonBar>
          <Button
            variant="tertiary"
            startIcon={<RiArrowLeftLine />}
            onClick={() => router.back()}
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
        </ButtonBar>

        <TitleSection>
          <Typography component="h1" variant="h3">
            Receipt
          </Typography>
        </TitleSection>

        {orderQuery.isPending ? (
          <ReceiptSkeleton />
        ) : orderQuery.isError || !order ? (
          <MainColumn>
            <Typography variant="body1">
              We could not load this receipt.{" "}
              <SupportLink href={`mailto:${SUPPORT_EMAIL}`}>
                Contact support
              </SupportLink>{" "}
              if the problem persists.
            </Typography>
            <ButtonLink variant="secondary" href={urls.DASHBOARD_HOME}>
              Back to Dashboard
            </ButtonLink>
          </MainColumn>
        ) : (
          <Columns>
            <MainColumn>
              <Section>
                <Typography variant="h5" component="h2">
                  Order Information
                </Typography>
                <ReceiptDetailList groups={getOrderDetailGroups(order)} />
              </Section>

              {customerGroups.length > 0 ? (
                <Section>
                  <Typography variant="h5" component="h2">
                    Customer Information
                  </Typography>
                  <ReceiptDetailList groups={customerGroups} />
                </Section>
              ) : null}

              {paymentGroups.length > 0 ? (
                <Section>
                  <Typography variant="h5" component="h2">
                    Payment Information
                  </Typography>
                  <ReceiptDetailList groups={paymentGroups} />
                </Section>
              ) : null}

              <Section>
                <IssuerLogo src={mitLearnLogo} alt="MIT Learn" />
                <ReceiptDetailList
                  groups={[
                    [
                      { label: "Address:", value: MIT_LEARN_ADDRESS },
                      {
                        label: "Support:",
                        value: SUPPORT_EMAIL ? (
                          <SupportLink href={`mailto:${SUPPORT_EMAIL}`}>
                            {SUPPORT_EMAIL}
                          </SupportLink>
                        ) : null,
                      },
                    ],
                  ]}
                />
              </Section>
            </MainColumn>

            <ReceiptOrderSummary order={order} />
          </Columns>
        )}
      </PageContainer>
    </Background>
  )
}

export default ReceiptPage
export { getOrderDetailGroups }
