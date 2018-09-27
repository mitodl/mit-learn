// @flow
import { assert } from "chai"

import SubscriptionsList from "./SubscriptionsList"

import { channelURL } from "../lib/url"
import { makeChannelList } from "../factories/channels"
import { configureShallowRenderer } from "../lib/test_utils"

describe("SubscriptionsList", function() {
  let channels, myChannels, notMyChannels, renderSubscriptionsList

  beforeEach(() => {
    channels = makeChannelList()
    // make sure there are some of each and they're not grouped together
    channels.forEach((channel, i) => {
      channel.user_is_moderator = i % 2 === 0
    })
    myChannels = channels.filter(channel => channel.user_is_moderator)
    notMyChannels = channels.filter(channel => !channel.user_is_moderator)
    renderSubscriptionsList = configureShallowRenderer(SubscriptionsList, {
      subscribedChannels: channels,
      currentChannel:     channels[0].name
    })
  })

  it("should show each channel", () => {
    const wrapper = renderSubscriptionsList()

    assert.equal(wrapper.find(".channel-link").length, channels.length)
    assert.equal(
      wrapper.find(".my-channels .channel-link").length,
      myChannels.length
    )
    assert.equal(
      wrapper.find(".channels .channel-link").length,
      notMyChannels.length
    )

    wrapper.find(".my-channels .channel-link").forEach((link, index) => {
      assert.equal(link.find(".title").text(), myChannels[index].title)
      assert.equal(link.props().to, channelURL(myChannels[index].name))
      assert.deepEqual(
        link.find("Connect(ChannelAvatar)").props().channel,
        myChannels[index]
      )
    })

    wrapper.find(".channels .channel-link").forEach((link, index) => {
      assert.equal(link.find(".title").text(), notMyChannels[index].title)
      assert.equal(link.props().to, channelURL(notMyChannels[index].name))
      assert.deepEqual(
        link.find("Connect(ChannelAvatar)").props().channel,
        notMyChannels[index]
      )
    })
  })

  it("should highlight the current channel", () => {
    const wrapper = renderSubscriptionsList()
    const currentLocation = wrapper.find(".current-location")
    assert.lengthOf(currentLocation, 1)
    assert.equal(currentLocation.props().className, "location current-location")
    assert.equal(currentLocation.find(".title").text(), channels[0].title)
    assert.equal(
      currentLocation
        .find(".channel-link")
        .at(0)
        .props().to,
      channelURL(channels[0].name)
    )
  })
})
