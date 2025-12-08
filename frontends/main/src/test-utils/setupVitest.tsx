import React from "react"
import { vi } from "vitest"
import { mockAxiosInstance } from "api/test-utils"

vi.mock("axios", async () => {
  const actual = await vi.importActual<typeof import("axios")>("axios")
  return {
    __esModule: true,
    default: {
      create: () => mockAxiosInstance,
      AxiosError: actual.AxiosError,
    },
    AxiosError: actual.AxiosError,
  }
})

vi.mock("react-markdown", () => {
  return {
    __esModule: true,
    default: ({ children }: { children: string }) => <div>{children}</div>,
  }
})

// Mock next/dynamic for Vitest
vi.mock("next/dynamic", () => {
  return {
    default: (loader: any, options?: any) => {
      const Component = React.forwardRef((props: any, ref: any) => {
        const [Component, setComponent] = React.useState<any>(null)
        React.useEffect(() => {
          if (typeof loader === "function") {
            loader().then((mod: any) => {
              setComponent(() => mod.default || mod)
            })
          }
        }, [])
        if (!Component) return null
        return <Component ref={ref} {...props} />
      })
      Component.displayName = "DynamicComponent"
      return Component
    },
  }
})

// Mock next-nprogress-bar
vi.mock("next-nprogress-bar", async () => {
  const navigationMocks = await vi.importActual<{
    nextNavigationMocks: { useRouter: () => any }
  }>("ol-test-utilities/mocks/nextNavigation")
  return {
    useRouter: navigationMocks.nextNavigationMocks.useRouter,
    AppProgressBar: () => null,
  }
})

// Mock next/image to handle invalid URLs gracefully
vi.mock("next/image", () => {
  return {
    default: ({
      src,
      alt,
      ...props
    }: {
      src: string | { src: string }
      alt?: string
      [key: string]: any
    }) => {
      const imageSrc =
        typeof src === "string" ? src : src?.src || "/placeholder.png"
      // Ensure src is a valid URL or path
      const safeSrc = imageSrc.startsWith("http")
        ? imageSrc
        : imageSrc.startsWith("/")
          ? `http://test.learn.odl.local:8062${imageSrc}`
          : `http://test.learn.odl.local:8062/${imageSrc}`
      return React.createElement("img", {
        src: safeSrc,
        alt: alt || "",
        ...props,
      })
    },
  }
})

beforeEach(() => {
  // React testing library mounts the components into a container, and clears
  // the container automatically after each test.
  // However, react-helmet manipulates the document head, which is outside that
  // container. So we need to clear it manually.
  // document.head.innerHTML = ""
  document.querySelector("title")?.remove()
})

window.scrollTo = vi.fn()
