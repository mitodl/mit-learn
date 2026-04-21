import { Params } from "k6/http"
import { BACKEND_BASE_URL } from "../../config.ts"
import { MITLearnAPIClient as V0Client } from "./v0/api.ts"
import { MITLearnAPIClient as V1Client } from "./v1/api.ts"
import { getAccessToken } from "../../auth.ts"

function getCommonRequestParameters(): Params {
  const accessToken = getAccessToken()

  return {
    headers: {
      ...(!!accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  }
}

export function createV0Client(): V0Client {
  return new V0Client({
    baseUrl: BACKEND_BASE_URL,
    commonRequestParameters: getCommonRequestParameters(),
  })
}
export function createV1Client(): V1Client {
  return new V1Client({
    baseUrl: BACKEND_BASE_URL,
    commonRequestParameters: getCommonRequestParameters(),
  })
}
