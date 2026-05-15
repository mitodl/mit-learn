import { SharedArray } from "k6/data"

export type AuthCredential = {
  email: string
  password: string
}

export function getAccessToken(): string | null {
  return __ENV.AUTH_ACCESS_TOKEN
}

export function hasAccessToken(): boolean {
  return !getAccessToken()
}

function _validate_credentials(credentials) {
  if (!Array.isArray(credentials)) {
    throw Error("Expected an array of credentials")
  }

  for (let index = 0; index < credentials.length; index++) {
    const credential = credentials[index]
    if (!Object.hasOwn(credential, "email")) {
      throw Error(`User entry is missing 'email' at index ${index}`)
    }
    if (!Object.hasOwn(credential, "password")) {
      throw Error(`User entry is missing 'password' at index ${index}`)
    }
  }
}

export const credentials: AuthCredential[] = new SharedArray(
  "credentials",
  function () {
    if (!__ENV.USERS_JSON_FILE) {
      return []
    }

    const parsed = JSON.parse(open(__ENV.USERS_JSON_FILE))

    _validate_credentials(parsed)

    return parsed
  },
)
