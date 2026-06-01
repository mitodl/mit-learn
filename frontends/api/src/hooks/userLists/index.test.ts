import { renderHook } from "@testing-library/react"
import { assertNormalizesPaginationNext } from "../test-utils"
import { urls } from "../../test-utils"
import { useInfiniteUserListItems } from "./index"

describe("useInfiniteUserListItems", () => {
  test("normalizes absolute next URLs to relative API requests", async () => {
    const userlistId = 12
    await assertNormalizesPaginationNext({
      firstUrl: urls.userLists.resources({ userlist_id: userlistId }),
      secondUrl: urls.userLists.resources({
        userlist_id: userlistId,
        offset: 5,
      }),
      renderInfiniteHook: (wrapper) =>
        renderHook(
          () => useInfiniteUserListItems({ userlist_id: userlistId }),
          { wrapper },
        ),
    })
  })
})
