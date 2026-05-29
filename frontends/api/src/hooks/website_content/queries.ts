import { queryOptions } from "@tanstack/react-query"
import { websiteContentApi } from "../../clients"
import type { WebsiteContentApiWebsiteContentListRequest as WebsiteContentListRequest } from "../../generated/v1"

const websiteContentKeys = {
  root: ["website_content"],
  listRoot: () => [...websiteContentKeys.root, "list"],
  list: (params: WebsiteContentListRequest) => [
    ...websiteContentKeys.listRoot(),
    params,
  ],
  detailRoot: () => [...websiteContentKeys.root, "detail"],
  detail: (id: number) => [...websiteContentKeys.detailRoot(), id],
  websiteContentDetailRetrieve: (identifier: string) => [
    ...websiteContentKeys.detailRoot(),
    identifier,
  ],
}

const websiteContentQueries = {
  list: (params: WebsiteContentListRequest) =>
    queryOptions({
      queryKey: websiteContentKeys.list(params),
      queryFn: () =>
        websiteContentApi.websiteContentList(params).then((res) => res.data),
    }),
  detail: (id: number) =>
    queryOptions({
      queryKey: websiteContentKeys.detail(id),
      queryFn: () =>
        websiteContentApi
          .websiteContentRetrieve({ id })
          .then((res) => res.data),
    }),
  websiteContentDetailRetrieve: (identifier: string) =>
    queryOptions({
      queryKey: websiteContentKeys.websiteContentDetailRetrieve(identifier),
      queryFn: () =>
        websiteContentApi
          .websiteContentDetailRetrieve({ identifier })
          .then((res) => res.data),
    }),
}

export { websiteContentQueries, websiteContentKeys }
