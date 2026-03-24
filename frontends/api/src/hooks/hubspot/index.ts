import { useQuery } from "@tanstack/react-query"

import type {
  HubspotApiHubspotFormsDetailRetrieveRequest,
  HubspotApiHubspotFormsListRequest,
  HubspotFormsListResponse,
} from "../../generated/v1"
import { hubspotKeys, hubspotQueries } from "./queries"

const useHubspotFormsList = (
  params: HubspotApiHubspotFormsListRequest = {},
  opts?: { enabled?: boolean },
) => {
  return useQuery({
    ...hubspotQueries.list(params),
    ...opts,
  })
}

const useHubspotFormDetail = (
  params: HubspotApiHubspotFormsDetailRetrieveRequest | undefined,
  opts?: { enabled?: boolean },
) => {
  return useQuery({
    ...hubspotQueries.detail(params ?? { form_id: "" }),
    enabled: Boolean(params?.form_id && opts?.enabled !== false),
  })
}

export {
  hubspotKeys,
  hubspotQueries,
  useHubspotFormsList,
  useHubspotFormDetail,
}

export type {
  HubspotApiHubspotFormsDetailRetrieveRequest,
  HubspotApiHubspotFormsListRequest,
  HubspotFormsListResponse,
}
