import React from "react"
import { renderWithProviders, screen, user } from "@/test-utils"
import { factories } from "api/test-utils"
import { ResourceTypeEnum } from "api/v1"
import type { VideoResource } from "api/v1"
import VideoShareDialog from "./VideoShareDialog"

const PAGE_URL = "https://learn.mit.edu/video/42?playlist=1"

const makeVideo = (overrides: Partial<VideoResource> = {}): VideoResource =>
  factories.learningResources.video({
    resource_type: ResourceTypeEnum.Video,
    ...overrides,
  }) as VideoResource

const renderDialog = (video: VideoResource = makeVideo()) =>
  renderWithProviders(
    <VideoShareDialog
      open
      onClose={jest.fn()}
      anchorEl={null}
      video={video}
      pageUrl={PAGE_URL}
      title={video.title ?? "Test video"}
    />,
  )

describe("VideoShareDialog", () => {
  describe("tab switching", () => {
    test("defaults to the Share tab", async () => {
      renderDialog()
      expect(
        await screen.findByRole("tab", { name: /share/i }),
      ).toBeInTheDocument()
      expect(screen.getByText("Share on Social")).toBeInTheDocument()
    })

    test("switches to Embed tab on click", async () => {
      renderDialog()
      await user.click(await screen.findByRole("tab", { name: /embed/i }))
      expect(screen.getByText("Video URL")).toBeInTheDocument()
      expect(screen.getByText("Embed HTML")).toBeInTheDocument()
    })

    test("switches back to Share tab from Embed tab", async () => {
      renderDialog()
      await user.click(await screen.findByRole("tab", { name: /embed/i }))
      await user.click(screen.getByRole("tab", { name: /share/i }))
      expect(screen.getByText("Share on Social")).toBeInTheDocument()
    })
  })

  describe("close button", () => {
    test("calls onClose when the close button is clicked", async () => {
      const onClose = jest.fn()
      renderWithProviders(
        <VideoShareDialog
          open
          onClose={onClose}
          anchorEl={null}
          video={makeVideo()}
          pageUrl={PAGE_URL}
          title="Test video"
        />,
      )
      await user.click(
        await screen.findByRole("button", { name: /close dialog/i }),
      )
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  describe("Share tab", () => {
    test("renders social share links", async () => {
      renderDialog()
      await screen.findByRole("link", { name: /share on facebook/i })
      screen.getByRole("link", { name: /share on x/i })
      screen.getByRole("link", { name: /share on linkedin/i })
    })

    test("Share a link input contains the page URL", async () => {
      renderDialog()
      expect(await screen.findByDisplayValue(PAGE_URL)).toBeInTheDocument()
    })
  })

  describe("Embed tab — YouTube video", () => {
    const youtubeVideo = makeVideo({
      url: "https://www.youtube.com/watch?v=abc123XYZ",
      platform: {
        code: "youtube",
        name: "YouTube",
      } as VideoResource["platform"],
    })

    test("Embed HTML textarea contains the YouTube embed src", async () => {
      renderDialog(youtubeVideo)
      await user.click(await screen.findByRole("tab", { name: /embed/i }))
      const textarea = screen.getByRole("textbox", {
        name: "Embed HTML",
      }) as HTMLTextAreaElement
      expect(textarea.value).toContain(
        "https://www.youtube.com/embed/abc123XYZ",
      )
    })

    test("Video URL input contains the MIT Learn embed URL", async () => {
      renderDialog(youtubeVideo)
      await user.click(await screen.findByRole("tab", { name: /embed/i }))
      const input = screen.getByRole("textbox", {
        name: "Video URL",
      }) as HTMLInputElement
      expect(input.value).toContain(`/video/embed/${youtubeVideo.id}`)
    })
  })

  describe("Embed tab — OVS video", () => {
    const ovsVideo = makeVideo({
      platform: {
        code: "ovs",
        name: "ODL Video Service",
      } as VideoResource["platform"],
      video: {
        id: 1,
        caption_urls: [],
        streaming_url: "https://cdn.odl.mit.edu/video/stream.m3u8",
        duration: "300",
        cover_image_url: null,
      },
    })

    test("Embed HTML uses the MIT Learn embed URL for OVS videos", async () => {
      renderDialog(ovsVideo)
      await user.click(await screen.findByRole("tab", { name: /embed/i }))
      const textarea = screen.getByRole("textbox", {
        name: "Embed HTML",
      }) as HTMLTextAreaElement
      expect(textarea.value).toContain(`/video/embed/${ovsVideo.id}`)
    })

    test("Embed HTML does not contain a YouTube URL for OVS videos", async () => {
      renderDialog(ovsVideo)
      await user.click(await screen.findByRole("tab", { name: /embed/i }))
      const textarea = screen.getByRole("textbox", {
        name: "Embed HTML",
      }) as HTMLTextAreaElement
      expect(textarea.value).not.toContain("youtube.com")
    })
  })
})
