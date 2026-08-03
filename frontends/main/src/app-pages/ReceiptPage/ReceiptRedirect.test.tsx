import React from "react"
import {
  renderWithProviders,
  screen,
  setMockResponse,
  waitFor,
} from "@/test-utils"
import * as mitxonline from "api/mitxonline-test-utils"
import { receiptView } from "@/common/urls"
import {
  ReceiptByProgramRedirect,
  ReceiptByRunRedirect,
} from "./ReceiptRedirect"

const RUN_ID = 500
const PROGRAM_ID = 99
const ORDER_ID = 4242

/** Must match the hook's request exactly, params included. */
const HISTORY_URL = mitxonline.urls.orders.historyList({ limit: 100 })

/** Course run: the only variant with `course`. */
const courseRunLine = (runId: number) =>
  mitxonline.factories.orders.line({
    product: mitxonline.factories.orders.product({
      purchasable_object: {
        id: runId,
        title: "Some Run",
        readable_id: "course-v1:MITxT+1.234",
        course: { id: 7, title: "Some Course" },
      },
    }),
  })

/** Program: neither `course` nor `run_tag`. */
const programLine = (programId: number) =>
  mitxonline.factories.orders.line({
    product: mitxonline.factories.orders.product({
      purchasable_object: {
        id: programId,
        title: "Some Program",
        readable_id: "program-v1:MITxT+SysEng",
      },
    }),
  })

/** Program run: has `run_tag`, and its `id` is the run's, not the program's. */
const programRunLine = (programRunId: number) =>
  mitxonline.factories.orders.line({
    product: mitxonline.factories.orders.product({
      purchasable_object: {
        id: programRunId,
        run_tag: "R1",
        start_date: "2024-09-01T00:00:00Z",
        end_date: "2025-12-24T00:00:00Z",
      },
    }),
  })

describe("ReceiptByRunRedirect", () => {
  test("redirects to the receipt for the order that paid for the run", async () => {
    setMockResponse.get(
      HISTORY_URL,
      mitxonline.factories.orders.orderHistoryList([
        mitxonline.factories.orders.orderHistory({
          id: ORDER_ID,
          state: "fulfilled",
          lines: [courseRunLine(RUN_ID)],
        }),
      ]),
    )

    const { location } = renderWithProviders(
      <ReceiptByRunRedirect runId={RUN_ID} />,
    )

    await waitFor(() => {
      expect(location.current.pathname).toBe(receiptView(ORDER_ID))
    })
  })

  test("picks the most recent matching order", async () => {
    setMockResponse.get(
      HISTORY_URL,
      // MITx Online returns order history most-recent-first.
      mitxonline.factories.orders.orderHistoryList([
        mitxonline.factories.orders.orderHistory({
          id: 999,
          state: "fulfilled",
          lines: [courseRunLine(RUN_ID)],
        }),
        mitxonline.factories.orders.orderHistory({
          id: 111,
          state: "fulfilled",
          lines: [courseRunLine(RUN_ID)],
        }),
      ]),
    )

    const { location } = renderWithProviders(
      <ReceiptByRunRedirect runId={RUN_ID} />,
    )

    await waitFor(() => {
      expect(location.current.pathname).toBe(receiptView(999))
    })
  })

  test("ignores orders that were not fulfilled", async () => {
    setMockResponse.get(
      HISTORY_URL,
      mitxonline.factories.orders.orderHistoryList([
        mitxonline.factories.orders.orderHistory({
          id: 999,
          state: "canceled",
          lines: [courseRunLine(RUN_ID)],
        }),
        mitxonline.factories.orders.orderHistory({
          id: ORDER_ID,
          state: "fulfilled",
          lines: [courseRunLine(RUN_ID)],
        }),
      ]),
    )

    const { location } = renderWithProviders(
      <ReceiptByRunRedirect runId={RUN_ID} />,
    )

    await waitFor(() => {
      expect(location.current.pathname).toBe(receiptView(ORDER_ID))
    })
  })

  test("does not match a program whose id happens to equal the run id", async () => {
    setMockResponse.get(
      HISTORY_URL,
      mitxonline.factories.orders.orderHistoryList([
        mitxonline.factories.orders.orderHistory({
          id: ORDER_ID,
          state: "fulfilled",
          lines: [programLine(RUN_ID)],
        }),
      ]),
    )

    renderWithProviders(<ReceiptByRunRedirect runId={RUN_ID} />)

    expect(
      await screen.findByText(/couldn't find what you were looking for/i),
    ).toBeInTheDocument()
  })

  test("shows not found when no order references the run", async () => {
    setMockResponse.get(
      HISTORY_URL,
      mitxonline.factories.orders.orderHistoryList([
        mitxonline.factories.orders.orderHistory({
          state: "fulfilled",
          lines: [courseRunLine(RUN_ID + 1)],
        }),
      ]),
    )

    renderWithProviders(<ReceiptByRunRedirect runId={RUN_ID} />)

    expect(
      await screen.findByText(/couldn't find what you were looking for/i),
    ).toBeInTheDocument()
  })

  // Indistinguishable from an absent receipt, on purpose.
  test("shows the generic 404 when the order lookup fails", async () => {
    setMockResponse.get(HISTORY_URL, "Server error", { code: 500 })

    renderWithProviders(<ReceiptByRunRedirect runId={RUN_ID} />)

    expect(
      await screen.findByText(/couldn't find what you were looking for/i),
    ).toBeInTheDocument()
  })
})

describe("ReceiptByProgramRedirect", () => {
  test("redirects to the receipt for the order that paid for the program", async () => {
    setMockResponse.get(
      HISTORY_URL,
      mitxonline.factories.orders.orderHistoryList([
        mitxonline.factories.orders.orderHistory({
          id: ORDER_ID,
          state: "fulfilled",
          lines: [programLine(PROGRAM_ID)],
        }),
      ]),
    )

    const { location } = renderWithProviders(
      <ReceiptByProgramRedirect programId={PROGRAM_ID} />,
    )

    await waitFor(() => {
      expect(location.current.pathname).toBe(receiptView(ORDER_ID))
    })
  })

  test("does not match a program run whose id happens to equal the program id", async () => {
    setMockResponse.get(
      HISTORY_URL,
      mitxonline.factories.orders.orderHistoryList([
        mitxonline.factories.orders.orderHistory({
          id: ORDER_ID,
          state: "fulfilled",
          lines: [programRunLine(PROGRAM_ID)],
        }),
      ]),
    )

    renderWithProviders(<ReceiptByProgramRedirect programId={PROGRAM_ID} />)

    expect(
      await screen.findByText(/couldn't find what you were looking for/i),
    ).toBeInTheDocument()
  })

  test("does not match a course run whose id happens to equal the program id", async () => {
    setMockResponse.get(
      HISTORY_URL,
      mitxonline.factories.orders.orderHistoryList([
        mitxonline.factories.orders.orderHistory({
          id: ORDER_ID,
          state: "fulfilled",
          lines: [courseRunLine(PROGRAM_ID)],
        }),
      ]),
    )

    renderWithProviders(<ReceiptByProgramRedirect programId={PROGRAM_ID} />)

    expect(
      await screen.findByText(/couldn't find what you were looking for/i),
    ).toBeInTheDocument()
  })
})
