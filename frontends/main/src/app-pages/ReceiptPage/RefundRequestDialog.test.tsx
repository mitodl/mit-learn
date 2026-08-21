import {
  act,
  renderWithProviders,
  screen,
  setMockResponse,
  user,
  within,
} from "@/test-utils"
import { makeRequest } from "api/test-utils"
import * as mitxonline from "api/mitxonline-test-utils"
import NiceModal from "@ebay/nice-modal-react"
import type { Order } from "@mitodl/mitxonline-api-axios/v2"
import { RefundRequestDialog } from "./RefundRequestDialog"

const ORDER_ID = 4242
const TITLE = "The Iterative Innovation Process"

const openDialog = async ({
  isLate = false,
  order,
  fails = false,
}: { isLate?: boolean; order?: Partial<Order>; fails?: boolean } = {}) => {
  if (fails) {
    setMockResponse.post(mitxonline.urls.orders.refundRequests(), null, {
      code: 400,
    })
  } else {
    setMockResponse.post(mitxonline.urls.orders.refundRequests(), {})
  }
  const receipt = mitxonline.factories.orders.order({
    id: ORDER_ID,
    total_price_paid: "1574.60",
    ...order,
  })
  renderWithProviders(null)
  await act(async () => {
    NiceModal.show(RefundRequestDialog, {
      order: receipt,
      title: TITLE,
      isLate,
    })
  })
  return screen.findByRole("dialog")
}

/** The refund request POSTs the dialog actually made. */
const submittedRequests = () =>
  jest
    .mocked(makeRequest)
    .mock.calls.map(([request]) => request)
    .filter(
      ({ method, url }) =>
        method === "post" && url === mitxonline.urls.orders.refundRequests(),
    )

describe("RefundRequestDialog, inside the refund window", () => {
  test("names the course, the amount, and how it will be refunded", async () => {
    const dialog = await openDialog()

    within(dialog).getByText(/You're requesting a refund for/)
    within(dialog).getByText(TITLE, { exact: false })
    within(dialog).getByText("$1,574.60")
    within(dialog).getByText("Original payment method")
  })

  test("offers every reason the design lists", async () => {
    const dialog = await openDialog()

    for (const label of [
      "I do not have enough time",
      "Course is not what I expected",
      "I had a technical issue",
      "Course is too difficult",
      "I purchased by mistake",
      "Prefer not to say",
      "Other",
    ]) {
      within(dialog).getByRole("radio", { name: label })
    }
  })

  test("submits the chosen reason once consent is given", async () => {
    const dialog = await openDialog()

    await user.click(
      within(dialog).getByRole("radio", { name: "I had a technical issue" }),
    )
    await user.click(within(dialog).getByRole("checkbox"))
    await user.click(
      within(dialog).getByRole("button", { name: "Submit Refund Request" }),
    )

    expect(submittedRequests()).toEqual([
      expect.objectContaining({
        body: {
          order: ORDER_ID,
          refund_reason: "technical_difficulties",
          refund_reason_text: "",
          consent_given: true,
        },
      }),
    ])
  })

  test("will not submit without a reason", async () => {
    const dialog = await openDialog()

    await user.click(within(dialog).getByRole("checkbox"))
    await user.click(
      within(dialog).getByRole("button", { name: "Submit Refund Request" }),
    )

    within(dialog).getByText("Please select a reason for your refund request.")
    expect(submittedRequests()).toHaveLength(0)
  })

  test("will not submit without consent", async () => {
    const dialog = await openDialog()

    await user.click(
      within(dialog).getByRole("radio", { name: "Prefer not to say" }),
    )
    await user.click(
      within(dialog).getByRole("button", { name: "Submit Refund Request" }),
    )

    within(dialog).getByText("Please acknowledge this before continuing.")
    expect(submittedRequests()).toHaveLength(0)
  })

  test("'Other' asks for details, and insists on them", async () => {
    const dialog = await openDialog()

    expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument()

    await user.click(within(dialog).getByRole("radio", { name: "Other" }))
    const details = within(dialog).getByRole("textbox")

    await user.click(within(dialog).getByRole("checkbox"))
    await user.click(
      within(dialog).getByRole("button", { name: "Submit Refund Request" }),
    )

    within(dialog).getByText("Please tell us why you're requesting a refund.")
    expect(submittedRequests()).toHaveLength(0)

    await user.type(details, "  Bought the wrong thing  ")
    await user.click(
      within(dialog).getByRole("button", { name: "Submit Refund Request" }),
    )

    expect(submittedRequests()).toEqual([
      expect.objectContaining({
        body: expect.objectContaining({
          refund_reason: "other",
          // Trimmed, so stray whitespace cannot pass the API's check.
          refund_reason_text: "Bought the wrong thing",
        }),
      }),
    ])
  })
})

describe("RefundRequestDialog, after the refund window", () => {
  test("asks for a review instead, and says approval is not guaranteed", async () => {
    const dialog = await openDialog({ isLate: true })

    within(dialog).getByText(
      "Automatic refunds are no longer available for this order. You can submit a request for review.",
    )
    within(dialog).getByText(/Approval is not guaranteed./)
    within(dialog).getByRole("button", { name: "Submit for Review" })
  })

  test("drops the preset reasons in favour of free text", async () => {
    const dialog = await openDialog({ isLate: true })

    expect(within(dialog).queryAllByRole("radio")).toHaveLength(0)
    within(dialog).getByRole("textbox")
    within(dialog).getByText("0 / 1000")
  })

  test("submits the explanation with no preset reason", async () => {
    const dialog = await openDialog({ isLate: true })

    await user.type(
      within(dialog).getByRole("textbox"),
      "I was in hospital and could not withdraw in time.",
    )
    await user.click(within(dialog).getByRole("checkbox"))
    await user.click(
      within(dialog).getByRole("button", { name: "Submit for Review" }),
    )

    expect(submittedRequests()).toEqual([
      expect.objectContaining({
        body: {
          order: ORDER_ID,
          refund_reason_text:
            "I was in hospital and could not withdraw in time.",
          consent_given: true,
        },
      }),
    ])
  })

  test("insists on an explanation", async () => {
    const dialog = await openDialog({ isLate: true })

    await user.click(within(dialog).getByRole("checkbox"))
    await user.click(
      within(dialog).getByRole("button", { name: "Submit for Review" }),
    )

    within(dialog).getByText("Please tell us why you're requesting a refund.")
    expect(submittedRequests()).toHaveLength(0)
  })
})

describe("RefundRequestDialog error handling", () => {
  test("a rejected request is reported and the dialog stays open", async () => {
    const dialog = await openDialog({ fails: true })

    await user.click(
      within(dialog).getByRole("radio", { name: "Prefer not to say" }),
    )
    await user.click(within(dialog).getByRole("checkbox"))
    await user.click(
      within(dialog).getByRole("button", { name: "Submit Refund Request" }),
    )

    await within(dialog).findByText(
      "We could not submit your refund request. Please try again in a moment.",
    )
    expect(dialog).toBeInTheDocument()
  })
})

describe("RefundRequestDialog consequences warning", () => {
  test("a course with an audit track promises continued access", async () => {
    const dialog = await openDialog({
      order: {
        lines: [
          mitxonline.factories.orders.transactionLine({ has_free_audit: true }),
        ],
      },
    })

    within(dialog).getByText(
      /You'll be moved to the free version of this course/,
    )
  })

  test("a course without one warns that access goes away", async () => {
    const dialog = await openDialog({
      order: {
        lines: [
          mitxonline.factories.orders.transactionLine({
            has_free_audit: false,
          }),
        ],
      },
    })

    within(dialog).getByText(/This course does not have a free audit version/)
  })
})
