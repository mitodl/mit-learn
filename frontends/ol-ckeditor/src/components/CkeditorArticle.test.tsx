/* eslint-disable testing-library/no-container */
import React from "react"
import { render } from "@testing-library/react"
import CkeditorArticle from "./CkeditorArticle"
import { ensureEmbedlyPlatform } from "ol-components/EmbedlyCard/util"

jest.mock("ol-components/EmbedlyCard/util", () => {
  const original = jest.requireActual("ol-components/EmbedlyCard/util")
  return {
    ...original,
    ensureEmbedlyPlatform: jest.fn(original.ensureEmbedlyPlatform),
  }
})

describe("CkeditorArticle", () => {
  it("should load embedlyPlatform exactly once when rendered multiple times", () => {
    render(
      <CkeditorArticle
        initialData="Hello world"
        onChange={jest.fn()}
        config={{ cloudServices: undefined }}
      />,
    )
    expect(jest.mocked(ensureEmbedlyPlatform)).toHaveBeenCalled()
  })

  it("Adds the given id and classes to the wrapper", () => {
    const view = render(
      <CkeditorArticle
        className="test-class-a test-class-b"
        id={"test-id"}
        initialData="Hello world"
        onChange={jest.fn()}
        config={{ cloudServices: undefined }}
      />,
    )
    expect(view.container.firstChild).toHaveClass("test-class-a test-class-b")
    expect(view.container.firstChild).toHaveAttribute("id", "test-id")
  })
})
