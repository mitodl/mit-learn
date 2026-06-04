import { Params } from "k6/http"
import { BACKEND_BASE_URL } from "../../config.ts"
import { MITLearnAPIClient as V0Client } from "./v0/api.ts"
import { MITLearnAPIClient as V1Client } from "./v1/api.ts"
import { getAccessToken } from "../../auth.ts"

function getCommonRequestParameters(
  extraHeaders: Record<string, string> = {},
): Params {
  const accessToken = getAccessToken()

  return {
    headers: {
      ...(!!accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...extraHeaders,
    },
  }
}

export function createV0Client(
  extraHeaders: Record<string, string> = {},
): V0Client {
  return new V0Client({
    baseUrl: BACKEND_BASE_URL,
    commonRequestParameters: getCommonRequestParameters(extraHeaders),
  })
}
export function createV1Client(
  extraHeaders: Record<string, string> = {},
): V1Client {
  return new V1Client({
    baseUrl: BACKEND_BASE_URL,
    commonRequestParameters: getCommonRequestParameters(extraHeaders),
  })
}
