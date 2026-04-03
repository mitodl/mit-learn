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
  pageUri?: string
  hutk?: string
  pageTitle?: string
  userAgent?: string
  timestamp?: number
  locale?: string
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
    mutationFn: ({
      formId,
      fields,
      pageUri,
      hutk,
      pageTitle,
      userAgent,
      timestamp,
      locale,
    }: HubspotFormSubmitMutationParams) => {
      const resolvedPageUri =
        pageUri ??
        (typeof window !== "undefined" ? window.location.href : undefined)

      // Capture automatic context properties (matching HubSpot embed script)
      const resolvedHutk =
        hutk ??
        (typeof window !== "undefined"
          ? document.cookie
              .split("; ")
              .find((row) => row.startsWith("__hstc="))
              ?.split("=")[1]
          : undefined)

      const resolvedPageTitle =
        pageTitle ??
        (typeof document !== "undefined" ? document.title : undefined)

      const resolvedUserAgent =
        userAgent ??
        (typeof navigator !== "undefined" ? navigator.userAgent : undefined)

      const resolvedTimestamp =
        timestamp ?? (typeof Date !== "undefined" ? Date.now() : undefined)

      const resolvedLocale =
        locale ??
        (typeof navigator !== "undefined" ? navigator.language : undefined)

      return hubspotApi
        .hubspotFormsSubmit({
          form_id: formId,
          HubspotFormSubmitRequestRequest: {
            fields,
            ...(resolvedPageUri ? { page_uri: resolvedPageUri } : {}),
            ...(resolvedHutk ? { hutk: resolvedHutk } : {}),
            ...(resolvedPageTitle ? { page_title: resolvedPageTitle } : {}),
            ...(resolvedUserAgent ? { user_agent: resolvedUserAgent } : {}),
            ...(resolvedTimestamp ? { timestamp: resolvedTimestamp } : {}),
            ...(resolvedLocale ? { locale: resolvedLocale } : {}),
          },
        })
        .then((response) => response.data)
    },
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
