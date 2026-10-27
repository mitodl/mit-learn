import React from "react"
import * as NiceModal from "@ebay/nice-modal-react"
import {
  renderWithProviders,
  user,
  screen,
  expectProps,
  waitFor,
} from "@/test-utils"
import { LearningResourceListCardCondensed } from "ol-components"
import { urls, factories, setMockResponse } from "api/test-utils"
import { learningResourceQueries } from "api/hooks/learningResources"
import type { User } from "api/hooks/user"
import { RESOURCE_DRAWER_PARAMS } from "@/common/urls"
import { slugify } from "@/common/slugs"
import invariant from "tiny-invariant"
import {
  AddToLearningPathDialog,
  AddToUserListDialog,
} from "../Dialogs/AddToListDialog"
import { CondensedResourceCard } from "./CondensedResourceCard"

jest.mock("ol-components", () => {
  const actual = jest.requireActual("ol-components")
  return {
    __esModule: true,
    ...actual,
    LearningResourceListCardCondensed: jest.fn(
      actual.LearningResourceListCardCondensed,
    ),
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

const HOST_URL = "/c/topic/data-science?sortby=new"

const setup = ({
  user: userOverrides = {},
  isInUserList = false,
  isInLearningPath = false,
}: {
  user?: Partial<User>
  isInUserList?: boolean
  isInLearningPath?: boolean
} = {}) => {
  const resource = factories.learningResources.resource()
  if (userOverrides.is_authenticated) {
    setMockResponse.get(urls.userMe.get(), userOverrides)
    setMockResponse.get(
      urls.userLists.membershipList(),
      isInUserList ? [{ id: 1, parent: 123, child: resource.id }] : [],
    )
    setMockResponse.get(
      urls.learningPaths.membershipList(),
      isInLearningPath ? [{ id: 2, parent: 456, child: resource.id }] : [],
    )
  } else {
    setMockResponse.get(urls.userMe.get(), { is_authenticated: false })
  }
  const { location, queryClient, view } = renderWithProviders(
    <CondensedResourceCard resource={resource} />,
    { url: HOST_URL },
  )
  return { resource, location, queryClient, view }
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe("CondensedResourceCard", () => {
  test("Links to the resource's learn_url", () => {
    const { resource } = setup()

    expect(
      screen.getByRole("link", { name: new RegExp(resource.title) }),
    ).toHaveAttribute("href", resource.learn_url)
  })

  test("Clicking the title opens the resource drawer in place", async () => {
    const { resource, location, queryClient } = setup()

    await user.click(
      screen.getByRole("link", { name: new RegExp(resource.title) }),
    )

    const params = location.current.searchParams
    expect(params.get("sortby")).toBe("new")
    expect(params.get(RESOURCE_DRAWER_PARAMS.resource)).toBe(
      String(resource.id),
    )
    expect(params.get(RESOURCE_DRAWER_PARAMS.resource_title)).toBe(
      slugify(resource.title),
    )
    expect(
      queryClient.getQueryData(
        learningResourceQueries.detail(resource.id).queryKey,
      ),
    ).toEqual(resource)
  })

  test("Clicking the card body pushes the same URL as the title", async () => {
    const { resource, location, view } = setup()
    const card = view.container.firstElementChild
    invariant(card instanceof HTMLElement)

    await user.click(card)

    expect(location.current.searchParams.get("sortby")).toBe("new")
    expect(
      location.current.searchParams.get(RESOURCE_DRAWER_PARAMS.resource),
    ).toBe(String(resource.id))
  })

  test("Learning path editors can add to a learning path or a user list", async () => {
    const showModal = jest.mocked(NiceModal.show)
    const { resource } = setup({
      user: { is_authenticated: true, is_learning_path_editor: true },
    })

    await user.click(
      await screen.findByRole("button", { name: "Add to Learning Path" }),
    )
    expect(showModal).toHaveBeenLastCalledWith(AddToLearningPathDialog, {
      resourceId: resource.id,
    })
    await user.click(
      screen.getByRole("button", {
        name: `Bookmark ${resource.resource_category}`,
      }),
    )
    expect(showModal).toHaveBeenLastCalledWith(AddToUserListDialog, {
      resourceId: resource.id,
    })
  })

  test("Bookmarking prompts unauthenticated users to sign up", async () => {
    const { resource } = setup()

    await user.click(
      await screen.findByRole("button", {
        name: `Bookmark ${resource.resource_category}`,
      }),
    )

    expect(screen.getByRole("dialog")).toHaveTextContent("Sign Up")
  })

  test("Passes list membership to the card", async () => {
    setup({
      user: { is_authenticated: true, is_learning_path_editor: true },
      isInUserList: true,
    })

    await waitFor(() => {
      expectProps(LearningResourceListCardCondensed, {
        inUserList: true,
        inLearningPath: false,
      })
    })
  })
})
