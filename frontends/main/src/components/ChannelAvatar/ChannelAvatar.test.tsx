import React from "react"
import { screen } from "@testing-library/react"
import { channels as factory } from "api/test-utils/factories"
import ChannelAvatar from "./ChannelAvatar"
import { getByImageSrc } from "ol-test-utilities"
import invariant from "tiny-invariant"
import { renderWithTheme } from "@/test-utils"

describe("Avatar", () => {
  it("Displays a small avatar image for the channel", async () => {
    const channel = factory.channel()
    const view = renderWithTheme(
      <ChannelAvatar channel={channel} imageSize="small" />,
    )
    invariant(channel.avatar_small)
    const img = getByImageSrc(view.container, channel.avatar_small)
    expect(img.getAttribute("alt")).toBe("") // should be empty unless meaningful
  })

  it("Displays a medium avatar image by default", async () => {
    const channel = factory.channel()
    const view = renderWithTheme(<ChannelAvatar channel={channel} />)
    invariant(channel.avatar_medium)
    const img = getByImageSrc(view.container, channel.avatar_medium)
    expect(img.getAttribute("alt")).toBe("") // should be empty unless meaningful
  })

  it("Displays initials if no avatar image exists", async () => {
    const channel = factory.channel({
      title: "Test Title",
      avatar: null,
      avatar_small: null,
      avatar_medium: null,
    })
    renderWithTheme(<ChannelAvatar channel={channel} />)
    const img = screen.queryByRole("img")
    expect(img).toBeNull()
    await screen.findByText("TT")
  })
})
