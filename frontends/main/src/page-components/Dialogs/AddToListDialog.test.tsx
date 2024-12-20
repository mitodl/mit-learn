import { faker } from "@faker-js/faker/locale/en"
import * as NiceModal from "@ebay/nice-modal-react"
import { AddToLearningPathDialog, AddToUserListDialog } from "./AddToListDialog"

import { setMockResponse, makeRequest, factories, urls } from "api/test-utils"

import {
  renderWithProviders,
  screen,
  user,
  within,
  act,
  waitFor,
} from "@/test-utils"
import { manageListDialogs } from "@/page-components/ManageListDialogs/ManageListDialogs"
import { waitForElementToBeRemoved } from "@testing-library/react"
import invariant from "tiny-invariant"
import { ListType } from "api/constants"

const learningResourcesFactory = factories.learningResources
const userListsFactory = factories.userLists

jest.mock("@ebay/nice-modal-react", () => {
  const actual = jest.requireActual("@ebay/nice-modal-react")
  return {
    ...actual,
    show: jest.fn(actual.show),
  }
})

type SetupOptions = {
  inLists: number[]
  dialogOpen: boolean
}
const setupLearningPaths = ({
  inLists = [],
  dialogOpen = true,
}: Partial<SetupOptions> = {}) => {
  const resource = learningResourcesFactory.resource()
  const paginatedLearningPaths = learningResourcesFactory.learningPaths({
    count: 3,
  })
  const learningPaths = paginatedLearningPaths.results

  setMockResponse.get(
    urls.learningResources.details({ id: resource.id }),
    resource,
  )
  setMockResponse.get(
    urls.learningPaths.list({ limit: 100 }),
    paginatedLearningPaths,
  )

  const learningPathParents = inLists.map((index) => ({
    id: 123,
    parent: learningPaths[index].id,
    child: resource.id,
  }))

  setMockResponse.get(urls.userMe.get(), {
    is_authenticated: true,
    is_learning_path_editor: true,
  })
  setMockResponse.get(urls.learningPaths.membershipList(), learningPathParents)
  setMockResponse.get(urls.userLists.membershipList(), [])

  const view = renderWithProviders(null)
  if (dialogOpen) {
    act(() => {
      NiceModal.show(AddToLearningPathDialog, { resourceId: resource.id })
    })
  }
  return {
    view,
    resource,
    lists: learningPaths,
    parents: learningPathParents,
  }
}

const setupUserLists = ({
  inLists = [],
  dialogOpen = true,
}: Partial<SetupOptions> = {}) => {
  const resource = learningResourcesFactory.resource()
  const paginatedUserLists = userListsFactory.userLists({ count: 3 })
  const userLists = paginatedUserLists.results

  setMockResponse.get(
    urls.learningResources.details({ id: resource.id }),
    resource,
  )
  setMockResponse.get(urls.userLists.list({ limit: 100 }), paginatedUserLists)
  const view = renderWithProviders(null)
  if (dialogOpen) {
    act(() => {
      NiceModal.show(AddToUserListDialog, { resourceId: resource.id })
    })
  }

  const userListParents = inLists.map((index) => ({
    parent: userLists[index].id,
    child: resource.id,
  }))

  setMockResponse.get(urls.userMe.get(), {
    is_authenticated: true,
    is_learning_path_editor: true,
  })
  setMockResponse.get(urls.learningPaths.membershipList(), [])
  setMockResponse.get(urls.userLists.membershipList(), userListParents)
  return {
    view,
    resource,
    lists: userLists,
    parents: userListParents,
  }
}

describe.each([ListType.LearningPath, ListType.UserList])(
  "AddToListDialog",
  (listType: string) => {
    test(`${listType} List is checked if resource is in list`, async () => {
      const index = faker.number.int({ min: 0, max: 2 })
      if (listType === ListType.LearningPath) {
        setupLearningPaths({ inLists: [index] })
      } else if (listType === ListType.UserList) {
        setupUserLists({ inLists: [index] })
      }

      const checkboxes =
        await screen.findAllByRole<HTMLInputElement>("checkbox")

      await waitFor(() => {
        expect(checkboxes[0].checked).toBe(index === 0)
      })
      await waitFor(() => {
        expect(checkboxes[1].checked).toBe(index === 1)
      })
      await waitFor(() => {
        expect(checkboxes[2].checked).toBe(index === 2)
      })
    })

    test("Clicking an unchecked list and clicking save adds item to that list", async () => {
      let title = ""
      let setRelationshipsUrl = ""
      if (listType === ListType.LearningPath) {
        const { resource, lists } = setupLearningPaths()
        const list = faker.helpers.arrayElement(lists)

        setRelationshipsUrl =
          urls.learningResources.setLearningPathRelationships({
            id: resource.id,
            learning_path_id: [list.id],
          })
        setMockResponse.patch(setRelationshipsUrl)
        setMockResponse.get(
          urls.learningResources.details({ id: resource.id }),
          resource,
        )
        title = list.title
      } else if (listType === ListType.UserList) {
        const { resource, lists } = setupUserLists()
        const list = faker.helpers.arrayElement(lists)

        setRelationshipsUrl = urls.learningResources.setUserListRelationships({
          id: resource.id,
          userlist_id: [list.id],
        })
        setMockResponse.patch(setRelationshipsUrl)
        setMockResponse.get(
          urls.learningResources.details({ id: resource.id }),
          resource,
        )
        title = list.title
      }

      const checkbox = await screen.findByLabelText<HTMLInputElement>(title)

      expect(checkbox.checked).toBe(false)
      await user.click(checkbox)

      const saveButton = await screen.findByRole("button", { name: "Save" })
      await user.click(saveButton)

      expect(makeRequest).toHaveBeenCalledWith("patch", setRelationshipsUrl, {})
    })

    test("Clicking a checked list and clicking save removes item from that list", async () => {
      const index = faker.number.int({ min: 0, max: 2 })
      let title = ""
      let setRelationshipUrl = ""
      if (listType === ListType.LearningPath) {
        const { resource, lists, parents } = setupLearningPaths({
          inLists: [index],
        })
        const list = lists[index]
        const relationship = parents.find(({ parent }) => parent === list.id)
        invariant(relationship)

        title = list.title
        setRelationshipUrl =
          urls.learningResources.setLearningPathRelationships({
            id: relationship.child,
          })
        setMockResponse.patch(setRelationshipUrl, relationship)

        setMockResponse.get(
          urls.learningResources.details({ id: resource.id }),
          resource,
        )
      } else if (listType === ListType.UserList) {
        const { resource, lists, parents } = setupUserLists({
          inLists: [index],
        })
        const list = lists[index]
        const relationship = parents.find(({ parent }) => parent === list.id)
        invariant(relationship)

        title = list.title
        setRelationshipUrl = urls.learningResources.setUserListRelationships({
          id: relationship.child,
        })
        setMockResponse.patch(setRelationshipUrl, relationship)
        setMockResponse.get(
          urls.userLists.details({ id: resource.id }),
          resource,
        )
      }

      const checkbox = await screen.findByRole<HTMLInputElement>("checkbox", {
        name: title,
        checked: true,
      })

      await user.click(checkbox)

      const saveButton = await screen.findByRole("button", { name: "Save" })
      await user.click(saveButton)

      expect(makeRequest).toHaveBeenCalledWith("patch", setRelationshipUrl, {})
    })

    test("Clicking 'Create New list' opens the create list dialog", async () => {
      let createList = null
      if (listType === ListType.LearningPath) {
        // Don't actually open the 'Create List' modal, or we'll need to mock API responses.
        createList = jest
          .spyOn(manageListDialogs, "upsertLearningPath")
          .mockImplementationOnce(jest.fn())
        setupLearningPaths()
      } else if (listType === ListType.UserList) {
        // Don't actually open the 'Create List' modal, or we'll need to mock API responses.
        createList = jest
          .spyOn(manageListDialogs, "upsertUserList")
          .mockImplementationOnce(jest.fn())
        setupUserLists()
      }
      const button = await screen.findByRole("button", {
        name: "Create New List",
      })
      expect(createList).not.toHaveBeenCalled()
      await user.click(button)
      expect(createList).toHaveBeenCalledWith()
    })

    test("Opens and closes via NiceModal", async () => {
      let title = ""
      if (listType === ListType.LearningPath) {
        const { resource: resource1 } = setupLearningPaths()
        title = resource1.title
      } else if (listType === ListType.UserList) {
        const { resource: resource1 } = setupUserLists()
        title = resource1.title
      }

      const dialog1 = await screen.findByRole("dialog")
      await within(dialog1).findByText(title, { exact: false })

      // Close the dialog
      act(() => {
        if (listType === ListType.LearningPath) {
          NiceModal.hide(AddToLearningPathDialog)
        } else if (listType === ListType.UserList) {
          NiceModal.hide(AddToUserListDialog)
        }
      })
      await waitForElementToBeRemoved(dialog1)

      // Open it with a new resource
      const resource2 = learningResourcesFactory.resource()
      setMockResponse.get(
        urls.learningResources.details({ id: resource2.id }),
        resource2,
      )
      act(() => {
        if (listType === ListType.LearningPath) {
          NiceModal.show(AddToLearningPathDialog, { resourceId: resource2.id })
        } else if (listType === ListType.UserList) {
          NiceModal.show(AddToUserListDialog, { resourceId: resource2.id })
        }
      })
      const dialog2 = await screen.findByRole("dialog")
      await within(dialog2).findByText(resource2.title, { exact: false })
    })
  },
)
