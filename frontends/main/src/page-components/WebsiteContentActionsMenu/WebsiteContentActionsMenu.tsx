"use client"

import React from "react"
import { SimpleMenu, styled, theme } from "ol-components"
import type { SimpleMenuItem, MenuOverrideProps } from "ol-components"
import { ActionButton } from "@mitodl/smoot-design"
import { RiEyeOffLine, RiMore2Fill } from "@remixicon/react"
import { useQueryClient } from "@tanstack/react-query"
import { useWebsiteContentPartialUpdate } from "api/hooks/website_content"
import { Permission, useUserHasPermission } from "api/hooks/user"
import { newsEventsKeys } from "api/hooks/newsEvents"
import { SILENCE_ERROR_TOAST } from "api/mutation-meta"
import { showUnpublishWebsiteContentDialog } from "@/page-components/WebsiteContentDialogs/PublishWebsiteContentDialog"

/**
 * The design's 32px white square, sitting over the top-right of the card.
 *
 * `size="small"` is already 32px; the rest is the design's white fill and 4px
 * radius, which `variant="text"` leaves transparent because it is normally
 * used on a plain background rather than on top of an image.
 */
const DotsButton = styled(ActionButton)(({ theme }) => ({
  backgroundColor: theme.custom.colors.white,
  borderRadius: "4px",
  color: theme.custom.colors.darkGray2,
  ":hover:not(:disabled)": {
    backgroundColor: theme.custom.colors.lightGray1,
  },
  /* The design's icon is 18px, where ActionButton's own default is 1em. */
  svg: {
    width: "18px",
    height: "18px",
  },
}))

const menuOverrideProps: MenuOverrideProps = {
  /* Drops from the button's bottom-right corner, as the design shows it. */
  anchorOrigin: { vertical: "bottom", horizontal: "right" },
  transformOrigin: { vertical: "top", horizontal: "right" },
  slotProps: {
    paper: {
      sx: {
        borderRadius: "4px",
        /* Shadow/04dp */
        boxShadow:
          "0px 2px 4px 0px rgba(37, 38, 43, 0.10), 0px 3px 8px 0px rgba(37, 38, 43, 0.12)",
        /**
         * The design insets each row by 24px and leaves 16px between rows. That
         * spacing is put on the items rather than the popover so the hover
         * target still spans the full width: MenuList's own 8px top and bottom
         * padding plus 8px on each item reproduces the design's 16px, and two
         * adjacent items give the 16px gap between them.
         */
        ".MuiMenuItem-root": {
          padding: "8px 24px",
          gap: "8px",
          ...theme.typography.subtitle3,
          color: theme.custom.colors.silverGrayDark,
        },
        /* ListItemIcon reserves 56px for alignment, which the 8px gap replaces. */
        ".MuiListItemIcon-root": {
          minWidth: 0,
          color: "inherit",
        },
        ".MuiListItemIcon-root svg": {
          width: "18px",
          height: "18px",
        },
      },
    },
  },
}

type WebsiteContentActionsMenuProps = {
  /** id of the WebsiteContent item the actions apply to. */
  contentId: number
  /** Display label for the content type, e.g. "Article". */
  contentLabel: string
  /** Names the trigger, so a listing does not repeat one label per row. */
  title: string
}

/**
 * The three-dot menu on a content listing card.
 *
 * Every action here edits content, so the menu renders nothing at all for a
 * user without that permission -- the check lives here rather than at each
 * callsite, so a new listing cannot leak the menu by forgetting it.
 *
 * Unpublishing is the only action, so callers are still responsible for the
 * conditions they alone know: on a draft the menu would open onto nothing.
 */
const WebsiteContentActionsMenu: React.FC<WebsiteContentActionsMenuProps> = ({
  contentId,
  contentLabel,
  title,
}) => {
  const canEditContent = useUserHasPermission(Permission.ArticleEditor)
  const queryClient = useQueryClient()
  const updateMutation = useWebsiteContentPartialUpdate({
    meta: SILENCE_ERROR_TOAST,
  })

  /* After the hooks above, which have to run on every render either way. */
  if (!canEditContent) {
    return null
  }

  const items: SimpleMenuItem[] = [
    {
      key: "unpublish",
      label: "Unpublish",
      icon: <RiEyeOffLine aria-hidden />,
      onClick: () =>
        showUnpublishWebsiteContentDialog(contentLabel, async () => {
          /**
           * The dialog holds itself open until this settles and shows the
           * failure inline if it rejects, which is also why the mutation
           * silences the global error toast. Awaited rather than returned
           * only to drop the resolved resource: `onConfirm` returns void.
           */
          await updateMutation.mutateAsync({
            id: contentId,
            is_published: false,
          })
          /**
           * Unpublishing a news item also tears down its news feed entry --
           * `WebsiteContentNewsPlugin` deletes the FeedItem -- so the feed the
           * news listing reads is stale too. The content mutation itself only
           * knows to invalidate website content, so that happens here.
           */
          await queryClient.invalidateQueries({
            queryKey: newsEventsKeys.listRoot(),
          })
        }),
    },
  ]

  return (
    <SimpleMenu
      items={items}
      menuOverrideProps={menuOverrideProps}
      trigger={
        <DotsButton
          size="small"
          variant="text"
          aria-label={`More options for ${title}`}
        >
          <RiMore2Fill />
        </DotsButton>
      }
    />
  )
}

export { WebsiteContentActionsMenu }
