import React from "react"
import { renderWithProviders, screen } from "@/test-utils"
import { factories, setMockResponse, urls } from "api/test-utils"
import { MediaEmbedViewer } from "./MediaEmbedViewer"

// The player sizes itself to the video; these tests are about the container
// around it, so a stub stands in for it.
jest.mock("@/page-components/VideoPlayer/VideoResourcePlayer", () => ({
  __esModule: true,
  default: () => <div data-testid="video-resource-player" />,
}))

/** The CSS rules emotion inserted for an element's classes, joined. */
const rulesFor = (el: Element) => {
  const rules = [...document.querySelectorAll("style")].flatMap((style) =>
    [...(style.sheet?.cssRules ?? [])].map((rule) => rule.cssText),
  )
  return [...el.classList]
    .flatMap((cls) => rules.filter((rule) => rule.includes(`.${cls}`)))
    .join("\n")
}

describe("MediaEmbedViewer", () => {
  test("doesn't crop an MIT Learn video, which can be taller than 16:9", async () => {
    const video = factories.learningResources.video()
    setMockResponse.get(urls.learningResources.details({ id: video.id }), video)
    renderWithProviders(
      <MediaEmbedViewer
        node={{ attrs: { caption: "A short", mitLearnVideoId: video.id } }}
      />,
    )
    const container = (await screen.findByTestId("video-resource-player"))
      .parentElement!.parentElement!
    expect(container).toHaveClass("mit-learn-video")
    expect(rulesFor(container)).toMatch(
      /\.mit-learn-video \{\s*aspect-ratio: auto;\s*overflow: visible;/,
    )
  })

  test("keeps other embeds in a 16:9 frame", () => {
    renderWithProviders(
      <MediaEmbedViewer
        node={{
          attrs: { src: "https://www.youtube.com/embed/abc", caption: "Clip" },
        }}
      />,
    )
    const container = screen.getByTitle("Clip").parentElement!
    expect(container).not.toHaveClass("mit-learn-video")
    expect(rulesFor(container)).toMatch(/aspect-ratio: 16 ?\/ ?9/)
  })
})
