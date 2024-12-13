import React, { useCallback } from "react"
import { RiAddLine } from "@remixicon/react"
import { usePostHog } from "posthog-js/react"
import styled from "@emotion/styled"
import { Typography } from "ol-components/ThemeProvider/typography"
import { LoadingSpinner } from "ol-components/LoadingSpinner/LoadingSpinner"
import { CheckboxChoiceField } from "ol-components/Checkbox/CheckboxChoiceField"
import { Button } from "ol-components/Button/Button"
import { FormDialog } from "ol-components/FormDialog/FormDialog"
import { DialogActions } from "ol-components/Dialog/Dialog"
import NiceModal, { muiDialogV5 } from "@ebay/nice-modal-react"

import type { LearningPathResource, LearningResource, UserList } from "api"

import {
  useLearningResourceSetUserListRelationships,
  useLearningResourcesDetail,
  useLearningResourceSetLearningPathRelationships,
} from "api/hooks/learningResources"
import { useUserListList, useUserListMemberList } from "api/hooks/userLists"
import {
  useLearningPathsList,
  useLearningPathMemberList,
} from "api/hooks/learningPaths"
import { manageListDialogs } from "@/page-components/ManageListDialogs/ManageListDialogs"
import { ListType } from "api/constants"
import { useFormik } from "formik"

const LIST_LIMIT = 100

const ResourceTitle = styled.span({
  fontStyle: "italic",
})

const Actions = styled(DialogActions)({
  display: "flex",
  "> *": { flex: 1 },
})

type AddToListDialogInnerProps = {
  listType: ListType
  resource: LearningResource | undefined
  lists: LearningPathResource[] | UserList[]
  isReady: boolean
}
const AddToListDialogInner: React.FC<AddToListDialogInnerProps> = ({
  listType,
  resource,
  lists,
  isReady,
}) => {
  const modal = NiceModal.useModal()
  const handleCreate = useCallback(() => {
    if (listType === ListType.LearningPath) {
      manageListDialogs.upsertLearningPath()
    } else if (listType === ListType.UserList) {
      manageListDialogs.upsertUserList()
    }
  }, [listType])
  const { data: userListValues, isLoading: isUserListLoading } =
    useUserListMemberList(resource?.id)
  const { data: learningPathValues, isLoading: isLearningPathLoading } =
    useLearningPathMemberList(resource?.id)

  const {
    isLoading: isSavingUserListRelationships,
    mutateAsync: setUserListRelationships,
  } = useLearningResourceSetUserListRelationships()
  const {
    isLoading: isSavingLearningPathRelationships,
    mutateAsync: setLearningPathRelationships,
  } = useLearningResourceSetLearningPathRelationships()

  const posthog = usePostHog()
  const isSaving =
    isSavingLearningPathRelationships || isSavingUserListRelationships

  let dialogTitle = "Add to list"
  if (listType === ListType.LearningPath) {
    dialogTitle = "Add to Learning List"
  } else if (listType === ListType.UserList) {
    dialogTitle = "Add to User List"
  }
  const listChoices = lists.map((list) => ({
    value: list.id.toString(),
    label: list.title,
  }))

  const formik = useFormik({
    enableReinitialize: true,
    validateOnChange: false,
    validateOnBlur: false,
    initialValues: {
      learning_paths: learningPathValues ?? [],
      user_lists: userListValues ?? [],
    },
    onSubmit: async (values) => {
      if (resource) {
        if (process.env.NEXT_PUBLIC_POSTHOG_API_KEY) {
          posthog.capture("lr_add_to_list", {
            listType: listType,
            resourceId: resource?.id,
            readableId: resource?.readable_id,
            platformCode: resource?.platform?.code,
            resourceType: resource?.resource_type,
          })
        }
        if (listType === ListType.LearningPath) {
          const newParents = values.learning_paths.map((id) => parseInt(id))
          await setLearningPathRelationships({
            id: resource.id,
            learning_path_id: newParents,
          })
        } else if (listType === ListType.UserList) {
          const newParents = values.user_lists.map((id) => parseInt(id))
          await setUserListRelationships({
            id: resource.id,
            userlist_id: newParents,
          })
        }
        modal.remove()
      }
    },
  })

  return (
    <FormDialog
      title={dialogTitle}
      fullWidth
      onReset={formik.resetForm}
      onSubmit={formik.handleSubmit}
      {...muiDialogV5(modal)}
      actions={
        <Actions>
          <Button
            variant="primary"
            type="submit"
            disabled={!formik.dirty || isSaving}
          >
            Save
          </Button>
          <Button
            variant="secondary"
            startIcon={<RiAddLine />}
            disabled={isSaving}
            onClick={handleCreate}
          >
            Create New List
          </Button>
        </Actions>
      }
    >
      {isReady ? (
        <>
          <Typography variant="button">
            Adding <ResourceTitle>{resource?.title}</ResourceTitle>
          </Typography>

          {listType === ListType.LearningPath ? (
            <CheckboxChoiceField
              name="learning_paths"
              choices={listChoices}
              values={formik.values.learning_paths}
              onChange={formik.handleChange}
              disabled={isLearningPathLoading}
              vertical
            />
          ) : null}
          {listType === ListType.UserList ? (
            <CheckboxChoiceField
              name="user_lists"
              choices={listChoices}
              values={formik.values.user_lists}
              onChange={formik.handleChange}
              disabled={isUserListLoading}
              vertical
            />
          ) : null}
        </>
      ) : (
        <LoadingSpinner loading={!isReady} />
      )}
    </FormDialog>
  )
}

export type AddToListDialogProps = {
  resourceId: number
}
const AddToLearningPathDialogInner: React.FC<AddToListDialogProps> = ({
  resourceId,
}) => {
  const { data: resource } = useLearningResourcesDetail(resourceId)
  const listsQuery = useLearningPathsList({ limit: LIST_LIMIT })

  const isReady = !!(resource && listsQuery.isSuccess)
  const lists = listsQuery.data?.results ?? []

  return (
    <AddToListDialogInner
      listType={ListType.LearningPath}
      resource={resource}
      lists={lists}
      isReady={isReady}
    />
  )
}

const AddToUserListDialogInner: React.FC<AddToListDialogProps> = ({
  resourceId,
}) => {
  const { data: resource } = useLearningResourcesDetail(resourceId)
  const listsQuery = useUserListList({ limit: LIST_LIMIT })

  const isReady = !!(resource && listsQuery.isSuccess)
  const lists = listsQuery.data?.results ?? []
  return (
    <AddToListDialogInner
      listType={ListType.UserList}
      resource={resource}
      lists={lists}
      isReady={isReady}
    />
  )
}

const AddToLearningPathDialog = NiceModal.create(AddToLearningPathDialogInner)
const AddToUserListDialog = NiceModal.create(AddToUserListDialogInner)

export {
  AddToLearningPathDialog,
  AddToUserListDialog,
  AddToUserListDialogInner,
}
