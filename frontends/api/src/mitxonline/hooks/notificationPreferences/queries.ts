import { queryOptions } from "@tanstack/react-query"

import mitxAxios from "../../axios"

/**
 * MITx Online proxies these straight through from Open edX, which owns the
 * state. The endpoint is excluded from MITx Online's OpenAPI schema, so there
 * is no generated client for it and we call it through the configured axios
 * instance instead.
 */
const NOTIFICATION_PREFERENCES_URL = "/api/notification-preferences/"

type NotificationChannel = "web" | "email" | "email_cadence"

type PreferenceConfig = {
  web: boolean
  push: boolean
  email: boolean
  email_cadence: string
  info: string
}

type PreferenceGroup = {
  enabled: boolean
  /**
   * Keyed by notification type -> the channels that type locks, e.g.
   * `{ new_discussion_post: ["push"] }`. Not a flat list.
   */
  non_editable: Record<string, string[]> | string[] | null
  notification_types: Record<string, PreferenceConfig>
}

type NotificationPreferences = {
  data?: Record<string, PreferenceGroup> | null
  /** The LMS gates the whole feature with this. */
  show_preferences?: boolean
  show_email_preferences?: boolean
}

type NotificationPreferenceUpdate = {
  notification_app: string
  notification_type: string
  notification_channel: NotificationChannel
} & ({ value: boolean } | { email_cadence: string })

const notificationPreferencesKeys = {
  root: ["mitxonline", "notificationPreferences"],
  detail: () => [...notificationPreferencesKeys.root, "detail"],
}

const notificationPreferencesQueries = {
  detail: () =>
    queryOptions({
      queryKey: notificationPreferencesKeys.detail(),
      queryFn: async (): Promise<NotificationPreferences> => {
        return mitxAxios
          .get(NOTIFICATION_PREFERENCES_URL)
          .then((res) => res.data)
      },
      /**
       * A 409 means the learner has no Open edX account yet, and a 4xx will not
       * start working by asking again. Retrying only delays the notice the
       * section shows in its place.
       */
      retry: false,
    }),
}

export {
  notificationPreferencesQueries,
  notificationPreferencesKeys,
  NOTIFICATION_PREFERENCES_URL,
}
export type {
  NotificationChannel,
  NotificationPreferences,
  NotificationPreferenceUpdate,
  PreferenceConfig,
  PreferenceGroup,
}
