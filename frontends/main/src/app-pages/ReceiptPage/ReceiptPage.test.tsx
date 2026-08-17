import React from "react"
import {
  renderWithProviders,
  screen,
  setMockResponse,
  within,
} from "@/test-utils"
import * as mitxonline from "api/mitxonline-test-utils"
import ReceiptPage from "./ReceiptPage"

const ORDER_ID = 4242

const setupApis = ({
  order,
  user,
}: {
  order?: ReturnType<typeof mitxonline.factories.orders.order>
  user?: ReturnType<typeof mitxonline.factories.user.user>
} = {}) => {
  const mitxUser = user ?? mitxonline.factories.user.user()
  const receipt = order ?? mitxonline.factories.orders.order({ id: ORDER_ID })
  setMockResponse.get(mitxonline.urls.userMe.get(), mitxUser)
  setMockResponse.get(mitxonline.urls.orders.receipt(ORDER_ID), receipt)
  return { mitxUser, receipt }
}

/** Reads a label's value cell within one section, since labels repeat. */
const findValueFor = async (sectionName: string, label: string) => {
  const heading = await screen.findByRole("heading", { name: sectionName })
  // The heading and its detail list are siblings inside the section element.
  const section = heading.closest("section")
  if (!section) throw new Error(`No section found for "${sectionName}"`)
  const term = within(section).getByText(label)
  const value = term.closest("dt")?.nextElementSibling
  if (!value) throw new Error(`No value cell found for "${label}"`)
  return value
}

describe("ReceiptPage", () => {
  test("renders order information from the receipt", async () => {
    const line = mitxonline.factories.orders.transactionLine({
      content_title: "The Iterative Innovation Process",
      readable_id: "program-v1:xPRO+SysEngx",
      start_date: "2024-09-01T00:00:00Z",
      end_date: "2025-12-24T00:00:00Z",
      price: "1524.60",
      quantity: 1,
      discount: "0.00",
      CEUs: "20",
    })
    setupApis({
      order: mitxonline.factories.orders.order({
        id: ORDER_ID,
        lines: [line],
        reference_number: "xpro-b2c-production-66238",
        created_on: "2024-06-14T00:00:00Z",
        total_price_paid: "1524.60",
      }),
    })

    renderWithProviders(<ReceiptPage orderId={ORDER_ID} />)

    expect(
      await screen.findByRole("heading", { name: "Receipt", level: 1 }),
    ).toBeInTheDocument()

    expect(
      await findValueFor("Order Information", "Order Item:"),
    ).toHaveTextContent("The Iterative Innovation Process")
    expect(await findValueFor("Order Information", "Dates:")).toHaveTextContent(
      "September 01, 2024 - December 24, 2025",
    )
    expect(
      await findValueFor("Order Information", "Order Number:"),
    ).toHaveTextContent("xpro-b2c-production-66238")
    expect(
      await findValueFor("Order Information", "Order Date:"),
    ).toHaveTextContent("June 14, 2024")
    expect(
      await findValueFor("Order Information", "Unit Price:"),
    ).toHaveTextContent("$1,524.60")
    expect(
      await findValueFor("Order Information", "Total Paid:"),
    ).toHaveTextContent("$1,524.60")
    expect(
      await findValueFor("Order Information", "Product Number:"),
    ).toHaveTextContent("program-v1:xPRO+SysEngx")
    expect(await findValueFor("Order Information", "CEUs:")).toHaveTextContent(
      "20",
    )
  })

  test("formats dates in UTC so they match the recorded order", async () => {
    // Local formatting would render these a day early.
    setupApis({
      order: mitxonline.factories.orders.order({
        id: ORDER_ID,
        created_on: "2026-07-09T00:00:00Z",
        lines: [
          mitxonline.factories.orders.transactionLine({
            start_date: "2026-07-08T00:00:00Z",
            end_date: "2027-07-09T00:00:00Z",
          }),
        ],
      }),
    })

    renderWithProviders(<ReceiptPage orderId={ORDER_ID} />)

    expect(await findValueFor("Order Information", "Dates:")).toHaveTextContent(
      "July 08, 2026 - July 09, 2027",
    )
    expect(
      await findValueFor("Order Information", "Order Date:"),
    ).toHaveTextContent("July 09, 2026")
  })

  test("shows only the known end of the range when a run has no end date", async () => {
    setupApis({
      order: mitxonline.factories.orders.order({
        id: ORDER_ID,
        lines: [
          mitxonline.factories.orders.transactionLine({
            start_date: "2026-06-22T00:00:00Z",
            end_date: null as unknown as string,
          }),
        ],
      }),
    })

    renderWithProviders(<ReceiptPage orderId={ORDER_ID} />)

    expect(await findValueFor("Order Information", "Dates:")).toHaveTextContent(
      "June 22, 2026",
    )
  })

  test("shows cents on whole-dollar amounts", async () => {
    setupApis({
      order: mitxonline.factories.orders.order({
        id: ORDER_ID,
        lines: [
          mitxonline.factories.orders.transactionLine({ price: "500.00" }),
        ],
        total_price_paid: "500.00",
      }),
    })

    renderWithProviders(<ReceiptPage orderId={ORDER_ID} />)

    expect(
      await findValueFor("Order Information", "Unit Price:"),
    ).toHaveTextContent("$500.00")
  })

  test("takes the customer name and email from the MITx Online user", async () => {
    const { mitxUser } = setupApis({
      user: mitxonline.factories.user.user({
        name: "Peter Pinch",
        email: "pdpinch@mit.edu",
      }),
    })

    renderWithProviders(<ReceiptPage orderId={ORDER_ID} />)

    expect(
      await findValueFor("Customer Information", "Name:"),
    ).toHaveTextContent(mitxUser.name!)
    expect(
      await findValueFor("Customer Information", "Email:"),
    ).toHaveTextContent("pdpinch@mit.edu")
  })

  test("renders the billing address as a single line", async () => {
    setupApis({
      order: mitxonline.factories.orders.order({
        id: ORDER_ID,
        street_address: {
          line: ["123 Main Street"],
          city: "Danvers",
          state: "MA",
          postal_code: "01923",
          country: "US",
        },
      }),
    })

    renderWithProviders(<ReceiptPage orderId={ORDER_ID} />)

    expect(
      await findValueFor("Customer Information", "Address:"),
    ).toHaveTextContent("123 Main Street, Danvers MA, 01923, US")
  })

  test("renders card payment details", async () => {
    setupApis({
      order: mitxonline.factories.orders.order({
        id: ORDER_ID,
        transactions: {
          payment_method: "card",
          card_type: "Visa",
          card_number: "xxxxxxxxxxxx1111",
          name: "Peter Pinch",
        },
      }),
    })

    renderWithProviders(<ReceiptPage orderId={ORDER_ID} />)

    expect(
      await findValueFor("Payment Information", "Payment Method:"),
    ).toHaveTextContent("Visa | xxxxxxxxxxxx1111")
    expect(
      await findValueFor("Payment Information", "Name:"),
    ).toHaveTextContent("Peter Pinch")
  })

  test("renders Paypal payments without card details", async () => {
    setupApis({
      order: mitxonline.factories.orders.order({
        id: ORDER_ID,
        transactions: {
          payment_method: "paypal",
          bill_to_email: "pdpinch@mit.edu",
          name: "Peter Pinch",
        },
      }),
    })

    renderWithProviders(<ReceiptPage orderId={ORDER_ID} />)

    expect(
      await findValueFor("Payment Information", "Payment Method:"),
    ).toHaveTextContent("PayPal")
  })

  // Parity with the MITx Online receipt, which shows the payer's email for PayPal
  // orders in place of card details.
  test("shows the payer email for Paypal orders", async () => {
    setupApis({
      order: mitxonline.factories.orders.order({
        id: ORDER_ID,
        transactions: {
          payment_method: "paypal",
          bill_to_email: "payer@example.com",
          name: "Peter Pinch",
        },
      }),
    })

    renderWithProviders(<ReceiptPage orderId={ORDER_ID} />)

    expect(
      await findValueFor("Payment Information", "Email:"),
    ).toHaveTextContent("payer@example.com")
  })

  // Parity: MITx Online shows a per-line total. It is redundant on a single-line
  // order, where it equals the order total shown below.
  test("omits the per-line total on a single-line order", async () => {
    setupApis({
      order: mitxonline.factories.orders.order({
        id: ORDER_ID,
        lines: [mitxonline.factories.orders.transactionLine()],
      }),
    })

    renderWithProviders(<ReceiptPage orderId={ORDER_ID} />)

    await screen.findByRole("heading", { name: "Order Information" })
    expect(screen.queryByText("Line Total:")).not.toBeInTheDocument()
  })

  test("shows a per-line total when the order has multiple lines", async () => {
    setupApis({
      order: mitxonline.factories.orders.order({
        id: ORDER_ID,
        lines: [
          mitxonline.factories.orders.transactionLine({ total_paid: "100.00" }),
          mitxonline.factories.orders.transactionLine({ total_paid: "250.00" }),
        ],
      }),
    })

    renderWithProviders(<ReceiptPage orderId={ORDER_ID} />)

    await screen.findByRole("heading", { name: "Order Information" })
    expect(screen.getAllByText("Line Total:")).toHaveLength(2)
    expect(screen.getByText("$100.00")).toBeInTheDocument()
    expect(screen.getByText("$250.00")).toBeInTheDocument()
  })

  test("shows the discount code when one was redeemed", async () => {
    const discountCode = "30468acf5a4e4c3c9c31a262caf984c9" // pragma: allowlist secret
    setupApis({
      order: mitxonline.factories.orders.order({
        id: ORDER_ID,
        discounts: [
          mitxonline.factories.orders.redeemedDiscount({
            discount_code: discountCode,
          }),
        ],
      }),
    })

    renderWithProviders(<ReceiptPage orderId={ORDER_ID} />)

    expect(
      await findValueFor("Order Information", "Discount Code:"),
    ).toHaveTextContent(discountCode) //
  })

  test("omits rows the receipt payload does not provide", async () => {
    setupApis({
      order: mitxonline.factories.orders.order({
        id: ORDER_ID,
        // No discount redeemed and no per-line discount.
        discounts: [],
        lines: [
          mitxonline.factories.orders.transactionLine({
            discount: "0.00",
            // MITx Online hardcodes CEUs to null on receipts today.
            CEUs: null as unknown as string,
          }),
        ],
        street_address: {},
      }),
    })

    renderWithProviders(<ReceiptPage orderId={ORDER_ID} />)

    await screen.findByRole("heading", { name: "Order Information" })

    expect(screen.queryByText("Discount Code:")).not.toBeInTheDocument()
    expect(screen.queryByText("Discount:")).not.toBeInTheDocument()
    expect(screen.queryByText("CEUs:")).not.toBeInTheDocument()
    expect(screen.getByText("Address:")).toBeInTheDocument() // MIT Learn's own
    expect(
      within(
        (
          await screen.findByRole("heading", { name: "Customer Information" })
        ).closest("section")!,
      ).queryByText("Address:"),
    ).not.toBeInTheDocument()
  })

  test("drops the Payment Information section when there is no transaction", async () => {
    // Matches a real zero-value order: MITx Online returns the
    // transaction and address objects with every field null.
    setupApis({
      order: mitxonline.factories.orders.order({
        id: ORDER_ID,
        transactions: {
          card_number: undefined,
          card_type: undefined,
          name: undefined,
          bill_to_email: undefined,
          payment_method: undefined,
        },
      }),
    })

    renderWithProviders(<ReceiptPage orderId={ORDER_ID} />)

    await screen.findByRole("heading", { name: "Order Information" })

    expect(
      screen.queryByRole("heading", { name: "Payment Information" }),
    ).not.toBeInTheDocument()
  })

  test("renders the order summary with total and quantity", async () => {
    setupApis({
      order: mitxonline.factories.orders.order({
        id: ORDER_ID,
        lines: [
          mitxonline.factories.orders.transactionLine({
            content_title: "The Iterative Innovation Process",
            price: "1524.60",
            quantity: 2,
            discount: "10.00",
          }),
        ],
        total_price_paid: "3029.20",
      }),
    })

    renderWithProviders(<ReceiptPage orderId={ORDER_ID} />)

    const summary = (
      await screen.findByRole("heading", { name: "Order Summary" })
    ).closest("div")!

    expect(summary).toHaveTextContent("The Iterative Innovation Process")
    expect(summary).toHaveTextContent("x 2")
    // 10.00 per unit × 2 units
    expect(summary).toHaveTextContent("- $20.00")
    expect(summary).toHaveTextContent("$3,029.20")
  })

  test("shows a row per refund, leaving the total at the amount charged", async () => {
    setupApis({
      order: mitxonline.factories.orders.order({
        id: ORDER_ID,
        state: "partially_refunded",
        total_price_paid: "1524.60",
        refunds: [
          mitxonline.factories.orders.orderRefund({
            amount: 500,
            date: "2024-07-02T00:00:00Z",
          }),
          mitxonline.factories.orders.orderRefund({
            amount: 24.6,
            date: "2024-08-15T00:00:00Z",
          }),
        ],
      }),
    })

    renderWithProviders(<ReceiptPage orderId={ORDER_ID} />)

    const summary = (
      await screen.findByRole("heading", { name: "Order Summary" })
    ).closest("div")!

    expect(summary).toHaveTextContent("Refund applied (July 02, 2024)")
    expect(summary).toHaveTextContent("- $500.00")
    expect(summary).toHaveTextContent("Refund applied (August 15, 2024)")
    expect(summary).toHaveTextContent("- $24.60")
    // total_price_paid is stamped at fulfillment; a refund never reduces it.
    expect(summary).toHaveTextContent("$1,524.60")
  })

  // `refund_fulfilled_order` flips the state without writing a refund transaction.
  test("notes a refund when the state says refunded but no refunds are recorded", async () => {
    setupApis({
      order: mitxonline.factories.orders.order({
        id: ORDER_ID,
        state: "refunded",
        refunds: [],
      }),
    })

    renderWithProviders(<ReceiptPage orderId={ORDER_ID} />)

    const summary = (
      await screen.findByRole("heading", { name: "Order Summary" })
    ).closest("div")!

    expect(summary).toHaveTextContent("Refund applied")
  })

  test("shows no refund row on a fulfilled order", async () => {
    setupApis({
      order: mitxonline.factories.orders.order({
        id: ORDER_ID,
        state: "fulfilled",
        refunds: [],
      }),
    })

    renderWithProviders(<ReceiptPage orderId={ORDER_ID} />)

    await screen.findByRole("heading", { name: "Order Summary" })

    expect(screen.queryByText(/Refund applied/)).not.toBeInTheDocument()
  })

  // Someone else's order 404s like a missing one; both get the generic 404.
  test("renders the generic 404 when the order is not found or not yours", async () => {
    setMockResponse.get(
      mitxonline.urls.userMe.get(),
      mitxonline.factories.user.user(),
    )
    setMockResponse.get(mitxonline.urls.orders.receipt(ORDER_ID), "Not found", {
      code: 404,
    })

    renderWithProviders(<ReceiptPage orderId={ORDER_ID} />)

    expect(
      await screen.findByText(/couldn't find what you were looking for/i),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(/We could not load this receipt/i),
    ).not.toBeInTheDocument()
  })

  // A 500 says nothing about existence, so it keeps an actionable message.
  test("keeps an actionable message when the request fails for another reason", async () => {
    setMockResponse.get(
      mitxonline.urls.userMe.get(),
      mitxonline.factories.user.user(),
    )
    setMockResponse.get(
      mitxonline.urls.orders.receipt(ORDER_ID),
      "Server error",
      { code: 500 },
    )

    renderWithProviders(<ReceiptPage orderId={ORDER_ID} />)

    // An alert, so the failure is read out rather than silently replacing the
    // skeleton.
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /We could not load this receipt/i,
    )
    expect(
      screen.getByRole("link", { name: "Back to Dashboard" }),
    ).toHaveAttribute("href", "/dashboard")
  })

  test("announces loading and then the loaded receipt", async () => {
    setupApis()

    renderWithProviders(<ReceiptPage orderId={ORDER_ID} />)

    expect(screen.getByRole("status")).toHaveTextContent("Loading receipt.")

    await screen.findByRole("heading", { name: "Order Summary" })

    expect(screen.getByRole("status")).toHaveTextContent("Receipt loaded.")
  })
})
