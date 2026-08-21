import React from "react"
import { renderWithProviders, screen, user } from "@/test-utils"
import * as mitxonline from "api/mitxonline-test-utils"
import { RefundStatusEnum } from "@mitodl/mitxonline-api-axios/v2"
import type { Order } from "@mitodl/mitxonline-api-axios/v2"
import { ReceiptRefundCard } from "./ReceiptRefundCard"

const makeOrder = (overrides: Partial<Order> = {}) =>
  mitxonline.factories.orders.order(overrides)

const section = () => screen.getByRole("region", { name: "Refund" })

describe("ReceiptRefundCard", () => {
  test("Eligible orders show the deadline and can start a request", async () => {
    const onRequestRefund = jest.fn()
    renderWithProviders(
      <ReceiptRefundCard
        order={makeOrder({
          refund_status: RefundStatusEnum.Eligible,
          refund_deadline: "2026-08-15T00:00:00Z",
        })}
        onRequestRefund={onRequestRefund}
      />,
    )

    expect(section()).toBeInTheDocument()
    screen.getByText("Eligible until August 15, 2026")

    await user.click(screen.getByRole("button", { name: "Request Refund" }))

    expect(onRequestRefund).toHaveBeenCalled()
  })

  test("A closed window still offers a request, for review", () => {
    renderWithProviders(
      <ReceiptRefundCard
        order={makeOrder({ refund_status: RefundStatusEnum.WindowClosed })}
        onRequestRefund={jest.fn()}
      />,
    )

    screen.getByText("Refund window closed")
    screen.getByRole("button", { name: "Request Refund" })
  })

  test("A submitted request reports when it was made, with no way to resubmit", () => {
    renderWithProviders(
      <ReceiptRefundCard
        order={makeOrder({
          refund_status: RefundStatusEnum.Requested,
          refund_requested_on: "2025-06-23T00:00:00Z",
        })}
        onRequestRefund={jest.fn()}
      />,
    )

    screen.getByText("Refund requested")
    screen.getByText("Requested June 23, 2025")
    screen.getByText("We'll email you when your refund has been processed.")
    screen.getByText("Estimated processing time: 3-5 business days.")
    expect(
      screen.queryByRole("button", { name: "Request Refund" }),
    ).not.toBeInTheDocument()
  })

  test("A declined request dates the decision, not the submission", () => {
    renderWithProviders(
      <ReceiptRefundCard
        order={makeOrder({
          refund_status: RefundStatusEnum.Denied,
          refund_requested_on: "2025-06-01T00:00:00Z",
          refund_reviewed_on: "2025-06-23T00:00:00Z",
        })}
        onRequestRefund={jest.fn()}
      />,
    )

    screen.getByText("Refund declined")
    screen.getByText("Reviewed June 23, 2025")
    expect(screen.queryByText(/June 1, 2025/)).not.toBeInTheDocument()
    screen.getByText("We're unable to issue a refund for this order.")
    expect(
      screen.queryByRole("button", { name: "Request Refund" }),
    ).not.toBeInTheDocument()
  })

  test("A completed refund quotes the amount and the date it was processed", () => {
    renderWithProviders(
      <ReceiptRefundCard
        order={makeOrder({
          refund_status: RefundStatusEnum.Completed,
          refunds: [{ amount: 1574.6, date: "2025-06-23T00:00:00Z" }],
        })}
      />,
    )

    screen.getByText("Refund completed")
    screen.getByText("Processed June 23, 2025")
    screen.getByText(
      "Your refund of $1,574.60 has been issued to the original payment method.",
    )
  })

  test("A refund with no recorded transaction omits the amount", () => {
    renderWithProviders(
      <ReceiptRefundCard
        order={makeOrder({
          refund_status: RefundStatusEnum.Completed,
          refunds: [],
        })}
      />,
    )

    screen.getByText(
      "Your refund has been issued to the original payment method.",
    )
  })

  test("Orders that were never refundable render no card at all", () => {
    renderWithProviders(
      <ReceiptRefundCard
        order={makeOrder({ refund_status: RefundStatusEnum.Ineligible })}
      />,
    )

    expect(
      screen.queryByRole("region", { name: "Refund" }),
    ).not.toBeInTheDocument()
  })

  test("The button is withheld until a handler exists to act on it", () => {
    renderWithProviders(
      <ReceiptRefundCard
        order={makeOrder({ refund_status: RefundStatusEnum.Eligible })}
      />,
    )

    expect(
      screen.queryByRole("button", { name: "Request Refund" }),
    ).not.toBeInTheDocument()
  })
})
