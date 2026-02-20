import React from "react"
import * as NiceModal from "@ebay/nice-modal-react"
import {
  renderWithProviders,
  user,
  screen,
  expectProps,
  waitFor,
} from "@/test-utils"
import type { User } from "api/hooks/user"
import { learningResourceQueries } from "api/hooks/learningResources"
import { ResourceCard } from "./ResourceCard"
import { getReadableResourceType } from "ol-utilities"
import { ResourceTypeEnum, MicroUserListRelationship } from "api"
import type { ResourceCardProps } from "./ResourceCard"
import { urls, factories, setMockResponse } from "api/test-utils"
import { RESOURCE_DRAWER_PARAMS } from "@/common/urls"
import invariant from "tiny-invariant"
import { LearningResourceCard } from "ol-components"

jest.mock("ol-components", () => {
  const actual = jest.requireActual("ol-components")
  return {
    __esModule: true,
    ...actual,
    LearningResourceCard: jest.fn(actual.LearningResourceCard),
    LearningResourceListCard: jest.fn(actual.LearningResourceListCard),
  }
})

jest.mock("@ebay/nice-modal-react", () => {
  const actual = jest.requireActual("@ebay/nice-modal-react")
  const show = jest.fn()
  return {
    __esModule: true,
    ...actual,
    show,
    default: {
      ...actual.default,
      show: show,
    },
  }
})

describe.each([
  {
    isList: false,
  },
  {
    isList: true,
  },
])("$CardComponent", ({ isList }) => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const makeResource = factories.learningResources.resource
  type SetupOptions = {
    user?: Partial<User>
    props?: Partial<ResourceCardProps>
    userListMemberships?: MicroUserListRelationship[]
    learningPathMemberships?: MicroUserListRelationship[]
  }
  const setup = ({
    user,
    props = {},
    userListMemberships = [],
    learningPathMemberships = [],
  }: SetupOptions = {}) => {
    const { resource = makeResource() } = props
    if (user?.is_authenticated) {
      setMockResponse.get(urls.userMe.get(), user)
      setMockResponse.get(urls.userLists.membershipList(), userListMemberships)
      setMockResponse.get(
        urls.learningPaths.membershipList(),
        learningPathMemberships,
      )
    } else {
      setMockResponse.get(urls.userMe.get(), { is_authenticated: false })
    }
    const { view, location, queryClient } = renderWithProviders(
      <ResourceCard {...props} resource={resource} list={isList} />,
    )
    return { resource, view, location, queryClient }
  }

  test("Applies className to the resource card", () => {
    const { view } = setup({ user: {}, props: { className: "test-class" } })
    expect(view.container.firstChild).toHaveClass("test-class")
  })

  test.each([
    {
      user: { is_authenticated: true, is_learning_path_editor: false },
      expectAddToLearningPathButton: false,
    },
    {
      user: { is_authenticated: true, is_learning_path_editor: true },
      expectAddToLearningPathButton: true,
    },
    {
      user: { is_authenticated: false },
      expectAddToLearningPathButton: false,
    },
  ])(
    "Always shows 'Add to User List' button, but only shows 'Add to Learning Path' button if user is a learning path editor",
    async ({ user, expectAddToLearningPathButton }) => {
      const { resource } = setup({ user })
      await screen.findByRole("button", {
        name: `Bookmark ${getReadableResourceType(resource?.resource_type as ResourceTypeEnum)}`,
      })

      const addToLearningPathButton = expectAddToLearningPathButton
        ? await screen.findByRole("button", {
            name: "Add to Learning Path",
          })
        : screen.queryByRole("button", {
            name: "Add to Learning Path",
          })
      expect(!!addToLearningPathButton).toBe(expectAddToLearningPathButton)
    },
  )

  test.each([
    {
      userList: { count: 1, inList: true },
      learningPath: { count: 1, inList: true },
    },
    {
      userList: { count: 0, inList: false },
      learningPath: { count: 1, inList: true },
    },
    {
      userList: { count: 1, inList: true },
      learningPath: { count: 0, inList: false },
    },
    {
      userList: { count: 0, inList: false },
      learningPath: { count: 0, inList: false },
    },
  ])(
    "'Add to ...' buttons are filled based on membership in list",
    async ({ userList, learningPath }) => {
      const resource = makeResource()

      setup({
        user: { is_authenticated: true, is_learning_path_editor: true },
        props: { resource },
        userListMemberships: userList.inList
          ? [
              {
                id: 1,
                parent: 123,
                child: resource.id,
              },
            ]
          : [],
        learningPathMemberships: learningPath.inList
          ? [
              {
                id: 2,
                parent: 456,
                child: resource.id,
              },
            ]
          : [],
      })

      await waitFor(() => {
        expectProps(LearningResourceCard, {
          inLearningPath: learningPath.inList,
          inUserList: userList.inList,
        })
      })
    },
  )

  test("Clicking add to list button opens AddToListDialog when authenticated", async () => {
    const showModal = jest.mocked(NiceModal.show)

    const { resource } = setup({
      user: { is_learning_path_editor: true, is_authenticated: true },
    })
    const addToUserListButton = await screen.findByRole("button", {
      name: `Bookmark ${getReadableResourceType(resource?.resource_type as ResourceTypeEnum)}`,
    })
    const addToLearningPathButton = await screen.findByRole("button", {
      name: "Add to Learning Path",
    })

    expect(showModal).not.toHaveBeenCalled()
    await user.click(addToLearningPathButton)
    invariant(resource)
    expect(showModal).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        resourceId: resource.id,
      }),
    )
    showModal.mockClear()
    await user.click(addToUserListButton)
    expect(showModal).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        resourceId: resource.id,
      }),
    )
  })

  test("Clicking 'Add to User List' opens signup popover if not authenticated", async () => {
    const { resource } = setup({
      user: { is_authenticated: false },
    })
    const addToUserListButton = await screen.findByRole("button", {
      name: `Bookmark ${getReadableResourceType(resource?.resource_type as ResourceTypeEnum)}`,
    })
    await user.click(addToUserListButton)
    const dialog = screen.getByRole("dialog")
    expect(dialog).toBeVisible()
    expect(dialog).toHaveTextContent("Sign Up")
  })

  test("Clicking card opens resource drawer", async () => {
    const { resource } = setup({
      user: { is_learning_path_editor: true },
    })
    invariant(resource)
    const link = screen.getByRole("link", { name: new RegExp(resource.title) })
    const href = link.getAttribute("href")
    invariant(href)
    const url = new URL(href, window.location.href)
    expect(url.searchParams.get(RESOURCE_DRAWER_PARAMS.resource)).toBe(
      String(resource.id),
    )
  })

  test("Clicking a resource card sets resource detail cache", async () => {
    const { resource, view, queryClient } = setup()
    await user.click(view.container.firstChild as HTMLElement)

    invariant(resource)
    const cached = queryClient.getQueryData(
      learningResourceQueries.detail(resource.id).queryKey,
    )
    expect(cached).toEqual(resource)
  })
})
