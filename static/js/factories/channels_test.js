// @flow
import { assert } from "chai"

import { makeChannel } from "./channels"

describe("channels factory", () => {
  it("should make a channel", () => {
    const channel = makeChannel()
    assert.isString(channel.name)
    assert.isString(channel.title)
    assert.equal(channel.channel_type, "public")
    assert.isString(channel.public_description)
    assert.isNumber(channel.num_users)
  })
})
