import React from "react"
import { screen } from "@testing-library/react"
import { ChannelDetails } from "./ChannelDetails"
// eslint-disable-next-line import/no-extraneous-dependencies
import { urls } from "api/test-utils"
import { renderWithTheme, setMockResponse } from "@/test-utils"
import { channels as factory } from "api/test-utils/factories"

describe("ChannelDetails", () => {
  it("Includes channel detail info panel", async () => {
    const channel = factory.channel({
      title: "Test Title",
      channel_type: "unit",
    })
    setMockResponse.get(
      urls.channels.details(channel.channel_type, channel.name),
      channel,
    )
    renderWithTheme(<ChannelDetails channel={channel} />)
    const channelData = channel as unknown as Record<string, unknown>
    const unitDetail = channelData.unit_detail as unknown as Record<
      string,
      unknown
    >
    const offeror = unitDetail.unit as unknown as Record<string, unknown>
    const offerings = offeror.offerings as string[]
    const audience = offeror.audience as string[]
    const formats = offeror.formats as string[]
    const contentTypes = offeror.content_types as string[]
    const certifications = offeror.certifications as string[]
    screen.getByText(offerings.join(" | "))
    screen.getByText(audience.join(" | "))
    screen.getByText(formats.join(" | "))
    screen.getByText(certifications.join(" | "))
    screen.getByText(contentTypes.join(" | "))
  })

  it("Sorts displayed items correctly", async () => {
    const channel = factory.channel({
      title: "Test Title",
      channel_type: "unit",
    })
    setMockResponse.get(
      urls.channels.details(channel.channel_type, channel.name),
      channel,
    )
    renderWithTheme(<ChannelDetails channel={channel} />)

    expect(screen.getByTestId("unit-details").firstChild).toHaveTextContent(
      "Offerings",
    )
    expect(screen.getByTestId("unit-details").lastChild).toHaveTextContent(
      "More Information",
    )
  })
})
