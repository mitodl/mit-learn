import { useQuery } from "@tanstack/react-query"
import { orderQueries } from "api/mitxonline-hooks/orders"
import type {
  Line,
  OrderHistory,
  ProductPurchasableObject,
} from "@mitodl/mitxonline-api-axios/v2"
import { StateEnum } from "@mitodl/mitxonline-api-axios/v2"

/**
 * An explicit limit is required: without one, `orders/history` bypasses
 * pagination and returns a bare array instead of `{count, results}`. We do not
 * follow `next`, so orders past this many are not found.
 */
const ORDER_HISTORY_LIMIT = 100

type OrderIdResolution = {
  isPending: boolean
  /**
   * True when the history could not be fetched, so whether a receipt exists is
   * unknown. Distinct from `orderId === null`, which means we looked and there is
   * genuinely no order — callers must not treat the two the same, or a failing
   * request looks identical to "you never paid for this".
   */
  isError: boolean
  /** Most recent fulfilled order covering the resource. May be zero-value. */
  orderId: number | null
}

/**
 * `purchasable_object` is an untagged union whose variants all expose a bare `id`,
 * and those ids come from different tables — so match on shape, not id alone.
 * Program-run products match neither guard, which is fine: their id is the run's,
 * not the program's.
 */
const isCourseRun = (obj: ProductPurchasableObject): boolean =>
  "course" in obj && obj.course !== undefined

const isProgram = (obj: ProductPurchasableObject): boolean =>
  !isCourseRun(obj) && !("run_tag" in obj && obj.run_tag !== undefined)

const matchesLine = (
  line: Line,
  resourceId: number,
  isVariant: (obj: ProductPurchasableObject) => boolean,
): boolean => {
  const purchased = line.product.purchasable_object
  return purchased?.id === resourceId && isVariant(purchased)
}

/**
 * Most recent fulfilled order covering a resource. History comes back
 * newest-first. Refunded orders are excluded, matching `ReceiptByRunView` —
 * revisit when the refund section is built.
 */
const useOrderIdForResource = (
  resourceId: number | null,
  isVariant: (obj: ProductPurchasableObject) => boolean,
): OrderIdResolution => {
  const history = useQuery({
    ...orderQueries.historyList({ limit: ORDER_HISTORY_LIMIT }),
    enabled: resourceId !== null,
  })

  if (resourceId === null) {
    return { isPending: false, isError: false, orderId: null }
  }
  if (history.isPending) {
    return { isPending: true, isError: false, orderId: null }
  }
  if (history.isError || !history.data) {
    return { isPending: false, isError: true, orderId: null }
  }

  const match = history.data.results.find(
    (order: OrderHistory) =>
      order.state === StateEnum.Fulfilled &&
      order.lines.some((line) => matchesLine(line, resourceId, isVariant)),
  )

  return { isPending: false, isError: false, orderId: match?.id ?? null }
}

const useOrderIdForRun = (runId: number | null): OrderIdResolution =>
  useOrderIdForResource(runId, isCourseRun)

const useOrderIdForProgram = (programId: number | null): OrderIdResolution =>
  useOrderIdForResource(programId, isProgram)

export { useOrderIdForRun, useOrderIdForProgram }
export type { OrderIdResolution }
