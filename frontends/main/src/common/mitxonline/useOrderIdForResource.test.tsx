import React from "react"
import { faker } from "@faker-js/faker/locale/en"
import { renderHook, waitFor } from "@/test-utils"
import { QueryClientProvider } from "@tanstack/react-query"
import { makeBrowserQueryClient } from "@/app/getQueryClient"
import { setMockResponse } from "api/test-utils"
import * as mitxonline from "api/mitxonline-test-utils"
import type { ProductPurchasableObject } from "@mitodl/mitxonline-api-axios/v2"
import { StateEnum } from "@mitodl/mitxonline-api-axios/v2"
import { useOrderIdForRun } from "./useOrderIdForResource"

const RUN_ID = 777
const ORDER_ID = 4242

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = makeBrowserQueryClient({ maxRetries: 0 })
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

/**
 * A line for a course run. `isCourseRun` matches on the presence of `course`,
 * so a bare `{ id }` purchasable object is deliberately not enough.
 */
const runLine = () =>
  mitxonline.factories.orders.line({
    product: mitxonline.factories.orders.product({
      purchasable_object: {
        id: RUN_ID,
        course: { id: faker.number.int() },
      } as unknown as ProductPurchasableObject,
    }),
  })

const setupHistory = (state: StateEnum) => {
  setMockResponse.get(
    mitxonline.urls.orders.historyList({ limit: 100 }),
    mitxonline.factories.orders.orderHistoryList([
      mitxonline.factories.orders.orderHistory({
        id: ORDER_ID,
        state,
        lines: [runLine()],
      }),
    ]),
  )
}

describe("useOrderIdForRun", () => {
  /*
   * The refunded states are the point of the hook: a learner drops back to
   * audit after a refund, which is exactly when they want the receipt. Without
   * these, removing them from RECEIPT_STATES passes the whole suite.
   */
  test.each([
    StateEnum.Refunded,
    StateEnum.PartiallyRefunded,
    StateEnum.Fulfilled,
  ])("resolves the receipt for a %s order", async (state) => {
    setupHistory(state)

    const { result } = renderHook(() => useOrderIdForRun(RUN_ID), { wrapper })

    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(result.current.orderId).toBe(ORDER_ID)
  })

  test.each([StateEnum.Pending, StateEnum.Canceled, StateEnum.Declined])(
    "finds no receipt for a %s order",
    async (state) => {
      setupHistory(state)

      const { result } = renderHook(() => useOrderIdForRun(RUN_ID), { wrapper })

      await waitFor(() => expect(result.current.isPending).toBe(false))
      expect(result.current.orderId).toBe(null)
    },
  )
})
