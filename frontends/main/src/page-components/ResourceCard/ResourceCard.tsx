import React, { useCallback, useMemo, useState } from "react"
import { LearningResourceCard } from "ol-components/LearningResourceCard/LearningResourceCard"
import type { LearningResourceCardProps } from "ol-components/LearningResourceCard/LearningResourceCard"
import { LearningResourceListCard } from "ol-components/LearningResourceCard/LearningResourceListCard"
import { LearningResourceListCardCondensed } from "ol-components/LearningResourceCard/LearningResourceListCardCondensed"
import NiceModal from "@ebay/nice-modal-react"
import {
  AddToLearningPathDialog,
  AddToUserListDialog,
} from "../Dialogs/AddToListDialog"
import { useResourceDrawerHref } from "../LearningResourceDrawer/useResourceDrawerHref"
import { useUserMe } from "api/hooks/user"
import { LearningResource } from "api"
import { SignupPopover } from "../SignupPopover/SignupPopover"
import { useIsUserListMember } from "api/hooks/userLists"
import { useIsLearningPathMember } from "api/hooks/learningPaths"

const useResourceCard = (resource?: LearningResource | null) => {
  const getDrawerHref = useResourceDrawerHref()
  const { data: user } = useUserMe()
  const { data: inUserList } = useIsUserListMember(resource?.id)
  const { data: inLearningPath } = useIsLearningPathMember(resource?.id)

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)

  const handleClosePopover = useCallback(() => {
    setAnchorEl(null)
  }, [])
  const handleAddToLearningPathClick: LearningResourceCardProps["onAddToLearningPathClick"] =
    useMemo(() => {
      if (user?.is_authenticated && user?.is_learning_path_editor) {
        return (event, resourceId: number) => {
          NiceModal.show(AddToLearningPathDialog, { resourceId })
        }
      }
      return null
    }, [user])

  const handleAddToUserListClick: LearningResourceCardProps["onAddToUserListClick"] =
    useMemo(() => {
      if (!user) {
        // user info is still loading
        return null
      }
      if (user.is_authenticated) {
        return (event, resourceId: number) => {
          NiceModal.show(AddToUserListDialog, { resourceId })
        }
      }
      return (event) => {
        setAnchorEl(event.currentTarget)
      }
    }, [user])

  return {
    getDrawerHref,
    anchorEl,
    handleClosePopover,
    handleAddToLearningPathClick,
    handleAddToUserListClick,
    inUserList,
    inLearningPath,
  }
}

type ResourceCardProps = Omit<
  LearningResourceCardProps,
  "href" | "onAddToLearningPathClick" | "onAddToUserListClick"
> & {
  condensed?: boolean
  list?: boolean
}

/**
 * Just like `ol-components/LearningResourceCard`, but with builtin actions:
 *  - click opens the Resource Drawer
 *  - onAddToListClick opens the Add to List modal
 *    - for unauthenticated users, a popover prompts signup instead.
 *  - onAddToLearningPathClick opens the Add to Learning Path modal
 */
const ResourceCard: React.FC<ResourceCardProps> = ({
  resource,
  condensed,
  list,
  ...others
}) => {
  const {
    getDrawerHref,
    anchorEl,
    handleClosePopover,
    handleAddToLearningPathClick,
    handleAddToUserListClick,
    inUserList,
    inLearningPath,
  } = useResourceCard(resource)
  const CardComponent =
    list && condensed
      ? LearningResourceListCardCondensed
      : list
        ? LearningResourceListCard
        : LearningResourceCard
  return (
    <>
      <CardComponent
        resource={resource}
        href={resource ? getDrawerHref(resource.id) : undefined}
        onAddToLearningPathClick={handleAddToLearningPathClick}
        onAddToUserListClick={handleAddToUserListClick}
        inUserList={inUserList}
        inLearningPath={inLearningPath}
        {...others}
      />
      <SignupPopover anchorEl={anchorEl} onClose={handleClosePopover} />
    </>
  )
}

export { ResourceCard }
export type { ResourceCardProps }
