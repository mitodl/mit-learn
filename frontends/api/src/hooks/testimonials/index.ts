import { UseQueryOptions, useQuery } from "@tanstack/react-query"

import type { TestimonialsApiTestimonialsListRequest } from "../../generated/v0"
import { testimonialsQueries } from "./queries"

const useTestimonialList = (
  params: TestimonialsApiTestimonialsListRequest = {},
  opts: Pick<UseQueryOptions, "enabled"> = {},
) => {
  return useQuery({
    ...testimonialsQueries.list(params),
    ...opts,
  })
}

/**
 * Query is diabled if id is undefined.
 */
const useTestimonialDetail = (id: number | undefined) => {
  return useQuery({
    ...testimonialsQueries.detail(id ?? -1),
    enabled: id !== undefined,
  })
}

export { useTestimonialDetail, useTestimonialList, testimonialsQueries }
