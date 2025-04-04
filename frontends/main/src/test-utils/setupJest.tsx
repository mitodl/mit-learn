import React from "react"
import { mockAxiosInstance } from "api/test-utils"
import preloadAll from "jest-next-dynamic-ts"

jest.mock("axios", () => {
  const AxiosError = jest.requireActual("axios").AxiosError
  return {
    __esModule: true,
    default: {
      create: () => mockAxiosInstance,
      AxiosError,
    },
    AxiosError,
  }
})

jest.mock("react-markdown", () => {
  return {
    __esModule: true,
    default: ({ children }: { children: string }) => <div>{children}</div>,
  }
})

beforeAll(async () => {
  await preloadAll()
})

beforeEach(() => {
  // React testing library mounts the components into a container, and clears
  // the container automatically after each test.
  // However, react-helmet manipulates the document head, which is outside that
  // container. So we need to clear it manually.
  // document.head.innerHTML = ""
  document.querySelector("title")?.remove()
})

window.scrollTo = jest.fn()
