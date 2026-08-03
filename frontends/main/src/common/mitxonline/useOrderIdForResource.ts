import { useQuery } from "@tanstack/react-query"
import { orderQueries } from "api/mitxonline-hooks/orders"
import type {
  Line,
  OrderHistory,
  ProductPurchasableObject,
} from "@mitodl/mitxonline-api-axios/v2"
import { StateEnum } from "@mitodl/mitxonline-api-axios/v2"

/**
 * MITx Online returns at most 100 records per page on `orders/history`. Learners
 * do not have order histories anywhere near that size, so a single page is
 * enough to resolve a run/program back to its order — and paginating would mean
 * an unbounded number of requests on a page whose only job is to redirect.
 */
const PAGE_SIZE = 100

type OrderIdResolution = {
  isPending: boolean
  /**
   * True when the order history could not be fetched, so we do not know whether
   * a receipt exists. Distinct from `orderId === null`, which means we checked
   * and there is genuinely no order.
   */
  isError: boolean
  /** The most recent fulfilled order that paid for the resource, if any. */
  orderId: number | null
}

/**
 * `Product.purchasable_object` is a `oneOf` over course run / program run /
 * program, and every variant exposes a bare `id`, so matching on `id` alone
 * would let a course run id collide with a program id. These guards pick the
 * variant by the fields unique to it:
 *
 * - a course run is the only variant serialized with a nested `course`
 * - a program run is the only variant serialized with `run_tag` but no `course`
 * - a program is what remains: `readable_id` and no `run_tag`
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
 * Find the fulfilled order that paid for a resource among the user's order
 * history.
 *
 * MITx Online returns order history most-recent-first, so the first match is the
 * latest order — matching `ReceiptByRunView` / `ReceiptByProgramView`, which
 * both take `.order_by("-created_on").first()`.
 */
const useOrderIdForResource = (
  resourceId: number | null,
  isVariant: (obj: ProductPurchasableObject) => boolean,
): OrderIdResolution => {
  const history = useQuery({
    ...orderQueries.historyList({ limit: PAGE_SIZE }),
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
