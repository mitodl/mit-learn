import { SharedArray } from "k6/data"

export function getAccessToken(): String {
  return __ENV.AUTH_ACCESS_TOKEN
}

export const users = new SharedArray("users", function () {
  if (!__ENV.USERS_JSON_FILE) {
    return []
  }

  return JSON.parse(open(__ENV.USERS_JSON_FILE))
})
