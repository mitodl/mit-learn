import React from "react"
import * as NiceModal from "@ebay/nice-modal-react"
import {
  renderWithProviders,
  user,
  screen,
  expectProps,
  waitFor,
  expectWindowNavigation,
} from "@/test-utils"
import type { User } from "api/hooks/user"
import { ResourceCard } from "./ResourceCard"
import { MicroUserListRelationship } from "api"
import {
  AddToLearningPathDialog,
  AddToUserListDialog,
} from "../Dialogs/AddToListDialog"
import type { ResourceCardProps } from "./ResourceCard"
import { urls, factories, setMockResponse } from "api/test-utils"
import { RESOURCE_DRAWER_PARAMS, resourceDrawerSearch } from "@/common/urls"
import { slugify } from "@/common/slugs"
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

const makeResource = factories.learningResources.resource
type SetupOptions = {
  user?: Partial<User>
  props?: Partial<ResourceCardProps>
  userListMemberships?: MicroUserListRelationship[]
  learningPathMemberships?: MicroUserListRelationship[]
  url?: string
  isList?: boolean
  condensed?: boolean
}
const setupCard = ({
  user,
  props = {},
  userListMemberships = [],
  learningPathMemberships = [],
  // Must default here: renderWithProviders merges { ...defaults, ...options },
  // so passing url: undefined clobbers its own "/" default and throws.
  url = "/",
  isList = false,
  condensed = false,
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
    <ResourceCard
      {...props}
      resource={resource}
      list={isList}
      condensed={condensed}
    />,
    { url },
  )
  return { resource, view, location, queryClient }
}

beforeEach(() => {
  jest.clearAllMocks()
})

/**
 * The host page's pathname reads back as the route template, because
 * renderWithProviders registers CHANNEL_VIEW with createDynamicRouteParser.
 *
 * Every click assertion checks the pathname and a host-only param as well as
 * `resource`: the canonical href itself contains resource=<id>, so asserting
 * that param alone passes even when nothing intercepted the click.
 */
const HOST_URL = "/c/topic/data-science?sortby=new"
const HOST_PATHNAME = "/c/[channelType]/[name]"

/**
 * The condensed variant is live (ItemsListing renders <ResourceCard condensed
 * list>, reached from a user list detail page) and it's the one whose failure
 * is silent: miss the pushUrl forwarding at ListCardCondensed.Title and every
 * condensed card navigates away instead of opening the drawer, with no error
 * and no type error.
 *
 * Cases that assert on props handed to the (mocked) card, rather than on
 * rendered output or click behaviour, cannot vary by variant and live below
 * this block instead.
 */
describe.each([
  { isList: false, condensed: false },
  { isList: true, condensed: false },
  { isList: true, condensed: true },
])(
  "ResourceCard (isList=$isList condensed=$condensed)",
  ({ isList, condensed }) => {
    const setup = (options: SetupOptions = {}) =>
      setupCard({ ...options, isList, condensed })

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
          name: `Bookmark ${resource?.resource_category}`,
        })

        const addToLearningPathButton = screen.queryByRole("button", {
          name: "Add to Learning Path",
        })
        expect(!!addToLearningPathButton).toBe(expectAddToLearningPathButton)
      },
    )

    test("Clicking add to list button opens AddToListDialog when authenticated", async () => {
      const showModal = jest.mocked(NiceModal.show)

      const { resource } = setup({
        user: { is_learning_path_editor: true, is_authenticated: true },
      })
      const addToUserListButton = await screen.findByRole("button", {
        name: `Bookmark ${resource?.resource_category}`,
      })
      const addToLearningPathButton = await screen.findByRole("button", {
        name: "Add to Learning Path",
      })

      expect(showModal).not.toHaveBeenCalled()
      await user.click(addToLearningPathButton)
      invariant(resource)
      expect(showModal).toHaveBeenLastCalledWith(AddToLearningPathDialog, {
        resourceId: resource.id,
      })
      await user.click(addToUserListButton)
      expect(showModal).toHaveBeenLastCalledWith(AddToUserListDialog, {
        resourceId: resource.id,
      })
    })

    test("Clicking 'Add to User List' opens signup popover if not authenticated", async () => {
      const { resource } = setup({
        user: { is_authenticated: false },
      })
      const addToUserListButton = await screen.findByRole("button", {
        name: `Bookmark ${resource?.resource_category}`,
      })
      await user.click(addToUserListButton)
      const dialog = screen.getByRole("dialog")
      expect(dialog).toBeVisible()
      expect(dialog).toHaveTextContent("Sign Up")
    })

    test("Card links to the canonical resource URL regardless of host page", () => {
      const { resource } = setup({
        user: { is_learning_path_editor: true },
        url: HOST_URL,
      })
      invariant(resource)

      const link = screen.getByRole("link", {
        name: new RegExp(resource.title),
      })

      expect(link).toHaveAttribute(
        "href",
        resourceDrawerSearch(resource.id, resource.title),
      )
    })

    test("Clicking the title pushes the host page's URL with the drawer params", async () => {
      const { resource, location } = setup({
        user: { is_learning_path_editor: true },
        url: HOST_URL,
      })
      invariant(resource)

      await user.click(
        screen.getByRole("link", { name: new RegExp(resource.title) }),
      )

      expect(location.current.pathname).toBe(HOST_PATHNAME)
      const params = location.current.searchParams
      expect(params.get("sortby")).toBe("new")
      expect(params.get(RESOURCE_DRAWER_PARAMS.resource)).toBe(
        String(resource.id),
      )
      expect(params.get(RESOURCE_DRAWER_PARAMS.resource_title)).toBe(
        slugify(resource.title),
      )
    })

    test("Clicking the card body pushes the same URL as the title", async () => {
      const { resource, location, view } = setup({
        user: { is_learning_path_editor: true },
        url: HOST_URL,
      })
      invariant(resource)
      // ListCardCondensed sets no root class, so a class selector would match
      // nothing on exactly the variant this row was added to protect.
      const card = view.container.firstElementChild
      invariant(card instanceof HTMLElement)

      await user.click(card)

      expect(location.current.pathname).toBe(HOST_PATHNAME)
      expect(location.current.searchParams.get("sortby")).toBe("new")
      expect(
        location.current.searchParams.get(RESOURCE_DRAWER_PARAMS.resource),
      ).toBe(String(resource.id))
    })
  },
)

describe("ResourceCard, independent of card variant", () => {
  test.each([
    {
      userList: { inList: true },
      learningPath: { inList: true },
    },
    {
      userList: { inList: false },
      learningPath: { inList: true },
    },
    {
      userList: { inList: true },
      learningPath: { inList: false },
    },
    {
      userList: { inList: false },
      learningPath: { inList: false },
    },
  ])(
    "'Add to ...' buttons are filled based on membership in list",
    async ({ userList, learningPath }) => {
      const resource = makeResource()

      setupCard({
        user: { is_authenticated: true, is_learning_path_editor: true },
        props: { resource },
        userListMemberships: userList.inList
          ? [{ id: 1, parent: 123, child: resource.id }]
          : [],
        learningPathMemberships: learningPath.inList
          ? [{ id: 2, parent: 456, child: resource.id }]
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

  /**
   * The modifier list itself is pinned per-key in LinkAdapter.test.tsx; this
   * checks only that the whole Card.Title → Linkable → Link → LinkAdapter chain
   * still delivers the modifier state, so one key is enough.
   */
  test("Meta-click on the title is left to the browser, so no URL is pushed", async () => {
    const { resource, location } = setupCard({
      user: { is_learning_path_editor: true },
      url: HOST_URL,
    })
    invariant(resource)
    const u = user.setup()
    await u.keyboard("{Meta>}")

    await expectWindowNavigation(() =>
      u.click(screen.getByRole("link", { name: new RegExp(resource.title) })),
    )

    expect(
      location.current.searchParams.has(RESOURCE_DRAWER_PARAMS.resource),
    ).toBe(false)
  })
})
