import React from "react"
import { faker } from "@faker-js/faker/locale/en"
import { render } from "@testing-library/react"
import Widget from "./Widget"
import { makeEmbeddedUrlWidget } from "../factories"
import { EmbedlyCard } from "ol-components/EmbedlyCard/EmbedlyCard"

jest.mock("ol-components/EmbedlyCard/EmbedlyCard", () => {
  const actual = jest.requireActual("ol-components/EmbedlyCard/EmbedlyCard")
  return {
    __esModule: true,
    ...actual,
    EmbedlyCard: jest.fn(actual.EmbedlyCard),
  }
})
const spyEmbedlyCard = jest.mocked(EmbedlyCard)

describe("Widget-EmbeddedUrl", () => {
  test("it renderes <EmbedlyCard /> when url is set", () => {
    const url = new URL(faker.internet.url()).toString()
    const widget = makeEmbeddedUrlWidget({ configuration: { url } })
    render(<Widget widget={widget} />)
    expect(spyEmbedlyCard).toHaveBeenCalledWith(
      expect.objectContaining({ url }),
      expect.anything(),
    )
  })
})
