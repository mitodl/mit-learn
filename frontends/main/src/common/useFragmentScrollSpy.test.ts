import { renderHook, act } from "@testing-library/react"
import { useFragmentScrollSpy } from "./useFragmentScrollSpy"

let observerCallback: IntersectionObserverCallback, observedElements: Element[]
const mockUnobserve = jest.fn()

beforeEach(() => {
  observedElements = []
  mockUnobserve.mockClear()
  window.IntersectionObserver = jest.fn((cb) => {
    observerCallback = cb
    return {
      observe: (el: Element) => observedElements.push(el),
      unobserve: mockUnobserve,
      disconnect: jest.fn(),
    }
  }) as unknown as typeof IntersectionObserver
})

afterEach(() => {
  document.body.innerHTML = ""
})

const makeEntry = (
  id: string,
  isIntersecting: boolean,
  top: number,
): Partial<IntersectionObserverEntry> => ({
  target: document.getElementById(id)!,
  isIntersecting,
  boundingClientRect: { top } as DOMRect,
})

const setupDom = (...ids: string[]) => {
  document.body.innerHTML = ids.map((id) => `<div id="${id}"></div>`).join("")
}

test("Returns null when no fragments are intersecting", () => {
  setupDom("a", "b")
  const { result } = renderHook(() => useFragmentScrollSpy(["a", "b"]))
  expect(result.current).toBe(null)
})

test("Returns the single intersecting fragment", () => {
  setupDom("a", "b")
  const { result } = renderHook(() => useFragmentScrollSpy(["a", "b"]))

  act(() => {
    observerCallback(
      [makeEntry("a", true, 100)] as IntersectionObserverEntry[],
      {} as IntersectionObserver,
    )
  })
  expect(result.current).toBe("a")
})

test("Returns topmost fragment when multiple are intersecting", () => {
  setupDom("a", "b")
  const { result } = renderHook(() => useFragmentScrollSpy(["a", "b"]))

  act(() => {
    observerCallback(
      [
        makeEntry("a", true, 300),
        makeEntry("b", true, 100),
      ] as IntersectionObserverEntry[],
      {} as IntersectionObserver,
    )
  })
  expect(result.current).toBe("b")
})

test("Keeps last active fragment when all stop intersecting", () => {
  setupDom("a")
  const { result } = renderHook(() => useFragmentScrollSpy(["a"]))

  act(() => {
    observerCallback(
      [makeEntry("a", true, 100)] as IntersectionObserverEntry[],
      {} as IntersectionObserver,
    )
  })
  expect(result.current).toBe("a")

  act(() => {
    observerCallback(
      [makeEntry("a", false, -50)] as IntersectionObserverEntry[],
      {} as IntersectionObserver,
    )
  })
  expect(result.current).toBe("a")
})

test("Updates active fragment as sections scroll in and out", () => {
  setupDom("a", "b")
  const { result } = renderHook(() => useFragmentScrollSpy(["a", "b"]))

  // "a" enters viewport
  act(() => {
    observerCallback(
      [makeEntry("a", true, 200)] as IntersectionObserverEntry[],
      {} as IntersectionObserver,
    )
  })
  expect(result.current).toBe("a")

  // "b" enters below "a", "a" still visible
  act(() => {
    observerCallback(
      [makeEntry("b", true, 500)] as IntersectionObserverEntry[],
      {} as IntersectionObserver,
    )
  })
  expect(result.current).toBe("a") // "a" is higher

  // "a" scrolls out, only "b" remains
  act(() => {
    observerCallback(
      [makeEntry("a", false, -100)] as IntersectionObserverEntry[],
      {} as IntersectionObserver,
    )
  })
  expect(result.current).toBe("b")
})

test("Observes all elements matching the given IDs", () => {
  setupDom("x", "y", "z")
  renderHook(() => useFragmentScrollSpy(["x", "y", "z"]))

  expect(observedElements).toHaveLength(3)
  expect(observedElements.map((el) => el.id)).toEqual(["x", "y", "z"])
})

test("Skips IDs that don't match any DOM element", () => {
  setupDom("a")
  renderHook(() => useFragmentScrollSpy(["a", "nonexistent"]))

  expect(observedElements).toHaveLength(1)
  expect(observedElements[0].id).toBe("a")
})

test("Returns null and does not create observer for empty fragment list", () => {
  const { result } = renderHook(() => useFragmentScrollSpy([]))
  expect(result.current).toBe(null)
  expect(window.IntersectionObserver).not.toHaveBeenCalled()
})

test("Unobserves elements on unmount", () => {
  setupDom("a", "b")
  const { unmount } = renderHook(() => useFragmentScrollSpy(["a", "b"]))

  unmount()

  expect(mockUnobserve).toHaveBeenCalledTimes(2)
})

test("Passes threshold and rootMargin to IntersectionObserver", () => {
  setupDom("a")
  renderHook(() =>
    useFragmentScrollSpy(["a"], {
      threshold: 0.5,
      rootMargin: "-100px 0px -50% 0px",
    }),
  )

  expect(window.IntersectionObserver).toHaveBeenCalledWith(
    expect.any(Function),
    { threshold: 0.5, rootMargin: "-100px 0px -50% 0px" },
  )
})
