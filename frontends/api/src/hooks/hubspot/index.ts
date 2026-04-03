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

const HUBSPOT_UTK_COOKIE = "hubspotutk"
const HUBSPOT_UTK_MAX_AGE = 34190000 // ~13 months, matching HubSpot's tracking script

function generateHubspotUtk(): string {
  // HubSpot's utk is a 32-char hex string (UUID without dashes)
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "")
  }
  return Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join("")
}

/**
 * Returns the existing hubspotutk cookie value, or generates and sets a new
 * one if absent. This replicates what the HubSpot tracking script does, so
 * form submissions can be linked to contacts without embedding that script.
 */
function getOrCreateHubspotUtk(): string | undefined {
  if (typeof document === "undefined") return undefined

  const existing = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${HUBSPOT_UTK_COOKIE}=`))
    ?.split("=")[1]

  if (existing) return existing

  const utk = generateHubspotUtk()
  document.cookie = `${HUBSPOT_UTK_COOKIE}=${utk}; path=/; max-age=${HUBSPOT_UTK_MAX_AGE}; SameSite=Lax`
  return utk
}

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
  pageName?: string
  submittedAt?: number
  recaptchaToken?: string | null
  // Backward-compatible aliases
  pageTitle?: string
  timestamp?: number
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
      pageName,
      submittedAt,
      recaptchaToken,
      pageTitle,
      timestamp,
    }: HubspotFormSubmitMutationParams) => {
      const resolvedPageUri =
        pageUri ??
        (typeof window !== "undefined" ? window.location.href : undefined)

      // Capture automatic context properties (matching HubSpot embed script).
      // getOrCreateHubspotUtk generates the cookie if absent, so submissions
      // can be linked to contacts even without the HubSpot tracking script.
      const resolvedHutk = hutk ?? getOrCreateHubspotUtk()

      const resolvedPageName =
        pageName ??
        pageTitle ??
        (typeof document !== "undefined" ? document.title : undefined)

      const resolvedSubmittedAt =
        submittedAt ??
        timestamp ??
        (typeof Date !== "undefined" ? Date.now() : undefined)

      return hubspotApi
        .hubspotFormsSubmit({
          form_id: formId,
          HubspotFormSubmitRequestRequest: {
            fields,
            ...(resolvedPageUri ? { page_uri: resolvedPageUri } : {}),
            ...(resolvedHutk ? { hutk: resolvedHutk } : {}),
            ...(resolvedPageName ? { page_name: resolvedPageName } : {}),
            ...(resolvedSubmittedAt
              ? { submitted_at: resolvedSubmittedAt }
              : {}),
            ...(recaptchaToken ? { recaptcha_token: recaptchaToken } : {}),
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
