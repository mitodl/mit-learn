import { queryOptions } from "@tanstack/react-query"

import { hubspotApi } from "../../clients"
import type {
  HubspotCollectionResponseFormDefinitionBaseForwardPaging as HubspotFormsListResponse,
  HubspotApiHubspotFormsDetailRetrieveRequest,
  HubspotApiHubspotFormsListRequest,
  HubspotFormDefinition as HubspotFormDetailResponse,
} from "../../generated/v1"

const hubspotKeys = {
  root: ["hubspot"],
  formsRoot: () => [...hubspotKeys.root, "forms"],
  listRoot: () => [...hubspotKeys.formsRoot(), "list"],
  list: (params: HubspotApiHubspotFormsListRequest) => [
    ...hubspotKeys.listRoot(),
    params,
  ],
  detailRoot: () => [...hubspotKeys.formsRoot(), "detail"],
  detail: (params: HubspotApiHubspotFormsDetailRetrieveRequest) => [
    ...hubspotKeys.detailRoot(),
    params,
  ],
}

const hubspotQueries = {
  list: (params: HubspotApiHubspotFormsListRequest = {}) =>
    queryOptions<HubspotFormsListResponse>({
      queryKey: hubspotKeys.list(params),
      queryFn: () =>
        hubspotApi.hubspotFormsList(params).then((res) => res.data),
    }),
  detail: (params: HubspotApiHubspotFormsDetailRetrieveRequest) =>
    queryOptions<HubspotFormDetailResponse>({
      queryKey: hubspotKeys.detail(params),
      queryFn: () =>
        hubspotApi.hubspotFormsDetailRetrieve(params).then((res) => res.data),
    }),
}

export { hubspotKeys, hubspotQueries }
export type { HubspotFormDetailResponse }
