import React from "react"
import { faker } from "@faker-js/faker/locale/en"
import {
  SortableList,
  SortableItem,
  LearningResourceListCard,
  LearningResourceListCardCondensed,
} from "ol-components"
import { factories, urls, makeRequest } from "api/test-utils"
import {
  screen,
  expectProps,
  renderWithProviders,
  setMockResponse,
  waitFor,
  act,
} from "@/test-utils"
import ItemsListing from "./ItemsListing"
import type {
  ItemsListingProps,
  LearningResourceListItem,
} from "./ItemsListing"
import { ControlledPromise } from "ol-test-utilities"
import invariant from "tiny-invariant"
import { ListType } from "api/constants"

jest.mock("ol-components", () => {
  const actual = jest.requireActual("ol-components")
  return {
    __esModule: true,
    ...actual,
    SortableList: jest.fn(actual.SortableList),
    SortableItem: jest.fn(actual.SortableItem),
    LearningResourceListCard: jest.fn(actual.LearningResourceListCard),
    LearningResourceListCardCondensed: jest.fn(
      actual.LearningResourceListCardCondensed,
    ),
  }
})

const spyLearningResourceListCard = jest.mocked(LearningResourceListCard)
const spyLearningResourceListCardCondensed = jest.mocked(
  LearningResourceListCardCondensed,
)

const spySortableList = jest.mocked(SortableList)
const spySortableItem = jest.mocked(SortableItem)

const learningResourcesFactory = factories.learningResources
const userListsFactory = factories.userLists

const getPaginatedRelationships = (
  listType: string,
  count: number,
  parent: number,
) => {
  if (listType === ListType.LearningPath) {
    return learningResourcesFactory.learningPathRelationships({
      count,
      parent,
    })
  } else if (listType === ListType.UserList) {
    return userListsFactory.userListRelationships({
      count,
      parent,
    })
  } else {
    throw new Error("Invalid list type passed to getPaginatedRelationships")
  }
}

describe("ItemsListing", () => {
  test.each([
    { listType: ListType.LearningPath },
    { listType: ListType.UserList },
  ])("Shows loading message while loading", ({ listType }) => {
    const emptyMessage = "Empty list"

    const { view } = renderWithProviders(
      <ItemsListing
        listType={listType}
        emptyMessage={emptyMessage}
        isLoading
      />,
    )
    screen.getByLabelText("Loading")
    view.rerender(
      <ItemsListing listType={listType} emptyMessage={emptyMessage} />,
    )
  })

  test.each([
    { listType: ListType.LearningPath, count: 0, hasEmptyMessage: true },
    {
      listType: ListType.LearningPath,
      count: faker.number.int({ min: 1, max: 5 }),
      hasEmptyMessage: false,
    },
    { listType: ListType.LearningPath, count: 0, hasEmptyMessage: true },
    {
      listType: ListType.UserList,
      count: faker.number.int({ min: 1, max: 5 }),
      hasEmptyMessage: false,
    },
  ])(
    "Shows empty message when there are no items",
    ({ listType, count, hasEmptyMessage }) => {
      setMockResponse.get(urls.userMe.get(), { is_authenticated: true })
      setMockResponse.get(urls.userLists.membershipList(), [])
      setMockResponse.get(urls.learningPaths.membershipList(), [])
      const emptyMessage = faker.lorem.sentence()
      const paginatedRelationships = getPaginatedRelationships(
        listType,
        count,
        faker.number.int(),
      )
      renderWithProviders(
        <ItemsListing
          listType={listType}
          emptyMessage={emptyMessage}
          items={paginatedRelationships.results as LearningResourceListItem[]}
        />,
      )
      const emptyMessageElement = screen.queryByText(emptyMessage)
      expect(!!emptyMessageElement).toBe(hasEmptyMessage)
    },
  )

  test.each([
    {
      listType: ListType.LearningPath,
      sortable: false,
      condensed: false,
      cardProps: {},
    },
    {
      listType: ListType.LearningPath,
      sortable: true,
      condensed: false,
      cardProps: { draggable: true },
    },
    {
      listType: ListType.UserList,
      sortable: false,
      condensed: false,
      cardProps: {},
    },
    {
      listType: ListType.UserList,
      sortable: true,
      condensed: false,
      cardProps: { draggable: true },
    },
    {
      listType: ListType.LearningPath,
      sortable: true,
      condensed: true,
      cardProps: { draggable: true },
    },
  ])(
    "Shows a list of $listType LearningResourceCards with sortable=$sortable and condensed=$condensed",
    ({ listType, sortable, condensed, cardProps }) => {
      const emptyMessage = faker.lorem.sentence()
      const paginatedRelationships = getPaginatedRelationships(
        listType,
        faker.number.int({ min: 2, max: 4 }),
        faker.number.int(),
      )
      const items = paginatedRelationships.results as LearningResourceListItem[]
      const user = factories.user.user()
      setMockResponse.get(urls.userMe.get(), user)
      setMockResponse.get(urls.userLists.membershipList(), [])
      setMockResponse.get(urls.learningPaths.membershipList(), [])
      renderWithProviders(
        <ItemsListing
          listType={listType}
          emptyMessage={emptyMessage}
          items={items}
          sortable={sortable}
          condensed={condensed}
        />,
      )

      const titles = items.map((item) => item.resource.title)

      const role = sortable ? "button" : "link"
      const cards = screen.getAllByRole(role, {
        name: (value) => titles.some((title) => value.includes(title)),
      })
      expect(cards.length).toBe(titles.length)

      if (sortable) {
        items.forEach(({ resource }) => {
          if (condensed) {
            expectProps(spyLearningResourceListCardCondensed, {
              resource,
              ...cardProps,
            })
          } else {
            expectProps(spyLearningResourceListCard, { resource, ...cardProps })
          }
        })
      }
    },
  )
})

describe.each([ListType.LearningPath, ListType.UserList])(
  "Sorting ItemListing",
  (listType: string) => {
    const setup = (props: Partial<ItemsListingProps> = {}) => {
      const listType = props.listType || ""
      const emptyMessage = faker.lorem.sentence()
      const parentId = faker.number.int()
      const paginatedRelationships = getPaginatedRelationships(
        listType,
        5,
        parentId,
      )
      const items = paginatedRelationships.results as LearningResourceListItem[]
      const defaultProps: ItemsListingProps = {
        listType: listType,
        items: items,
        isLoading: false,
        sortable: true,
        emptyMessage,
      }
      const allProps = { ...defaultProps, ...props }
      renderWithProviders(<ItemsListing {...allProps} />, { user: {} })

      const onSortEnd = spySortableList.mock.lastCall?.[0]?.onSortEnd
      invariant(onSortEnd)

      const simulateDrag = (from: number, to: number) => {
        const active = items[from]
        const over = items[to]
        onSortEnd({
          activeIndex: from,
          overIndex: to,
          active: {
            data: {
              // @ts-expect-error not fully simulated
              current: active,
            },
          },
          over: {
            data: {
              // @ts-expect-error not fully simulated
              current: over,
            },
          },
        })
      }

      const patchUrl = (listType: string, id: number) => {
        if (listType === ListType.LearningPath) {
          return urls.learningPaths.resourceDetails({
            learning_resource_id: parentId,
            id,
          })
        } else if (listType === ListType.UserList) {
          return urls.userLists.resourceDetails({
            userlist_id: parentId,
            id,
          })
        } else {
          throw new Error("Invalid list type passed to patchUrl")
        }
      }

      return { simulateDrag, items, patchUrl }
    }

    test("Dragging an item to a new position calls API correctly", async () => {
      const { simulateDrag, items, patchUrl } = setup({ listType: listType })
      const [from, to] = [1, 3]
      const active = items[from]
      const over = items[to]

      setMockResponse.patch(patchUrl(listType, active.id))

      act(() => simulateDrag(from, to))

      await waitFor(() => {
        expect(makeRequest).toHaveBeenCalledWith(
          "patch",
          patchUrl(listType, active.id),
          {
            position: over.position,
          },
        )
      })
    })

    test("Dragging is disabled while API call is made", async () => {
      const { simulateDrag, items, patchUrl } = setup({ listType: listType })
      const [from, to] = [1, 3]
      const active = items[from]

      const patchResponse = new ControlledPromise<void>()
      setMockResponse.patch(patchUrl(listType, active.id), patchResponse)

      act(() => simulateDrag(from, to))
      await waitFor(() => {
        expect(makeRequest).toHaveBeenCalledWith(
          "patch",
          patchUrl(listType, active.id),
          expect.anything(),
        )
      })

      expectProps(spySortableItem, { disabled: true })

      await act(async () => {
        patchResponse.resolve()
        await patchResponse
      })

      expectProps(spySortableItem, { disabled: false })
    })

    test("UI order is correct while waiting for API response", async () => {
      const { simulateDrag, items, patchUrl } = setup({ listType: listType })
      const titles = items.map((items) => items.resource.title)
      const [from, to] = [1, 3]
      const active = items[from]

      const patchResponse = new ControlledPromise<void>()
      setMockResponse.patch(patchUrl(listType, active.id), patchResponse)

      // dnd-kit draggables have role button (+ a roledescription)
      const cards1 = screen.getAllByRole("button", {
        name: (value) => titles.some((title) => value.includes(title)),
      })
      expect(cards1.length).toBe(titles.length)

      act(() => simulateDrag(from, to))

      await waitFor(() => {
        const cards2 = screen.getAllByRole("button", {
          name: (value) => titles.some((title) => value.includes(title)),
        })
        expect(cards2).toEqual([
          cards1[0],
          cards1[2],
          cards1[3],
          cards1[1],
          cards1[4],
        ])
      })
    })

    test("Sorting is disabled when isRefetching=true", async () => {
      setup({ listType: listType, isRefetching: true })
      expectProps(spySortableItem, { disabled: true })
    })
  },
)
