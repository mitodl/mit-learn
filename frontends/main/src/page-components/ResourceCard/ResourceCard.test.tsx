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
import type { UseFeatureFlagEnabled } from "@/test-utils"
import type { User } from "api/hooks/user"
import { ResourceCard } from "./ResourceCard"
import { MicroUserListRelationship } from "api"
import {
  AddToLearningPathDialog,
  AddToUserListDialog,
} from "../Dialogs/AddToListDialog"
import type { ResourceCardProps } from "./ResourceCard"
import { urls, factories, setMockResponse } from "api/test-utils"
import { RESOURCE_DRAWER_PARAMS } from "@/common/urls"
import { slugify } from "@/common/slugs"
import invariant from "tiny-invariant"
import { LearningResourceCard } from "ol-components"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { FeatureFlags } from "@/common/feature_flags"
import { learningResourceQueries } from "api/hooks/learningResources"
import type { LearningResource } from "api"
import {
  ResourceCardSkeleton,
  ResourceCardView,
} from "../ResourceCardView/ResourceCardView"

jest.mock("posthog-js/react", () => ({
  ...jest.requireActual("posthog-js/react"),
  useFeatureFlagEnabled: jest.fn(),
}))

jest.mock("../ResourceCardView/ResourceCardView", () => {
  const actual = jest.requireActual("../ResourceCardView/ResourceCardView")
  return {
    __esModule: true,
    ...actual,
    ResourceCardView: jest.fn(actual.ResourceCardView),
    ResourceCardSkeleton: jest.fn(actual.ResourceCardSkeleton),
  }
})

jest.mock("ol-components", () => {
  const actual = jest.requireActual("ol-components")
  return {
    __esModule: true,
    ...actual,
    LearningResourceCard: jest.fn(actual.LearningResourceCard),
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
}: SetupOptions = {}) => {
  const { resource = makeResource() } = props
  invariant(resource)
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
    { url },
  )
  return { resource, view, location, queryClient }
}

/**
 * Off is the unresolved `undefined` PostHog returns before flags load, which
 * must render the legacy card just as an explicit `false` does.
 */
const setRedesignFlag = (enabled: boolean) => {
  jest
    .mocked<UseFeatureFlagEnabled>(useFeatureFlagEnabled)
    .mockImplementation((flag) =>
      enabled && flag === FeatureFlags.ResourceCardRedesign ? true : undefined,
    )
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

const LEGACY = {
  card: "legacy",
  flag: false,
  bookmarkName: (resource: LearningResource) =>
    `Bookmark ${resource.resource_category}`,
  learningPathName: () => "Add to Learning Path",
}
const REDESIGNED = {
  card: "redesigned",
  flag: true,
  bookmarkName: (resource: LearningResource) => `Bookmark: ${resource.title}`,
  learningPathName: (resource: LearningResource) =>
    `Add to Learning Path: ${resource.title}`,
}

/**
 * Behaviour both cards share. The redesigned card runs only with
 * `isList: false`: its `list` only picks its layout, which the redesigned-only
 * block covers.
 */
describe.each([
  { ...LEGACY, isList: false },
  { ...LEGACY, isList: true },
  { ...REDESIGNED, isList: false },
])(
  "ResourceCard ($card, isList=$isList)",
  ({ flag, isList, bookmarkName, learningPathName }) => {
    beforeEach(() => {
      setRedesignFlag(flag)
    })

    const setup = (options: SetupOptions = {}) =>
      setupCard({ ...options, isList })

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
        await screen.findByRole("button", { name: bookmarkName(resource) })

        const addToLearningPathButton = screen.queryByRole("button", {
          name: learningPathName(resource),
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
        name: bookmarkName(resource),
      })
      const addToLearningPathButton = await screen.findByRole("button", {
        name: learningPathName(resource),
      })

      expect(showModal).not.toHaveBeenCalled()
      await user.click(addToLearningPathButton)
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
        name: bookmarkName(resource),
      })
      await user.click(addToUserListButton)
      const dialog = screen.getByRole("dialog")
      expect(dialog).toBeVisible()
      expect(dialog).toHaveTextContent("Sign Up")
    })

    test("Card links to the resource's learn_url regardless of host page", () => {
      const { resource } = setup({
        user: { is_learning_path_editor: true },
        url: HOST_URL,
      })

      const link = screen.getByRole("link", {
        name: new RegExp(resource.title),
      })

      // What crawlers follow: the resource's own page where it has one, else
      // its drawer. The backend decides, so the card does no URL building.
      expect(link).toHaveAttribute("href", resource.learn_url)
    })

    test("Clicking the title opens the drawer in place and caches the resource", async () => {
      const onCardClick = jest.fn()
      const { resource, location, queryClient } = setup({
        user: { is_learning_path_editor: true },
        url: HOST_URL,
        props: { onCardClick },
      })

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
      expect(
        queryClient.getQueryData(
          learningResourceQueries.detail(resource.id).queryKey,
        ),
      ).toEqual(resource)
      expect(onCardClick).toHaveBeenCalledTimes(1)
    })

    /**
     * The modifier list itself is pinned per-key in LinkAdapter.test.tsx;
     * this checks only that the chain from the card's title link down to
     * LinkAdapter still delivers the modifier state, so one key is enough.
     */
    test("Meta-click on the title is left to the browser, so no URL is pushed", async () => {
      const { resource, location } = setup({
        user: { is_learning_path_editor: true },
        url: HOST_URL,
      })
      const u = user.setup()
      await u.keyboard("{Meta>}")

      await expectWindowNavigation(() =>
        u.click(screen.getByRole("link", { name: new RegExp(resource.title) })),
      )

      expect(
        location.current.searchParams.has(RESOURCE_DRAWER_PARAMS.resource),
      ).toBe(false)
    })
  },
)

/**
 * Cases that depend on the legacy card's props or its body click handler. The
 * redesigned card's body clicks land on the title link's overlay, which jsdom
 * can't exercise.
 */
describe("ResourceCard (legacy only)", () => {
  beforeEach(() => {
    setRedesignFlag(false)
  })

  test.each([{ isList: false }, { isList: true }])(
    "Clicking the card body pushes the same URL as the title (isList=$isList)",
    async ({ isList }) => {
      const { resource, location, view } = setupCard({
        user: { is_learning_path_editor: true },
        url: HOST_URL,
        isList,
      })
      const card = view.container.firstElementChild
      invariant(card instanceof HTMLElement)

      await user.click(card)

      expect(location.current.pathname).toBe(HOST_PATHNAME)
      expect(location.current.searchParams.get("sortby")).toBe("new")
      expect(
        location.current.searchParams.get(RESOURCE_DRAWER_PARAMS.resource),
      ).toBe(String(resource.id))
    },
  )

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
})

describe("ResourceCard (redesigned only)", () => {
  beforeEach(() => {
    setRedesignFlag(true)
  })

  const lastViewProps = () => {
    const props = jest.mocked(ResourceCardView).mock.lastCall?.[0]
    invariant(props)
    return props
  }

  test("A list card has the responsive layout and no fixed size", () => {
    setupCard({ isList: true, props: { size: "small" } })

    expectProps(ResourceCardView, { layout: "responsive" })
    expect(lastViewProps().size).toBeUndefined()
  })

  test("Any other card is vertical at the given size", () => {
    setupCard({ props: { size: "small" } })

    expectProps(ResourceCardView, { layout: "vertical", size: "small" })
  })

  test("Clicking the bookmark neither opens the drawer nor counts as a card click", async () => {
    const onCardClick = jest.fn()
    const { resource, location } = setupCard({
      user: { is_authenticated: true },
      url: HOST_URL,
      props: { onCardClick },
    })
    const { pathname, search } = location.current

    await user.click(
      await screen.findByRole("button", {
        name: `Bookmark: ${resource.title}`,
      }),
    )

    expect(location.current.pathname).toBe(pathname)
    expect(location.current.search).toBe(search)
    expect(onCardClick).not.toHaveBeenCalled()
  })

  test.each([
    { inUserList: true, inLearningPath: false },
    { inUserList: false, inLearningPath: true },
  ])(
    "Action labels follow membership (inUserList=$inUserList, inLearningPath=$inLearningPath)",
    async ({ inUserList, inLearningPath }) => {
      const resource = makeResource()
      setupCard({
        user: { is_authenticated: true, is_learning_path_editor: true },
        props: { resource },
        userListMemberships: inUserList
          ? [{ id: 1, parent: 123, child: resource.id }]
          : [],
        learningPathMemberships: inLearningPath
          ? [{ id: 2, parent: 456, child: resource.id }]
          : [],
      })

      const learningPathLabel = inLearningPath
        ? `In Learning Path: ${resource.title}`
        : `Add to Learning Path: ${resource.title}`
      const bookmarkLabel = inUserList
        ? `Bookmarked: ${resource.title}`
        : `Bookmark: ${resource.title}`

      await screen.findByRole("button", { name: learningPathLabel })
      await screen.findByRole("button", { name: bookmarkLabel })
      expect(
        screen
          .getAllByRole("button")
          .map((button) => button.getAttribute("aria-label")),
      ).toEqual([learningPathLabel, bookmarkLabel])
    },
  )

  test("A loading card renders the skeleton with the card's layout", () => {
    setupCard({ props: { isLoading: true, size: "small" } })

    expectProps(ResourceCardSkeleton, { layout: "vertical", size: "small" })
    expect(ResourceCardView).not.toHaveBeenCalled()
  })
})
