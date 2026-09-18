import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import type { MutationHookOptions } from "../../../mutations/mutationMeta"
import mitxAxios from "../../axios"
import {
  NOTIFICATION_PREFERENCES_URL,
  notificationPreferencesKeys,
  notificationPreferencesQueries,
} from "./queries"
import type {
  NotificationPreferences,
  NotificationPreferenceUpdate,
  PreferenceConfig,
  PreferenceGroup,
} from "./queries"

type UseNotificationPreferencesOptions = {
  enabled?: boolean
}

const useNotificationPreferences = ({
  enabled = true,
}: UseNotificationPreferencesOptions = {}) => {
  return useQuery({
    ...notificationPreferencesQueries.detail(),
    enabled,
  })
}

/**
 * Open edX updates one channel per request, so each toggle or cadence change is
 * its own mutation.
 *
 * The response body is not enough to render from — the LMS fans a change to a
 * grouped type out to several types — so we re-read on success rather than
 * patching the cache.
 */
const useUpdateNotificationPreference = ({
  meta,
}: MutationHookOptions = {}) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (update: NotificationPreferenceUpdate) =>
      mitxAxios.put(NOTIFICATION_PREFERENCES_URL, update),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: notificationPreferencesKeys.detail(),
      })
    },
    meta,
  })
}

export {
  useNotificationPreferences,
  useUpdateNotificationPreference,
  notificationPreferencesQueries,
  notificationPreferencesKeys,
}
export type {
  NotificationPreferences,
  NotificationPreferenceUpdate,
  PreferenceConfig,
  PreferenceGroup,
}
