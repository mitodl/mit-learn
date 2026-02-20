import React, { useCallback, useMemo, useState } from "react"
import { LearningResourceCard } from "ol-components"
import NiceModal from "@ebay/nice-modal-react"
import type { LearningResourceCardProps } from "ol-components"
import {
  AddToLearningPathDialog,
  AddToUserListDialog,
} from "../Dialogs/AddToListDialog"
import { useResourceDrawerHref } from "../LearningResourceDrawer/useResourceDrawerHref"
import { useUserMe } from "api/hooks/user"
import { LearningResource } from "api"
import { SignupPopover } from "../SignupPopover/SignupPopover"
import { useIsUserListMember } from "api/hooks/userLists"
import { useLearningResourceDetailSetCache } from "api/hooks/learningResources"
import { useIsLearningPathMember } from "api/hooks/learningPaths"

export const useResourceCard = (resource?: LearningResource | null) => {
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

  const onClick = useLearningResourceDetailSetCache(resource)

  return {
    onClick,
    getDrawerHref,
    anchorEl,
    handleClosePopover,
    handleAddToLearningPathClick,
    handleAddToUserListClick,
    inUserList,
    inLearningPath,
  }
}

type HeadingElement = "h1" | "h2" | "h3" | "h4" | "h5" | "h6"

const subheadingMap: Record<HeadingElement, number> = {
  h1: 2,
  h2: 3,
  h3: 4,
  h4: 5,
  h5: 6,
  h6: 6,
}

type ResourceCardProps = Omit<
  LearningResourceCardProps,
  "href" | "onAddToLearningPathClick" | "onAddToUserListClick"
> & {
  headingLevel?: number
  parentHeadingEl?: HeadingElement
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
  parentHeadingEl,
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
    onClick,
  } = useResourceCard(resource)

  const headingLevel = parentHeadingEl ? subheadingMap[parentHeadingEl] : 6
  return (
    <>
      <LearningResourceCard
        onClick={onClick}
        resource={resource}
        href={resource ? getDrawerHref(resource.id) : undefined}
        onAddToLearningPathClick={handleAddToLearningPathClick}
        onAddToUserListClick={handleAddToUserListClick}
        inUserList={inUserList}
        inLearningPath={inLearningPath}
        headingLevel={headingLevel}
        {...others}
      />
      <SignupPopover anchorEl={anchorEl} onClose={handleClosePopover} />
    </>
  )
}

export { ResourceCard }
export type { ResourceCardProps }
