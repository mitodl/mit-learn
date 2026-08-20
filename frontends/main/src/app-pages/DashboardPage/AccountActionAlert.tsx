"use client"

import React from "react"
import { Alert } from "@mitodl/smoot-design"
import {
  ACCOUNT_ACTION_PARAM,
  ACCOUNT_ACTION_STATUS_PARAM,
  AccountAction,
  AccountActionStatus,
} from "@/common/urls"
import {
  useConsumeSearchParamsOnce,
  type ConsumedSearchParamsResult,
} from "@/common/useConsumeSearchParamsOnce"

type AccountActionResult = {
  action: AccountAction
  status: AccountActionStatus
}

const KEYS_TO_REMOVE = [
  ACCOUNT_ACTION_PARAM,
  ACCOUNT_ACTION_STATUS_PARAM,
] as const

const isAccountAction = (value: string | null): value is AccountAction =>
  Object.values(AccountAction).includes(value as AccountAction)

const isAccountActionStatus = (
  value: string | null,
): value is AccountActionStatus =>
  Object.values(AccountActionStatus).includes(value as AccountActionStatus)

const parseAccountActionResult = (
  searchParams: URLSearchParams,
): ConsumedSearchParamsResult<AccountActionResult> | null => {
  const action = searchParams.get(ACCOUNT_ACTION_PARAM)
  const status = searchParams.get(ACCOUNT_ACTION_STATUS_PARAM)

  if (action === null && status === null) {
    return null
  }

  if (!isAccountAction(action) || !isAccountActionStatus(status)) {
    console.warn("Unrecognized account action redirect params", action, status)
    return { value: undefined, keysToRemove: KEYS_TO_REMOVE }
  }

  return { value: { action, status }, keysToRemove: KEYS_TO_REMOVE }
}

const SUCCESS_MESSAGES: Record<AccountAction, string> = {
  [AccountAction.UpdateEmail]:
    "Check your inbox for a confirmation link to finish updating your email address.",
  [AccountAction.UpdatePassword]: "Your password has been updated.",
}

const ERROR_MESSAGES: Record<AccountAction, string> = {
  [AccountAction.UpdateEmail]:
    "We couldn't update your email address. Please try again.",
  [AccountAction.UpdatePassword]:
    "We couldn't update your password. Please try again.",
}

const UNAVAILABLE_MESSAGES: Record<AccountAction, string> = {
  [AccountAction.UpdateEmail]:
    "Your email address is managed by your organization's single sign-on provider.",
  [AccountAction.UpdatePassword]:
    "Your password is managed by your organization's single sign-on provider.",
}

/**
 * Shows the outcome of a Keycloak account action once, on returning to the
 * settings page. Cancelling the Keycloak form is a deliberate choice by the
 * user, so it passes without an alert.
 */
const AccountActionAlert: React.FC = () => {
  const result = useConsumeSearchParamsOnce(parseAccountActionResult)

  if (!result) return null

  switch (result.status) {
    case AccountActionStatus.Success:
      return (
        <Alert severity="success" closable label="Success!">
          {SUCCESS_MESSAGES[result.action]}
        </Alert>
      )
    case AccountActionStatus.Unavailable:
      return (
        <Alert severity="warning" closable>
          {UNAVAILABLE_MESSAGES[result.action]}
        </Alert>
      )
    case AccountActionStatus.Error:
      return (
        <Alert severity="error" closable>
          {ERROR_MESSAGES[result.action]}
        </Alert>
      )
    default:
      return null
  }
}

export default AccountActionAlert
export { parseAccountActionResult }
