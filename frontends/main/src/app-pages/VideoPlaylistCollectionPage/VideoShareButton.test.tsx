import React from "react"
import { renderWithProviders, screen, user } from "@/test-utils"
import { factories } from "api/test-utils"
import { ResourceTypeEnum } from "api/v1"
import type { VideoResource } from "api/v1"
import VideoShareButton from "./VideoShareButton"
import type { VideoPlayerHandle } from "./VideoResourcePlayer"

const makeVideo = (overrides: Partial<VideoResource> = {}): VideoResource =>
  factories.learningResources.video({
    resource_type: ResourceTypeEnum.Video,
    ...overrides,
  }) as VideoResource

const PAGE_URL = "https://learn.mit.edu/video/42?playlist=1"

type RenderOptions = {
  video?: VideoResource
  title?: string
  pageUrl?: string
  playerRef?: React.RefObject<VideoPlayerHandle | null>
}

const renderButton = ({
  video = makeVideo(),
  title = video.title ?? "Test video",
  pageUrl = PAGE_URL,
  playerRef,
}: RenderOptions = {}) =>
  renderWithProviders(
    <VideoShareButton
      video={video}
      title={title}
      pageUrl={pageUrl}
      playerRef={playerRef}
    />,
  )

describe("VideoShareButton", () => {
  describe("share button", () => {
    test("renders with an aria-label containing the video title", async () => {
      renderButton({ title: "My Cool Video" })
      expect(
        await screen.findByRole("button", { name: /share my cool video/i }),
      ).toBeInTheDocument()
    })

    test("dialog is not visible before the button is clicked", async () => {
      renderButton()
      await screen.findByRole("button", { name: /share/i })
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })

    test("clicking the button opens the share dialog", async () => {
      renderButton({ title: "Opening Test" })
      await user.click(
        await screen.findByRole("button", { name: /share opening test/i }),
      )
      expect(screen.getByRole("dialog")).toBeInTheDocument()
    })

    test("closing the dialog hides it", async () => {
      renderButton({ title: "Close Test" })
      await user.click(
        await screen.findByRole("button", { name: /share close test/i }),
      )
      await user.click(screen.getByRole("button", { name: /^close$/i }))
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })
  })

  describe("getCurrentTime integration", () => {
    test("passes 0 to ShareDialog when no playerRef is provided", async () => {
      renderButton({ title: "No Ref" })
      await user.click(
        await screen.findByRole("button", { name: /share no ref/i }),
      )
      // With no getCurrentTime value > 0 the share URL is the bare page URL
      expect(screen.getByDisplayValue(PAGE_URL)).toBeInTheDocument()
    })

    test("passes 0 to ShareDialog when playerRef.current is null", async () => {
      const playerRef = React.createRef<VideoPlayerHandle | null>()
      renderButton({ title: "Null Ref", playerRef })
      await user.click(
        await screen.findByRole("button", { name: /share null ref/i }),
      )
      expect(screen.getByDisplayValue(PAGE_URL)).toBeInTheDocument()
    })

    test("reads current time from playerRef and passes it to ShareDialog", async () => {
      const handle: VideoPlayerHandle = { getCurrentTime: () => 90 }
      const playerRef = {
        current: handle,
      } as React.RefObject<VideoPlayerHandle | null>

      renderButton({ title: "With Time", playerRef })
      await user.click(
        await screen.findByRole("button", { name: /share with time/i }),
      )
      // timestamp 90s appended to share URL
      expect(screen.getByDisplayValue(`${PAGE_URL}&t=90`)).toBeInTheDocument()
    })
  })
})
