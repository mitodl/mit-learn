"use client"

import React from "react"
import { SimpleSelect, Typography, styled } from "ol-components"
import { Checkbox } from "@mitodl/smoot-design"
import type { AxiosError } from "axios"
import {
  useNotificationPreferences,
  useUpdateNotificationPreference,
} from "api/mitxonline-hooks/notificationPreferences"
import type {
  NotificationPreferenceUpdate,
  PreferenceConfig,
  PreferenceGroup,
} from "api/mitxonline-hooks/notificationPreferences"

/**
 * Course notification settings, ported from MITx Online's account settings
 * page. MITx Online proxies Open edX, which owns this state, so the section
 * renders whatever the LMS reports rather than anything stored in Learn.
 */

const APP_LABELS: Record<string, string> = {
  discussion: "Discussions",
  grading: "Grading",
  updates: "Updates",
}

const TYPE_LABELS: Record<string, string> = {
  grouped_notification: "Activity notifications",
  new_discussion_post: "New discussion posts",
  new_question_post: "New question posts",
  new_instructor_all_learners_post: "New posts from instructors",
  new_comment_on_response: "Comments on your responses",
  new_comment: "Comments on your posts",
  new_response: "Responses to your posts",
  response_on_followed_post: "Responses on posts you follow",
  comment_on_followed_post: "Comments on posts you follow",
  response_endorsed_on_thread: "Endorsements on your posts",
  response_endorsed: "Endorsements of your responses",
  content_reported: "Reported content",
  course_updates: "Course updates",
  ora_grade_assigned: "Essay assignment grade received",
  ora_reminder: "Essay assignment reminders",
  ora_staff_notifications: "Essay assignments awaiting grading",
}

/**
 * The API only returns an `info` string for a couple of types, so descriptions
 * live here to keep every row consistent. Rows still fall back to the API's
 * `info` for any type added upstream that we do not know about yet.
 */
const TYPE_DESCRIPTIONS: Record<string, string> = {
  grouped_notification:
    "Responses, comments and endorsements on your posts and on posts you follow.",
  new_discussion_post: "When someone starts a new discussion in your courses.",
  new_question_post: "When someone posts a new question in your courses.",
  new_instructor_all_learners_post:
    "When the course team posts an update to everyone.",
  new_comment_on_response: "When someone comments on one of your responses.",
  new_comment: "When someone comments on one of your posts.",
  new_response: "When someone responds to one of your posts.",
  response_on_followed_post: "When someone responds to a post you follow.",
  comment_on_followed_post: "When someone comments on a post you follow.",
  response_endorsed_on_thread:
    "When the course team endorses a response on your post.",
  response_endorsed: "When the course team endorses one of your responses.",
  content_reported: "When a learner reports a post for review.",
  course_updates: "Announcements and updates from the course team.",
  ora_grade_assigned:
    "When a peer or the course team grades your essay assignment.",
  ora_reminder: "When you still have peer or self reviews to complete.",
  ora_staff_notifications:
    "When an essay assignment is waiting for your review.",
}

const EMAIL_CADENCES = ["Daily", "Weekly", "Immediately"]

const CADENCE_OPTIONS = EMAIL_CADENCES.map((cadence) => ({
  value: cadence,
  label: cadence,
}))

const SectionTitle = styled(Typography)(({ theme }) => ({
  marginTop: "16px",
  marginBottom: "8px",
  color: theme.custom.colors.darkGray2,
  ...theme.typography.h5,
})) as typeof Typography

const Intro = styled(Typography)(({ theme }) => ({
  marginBottom: "16px",
  color: theme.custom.colors.darkGray2,
  ...theme.typography.body2,
}))

const GroupTitle = styled(Typography)(({ theme }) => ({
  marginTop: "16px",
  marginBottom: "8px",
  color: theme.custom.colors.darkGray2,
  ...theme.typography.subtitle1,
})) as typeof Typography

const Row = styled.div(({ theme }) => ({
  display: "flex",
  gap: "16px",
  alignItems: "center",
  padding: "12px 0",
  borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
  ":last-of-type": {
    borderBottom: "none",
  },
  [theme.breakpoints.down("sm")]: {
    alignItems: "flex-start",
    flexDirection: "column",
    gap: "8px",
  },
}))

const RowText = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  flex: "1 0 0",
})

const RowLabel = styled.span(({ theme }) => ({
  ...theme.typography.subtitle2,
  color: theme.custom.colors.darkGray2,
}))

const RowDescription = styled.span(({ theme }) => ({
  ...theme.typography.body3,
  color: theme.custom.colors.silverGrayDark,
}))

const Controls = styled.div({
  display: "flex",
  alignItems: "center",
  gap: "16px",
})

const labelForApp = (app: string) => APP_LABELS[app] || app

const labelForType = (type: string) => TYPE_LABELS[type] || type

/** Our own copy first, then whatever the API happened to send. */
const descriptionForType = (type: string, info: string) =>
  TYPE_DESCRIPTIONS[type] || info || ""

/**
 * The API returns `non_editable` keyed by notification type. Older releases
 * returned a flat list for the whole app, so tolerate both.
 */
const lockedChannelsFor = (
  group: PreferenceGroup,
  notificationType: string,
): string[] => {
  const nonEditable = group.non_editable
  if (!nonEditable) return []
  if (Array.isArray(nonEditable)) return nonEditable
  return nonEditable[notificationType] || []
}

type PreferenceRowProps = {
  notificationApp: string
  notificationType: string
  config: PreferenceConfig
  nonEditable: string[]
  showEmail: boolean
  onChange: (update: NotificationPreferenceUpdate) => void
}

const PreferenceRow: React.FC<PreferenceRowProps> = ({
  notificationApp,
  notificationType,
  config,
  nonEditable,
  showEmail,
  onChange,
}) => {
  const label = labelForType(notificationType)
  const description = descriptionForType(notificationType, config.info)
  const webLocked = nonEditable.includes("web")
  const emailLocked = nonEditable.includes("email")

  return (
    <Row data-testid={`notification-row-${notificationType}`}>
      <RowText>
        <RowLabel>{label}</RowLabel>
        {description ? <RowDescription>{description}</RowDescription> : null}
      </RowText>
      <Controls role="group" aria-label={label}>
        <Checkbox
          name={`web-${notificationApp}-${notificationType}`}
          label="On site"
          checked={config.web}
          disabled={webLocked}
          onChange={() =>
            onChange({
              notification_app: notificationApp,
              notification_type: notificationType,
              notification_channel: "web",
              value: !config.web,
            })
          }
        />
        {showEmail ? (
          <>
            <Checkbox
              name={`email-${notificationApp}-${notificationType}`}
              label="Email"
              checked={config.email}
              disabled={emailLocked}
              onChange={() =>
                onChange({
                  notification_app: notificationApp,
                  notification_type: notificationType,
                  notification_channel: "email",
                  value: !config.email,
                })
              }
            />
            {/*
              The cadence only means something while email delivery is on, but
              it stays in place disabled rather than appearing and disappearing:
              a control that pops into the row on click shifts the other rows,
              and the stored cadence is worth seeing even when email is off.
            */}
            <SimpleSelect
              size="small"
              name={`cadence-${notificationApp}-${notificationType}`}
              options={CADENCE_OPTIONS}
              value={config.email_cadence}
              disabled={!config.email || emailLocked}
              renderValue={(value) => `${value}`}
              onChange={(event) =>
                onChange({
                  notification_app: notificationApp,
                  notification_type: notificationType,
                  notification_channel: "email_cadence",
                  email_cadence: `${event.target.value}`,
                })
              }
            />
          </>
        ) : null}
      </Controls>
    </Row>
  )
}

const Section: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  /*
   * The section always renders — including when there is nothing to show — so
   * that /dashboard/settings#notifications, the target Open edX's notifications
   * gear links to, still resolves.
   */
  <section id="notifications">
    <SectionTitle component="h2">Notifications</SectionTitle>
    {children}
  </section>
)

/** Why the controls cannot be shown, or null to show them. */
const noticeFor = ({
  isPending,
  error,
  showPreferences,
}: {
  isPending: boolean
  error: unknown
  showPreferences?: boolean
}): string | null => {
  if (isPending) return "Loading your notification settings..."
  if (error) {
    const status = (error as AxiosError)?.response?.status
    return status === 409
      ? "Your course account is still being set up. Please check back shortly."
      : "We could not load your notification settings. Please try again later."
  }
  // The LMS gates the whole feature with show_preferences.
  if (showPreferences === false) {
    return "Notifications are not enabled for your courses."
  }
  return null
}

const NotificationPreferences: React.FC = () => {
  const preferences = useNotificationPreferences()
  const updatePreference = useUpdateNotificationPreference({
    meta: {
      getErrorMessage: (error) =>
        (error as AxiosError)?.response?.status === 429
          ? "Too many changes at once. Please wait a moment and try again."
          : "We could not save that notification setting. Please try again.",
    },
  })

  const notice = noticeFor({
    isPending: preferences.isPending,
    error: preferences.error,
    showPreferences: preferences.data?.show_preferences,
  })

  if (notice) {
    return (
      <Section>
        <Intro>{notice}</Intro>
      </Section>
    )
  }

  const byApp = preferences.data?.data ?? {}
  const apps = Object.keys(byApp).filter((app) => byApp[app].enabled)
  const showEmail = preferences.data?.show_email_preferences !== false

  if (apps.length === 0) {
    return (
      <Section>
        <Intro>You have no notification settings to manage yet.</Intro>
      </Section>
    )
  }

  return (
    <Section>
      <Intro>Choose how you hear about activity in your courses.</Intro>
      {apps.map((app) => {
        const group = byApp[app]
        const types = group.notification_types || {}
        return (
          <div key={app} data-testid={`notification-group-${app}`}>
            <GroupTitle component="h3">{labelForApp(app)}</GroupTitle>
            {Object.keys(types).map((type) => (
              <PreferenceRow
                key={type}
                notificationApp={app}
                notificationType={type}
                config={types[type]}
                nonEditable={lockedChannelsFor(group, type)}
                showEmail={showEmail}
                onChange={(update) => updatePreference.mutate(update)}
              />
            ))}
          </div>
        )
      })}
    </Section>
  )
}

export default NotificationPreferences
export { descriptionForType, lockedChannelsFor, PreferenceRow }
