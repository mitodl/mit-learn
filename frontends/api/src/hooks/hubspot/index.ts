import { useMutation, useQuery } from "@tanstack/react-query"

import { hubspotApi } from "../../clients"

import type {
  HubspotCollectionResponseFormDefinitionBaseForwardPaging as HubspotFormsListResponse,
  HubspotApiHubspotFormsDetailRetrieveRequest,
  HubspotApiHubspotFormsListRequest,
  HubspotFormSubmitResponse,
} from "../../generated/v1"
import type { HubspotFormDetailResponse } from "./queries"
import { hubspotKeys, hubspotQueries } from "./queries"

type HubspotSubmitFieldValue = string | boolean | string[] | null

type HubspotSubmitField = {
  name: string
  value: HubspotSubmitFieldValue
}

type HubspotFormSubmitMutationParams = {
  formId: string
  fields: HubspotSubmitField[]
}

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

const useHubspotFormSubmit = () => {
  return useMutation({
    mutationFn: ({ formId, fields }: HubspotFormSubmitMutationParams) =>
      hubspotApi
        .hubspotFormsSubmit({
          form_id: formId,
          HubspotFormSubmitRequestRequest: { fields },
        })
        .then((response) => response.data),
  })
}

export {
  hubspotKeys,
  hubspotQueries,
  useHubspotFormsList,
  useHubspotFormDetail,
  useHubspotFormSubmit,
}

export type {
  HubspotApiHubspotFormsDetailRetrieveRequest,
  HubspotApiHubspotFormsListRequest,
  HubspotFormsListResponse,
  HubspotFormDetailResponse,
  HubspotSubmitField,
  HubspotSubmitFieldValue,
  HubspotFormSubmitMutationParams,
  HubspotFormSubmitResponse,
}
