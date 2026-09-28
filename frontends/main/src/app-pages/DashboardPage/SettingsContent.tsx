"use client"

import React from "react"
import {
  PlainList,
  Typography,
  Link,
  styled,
  Dialog,
  DialogActions,
  Skeleton,
} from "ol-components"
import { Button, ButtonLink, Checkbox } from "@mitodl/smoot-design"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { useUserMe } from "api/hooks/user"
import { useProfileMeMutation, useProfileMeQuery } from "api/hooks/profile"
import {
  useSearchSubscriptionDelete,
  useSearchSubscriptionList,
} from "api/hooks/searchSubscription"
import * as NiceModal from "@ebay/nice-modal-react"
import { FeatureFlags } from "@/common/feature_flags"
import { AccountAction, SETTINGS, accountAction } from "@/common/urls"
import AccountActionAlert from "./AccountActionAlert"
import { TitleText } from "./HomeContent"
const SOURCE_LABEL_DISPLAY = {
  topic: "Topic",
  unit: "MIT Unit",
  department: "MIT Academic Department",
  saved_search: "Saved Search",
}

const Actions = styled(DialogActions)({
  display: "flex",
  "> *": { flex: 1 },
})
const FollowList = styled(PlainList)(({ theme }) => ({
  borderRadius: "8px",
  background: theme.custom.colors.white,
  border: `1px solid ${theme.custom.colors.lightGray2}`,
}))

const SubtitleTitleText = styled(Typography)(({ theme }) => ({
  marginTop: "16px",
  marginBottom: "8px",

  color: theme.custom.colors.darkGray2,
  ...theme.typography.h5,
}))

const SubSubTitleText = styled(Typography)(({ theme }) => ({
  marginBottom: "16px",
  color: theme.custom.colors.darkGray2,
  ...theme.typography.body2,
}))

const SettingsHeader = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  alignSelf: "stretch",
  [theme.breakpoints.down("md")]: {
    paddingBottom: "8px",
  },
}))

const SettingsHeaderLeft = styled.div({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  flex: "1 0 0",
})

const SettingsHeaderRight = styled.div(({ theme }) => ({
  display: "flex",
  [theme.breakpoints.down("md")]: {
    display: "none",
  },
}))

const ListItem = styled.li(({ theme }) => [
  {
    padding: "16px 32px",
    display: "flex",
    gap: "16px",
    alignItems: "center",
    borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
    ":last-child": {
      borderBottom: "none",
    },
  },
])
const _ListItemBody = styled.div({
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  gap: "4px",
  flex: "1 0 0",
})
const Title = styled.span(({ theme }) => ({
  ...theme.typography.subtitle1,
  color: theme.custom.colors.darkGray2,
}))
const Subtitle = styled.span(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.custom.colors.silverGrayDark,
}))
type ListItemBodyProps = {
  children?: React.ReactNode
  title?: string
  subtitle?: string
}
const ListItemBody: React.FC<ListItemBodyProps> = ({
  children,
  title,
  subtitle,
}) => {
  return (
    <_ListItemBody>
      {children}
      <Title>{title}</Title>
      <Subtitle>{subtitle}</Subtitle>
    </_ListItemBody>
  )
}

const AccountActionRow = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "16px",
  marginBottom: "16px",
  [theme.breakpoints.down("sm")]: {
    alignItems: "flex-start",
    flexDirection: "column",
    gap: "8px",
  },
}))

const AccountActionLabel = styled.span(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.custom.colors.darkGray2,
}))

const AccountActionValue = styled.span(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.custom.colors.silverGrayDark,
}))

type AccountManagementProps = {
  email: string
}

/**
 * Email and password management. Both actions hand the user off to Keycloak,
 * which owns the credentials, and return them here with a confirmation.
 *
 * Hidden from SSO users, whose credentials belong to their institution.
 */
const AccountManagement: React.FC<AccountManagementProps> = ({ email }) => {
  const next = { pathname: SETTINGS, searchParams: null }

  return (
    <>
      <SubtitleTitleText>Email &amp; Password</SubtitleTitleText>
      <AccountActionRow>
        <AccountActionLabel>
          <b>Email:</b> <AccountActionValue>{email}</AccountActionValue>
        </AccountActionLabel>
        <ButtonLink
          variant="secondary"
          size="small"
          href={accountAction(AccountAction.UpdateEmail, next)}
        >
          Change Email
        </ButtonLink>
      </AccountActionRow>
      <AccountActionRow>
        <AccountActionLabel>
          <b>Password</b>
        </AccountActionLabel>
        <ButtonLink
          variant="secondary"
          size="small"
          href={accountAction(AccountAction.UpdatePassword, next)}
        >
          Change Password
        </ButtonLink>
      </AccountActionRow>
    </>
  )
}

type UnfollowDialogProps = {
  subscriptionIds?: number[]
  subscriptionName?: string
}
const UnfollowDialog = NiceModal.create(
  ({ subscriptionIds, subscriptionName }: UnfollowDialogProps) => {
    const modal = NiceModal.useModal()
    const subscriptionDelete = useSearchSubscriptionDelete()
    const unsubscribe = subscriptionDelete.mutate
    return (
      <Dialog
        {...NiceModal.muiDialogV5(modal)}
        title={subscriptionIds?.length === 1 ? "Unfollow" : "Unfollow All"}
        actions={
          <Actions>
            <Button variant="secondary" onClick={() => modal.remove()}>
              Cancel
            </Button>

            <Button
              data-testid="dialog-unfollow"
              onClick={async () =>
                subscriptionIds?.map((subscriptionId) =>
                  unsubscribe(subscriptionId, {
                    onSuccess: () => {
                      modal.remove()
                    },
                  }),
                )
              }
            >
              {subscriptionIds?.length === 1
                ? "Yes, Unfollow"
                : "Yes, Unfollow All"}
            </Button>
          </Actions>
        }
      >
        {subscriptionIds?.length === 1 ? (
          <>
            Are you sure you want to unfollow <b>{subscriptionName}</b>?
          </>
        ) : (
          <>
            Are you sure you want to <b>Unfollow All</b>? You will stop getting
            emails for all topics, academic departments, and MIT units you are
            following.
          </>
        )}
      </Dialog>
    )
  },
)

const SettingsContent: React.FC = () => {
  const { data: user } = useUserMe()
  const { data: profile } = useProfileMeQuery()
  const { mutateAsync: updateProfile } = useProfileMeMutation()

  const accountManagementEnabled = useFeatureFlagEnabled(
    FeatureFlags.AccountManagement,
  )

  const subscriptionList = useSearchSubscriptionList({
    enabled: !!user?.is_authenticated,
  })

  if (!user || subscriptionList.isLoading) {
    return <Skeleton variant="text" width={128} height={32} />
  }

  const showAccountManagement =
    accountManagementEnabled && user.is_authenticated && !user.is_sso_user

  return (
    <div id="user-settings">
      <TitleText component="h1">Settings</TitleText>
      <AccountActionAlert />
      {showAccountManagement ? <AccountManagement email={user.email} /> : null}
      <SubtitleTitleText>Email Preferences</SubtitleTitleText>
      <Checkbox
        name="email_optin"
        label="Receive emails from MIT Learn"
        checked={profile?.email_optin ?? true}
        onChange={(e) => updateProfile({ email_optin: e.target.checked })}
      />
      <SettingsHeader>
        <SettingsHeaderLeft>
          <SubtitleTitleText>Following</SubtitleTitleText>
          <SubSubTitleText>
            All topics, academic departments, and MIT units you are following.
          </SubSubTitleText>
        </SettingsHeaderLeft>
        {subscriptionList?.data && subscriptionList?.data?.length > 1 ? (
          <SettingsHeaderRight>
            <Button
              data-testid="unfollow-all"
              variant="tertiary"
              onClick={() =>
                NiceModal.show(UnfollowDialog, {
                  subscriptionIds: subscriptionList?.data?.map(
                    (subscriptionItem) => subscriptionItem.id,
                  ),
                  subscriptionName: "All",
                  id: "all",
                })
              }
            >
              Unfollow All
            </Button>
          </SettingsHeaderRight>
        ) : (
          <></>
        )}
      </SettingsHeader>
      <FollowList data-testid="follow-list">
        {subscriptionList?.data?.map((subscriptionItem) => (
          <ListItem key={subscriptionItem.id}>
            <ListItemBody
              title={subscriptionItem.source_description}
              subtitle={
                SOURCE_LABEL_DISPLAY[
                  subscriptionItem.source_label as keyof typeof SOURCE_LABEL_DISPLAY
                ]
              }
            />
            <Link
              color="red"
              onClick={() =>
                NiceModal.show(UnfollowDialog, {
                  subscriptionIds: [subscriptionItem.id],
                  subscriptionName: subscriptionItem.source_description,
                  id: subscriptionItem.id.toString(),
                })
              }
            >
              Unfollow
            </Link>
          </ListItem>
        ))}
      </FollowList>
    </div>
  )
}

export { SettingsContent }
