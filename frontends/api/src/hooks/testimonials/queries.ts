import { queryOptions } from "@tanstack/react-query"
import { testimonialsApi } from "../../clients"
import type { TestimonialsApiTestimonialsListRequest as TestimonialsListRequest } from "../../generated/v0"

const testimonialKeys = {
  root: ["testimonials"],
  listRoot: () => [...testimonialKeys.root, "list"],
  list: (params: TestimonialsListRequest) => [
    ...testimonialKeys.listRoot(),
    params,
  ],
  detailRoot: () => [...testimonialKeys.root, "detail"],
  detail: (id: number) => [...testimonialKeys.detailRoot(), id],
}

const testimonialsQueries = {
  list: (params: TestimonialsListRequest) =>
    queryOptions({
      queryKey: testimonialKeys.list(params),
      queryFn: () =>
        testimonialsApi.testimonialsList(params).then((res) => res.data),
    }),
  detail: (id: number) =>
    queryOptions({
      queryKey: testimonialKeys.detail(id),
      queryFn: () =>
        testimonialsApi.testimonialsRetrieve({ id }).then((res) => res.data),
    }),
}

export { testimonialsQueries, testimonialKeys }
