import { check, fail } from "k6"
import { Trend } from "k6/metrics"
import { randomItem } from "https://jslib.k6.io/k6-utils/1.2.0/index.js"

import { createV0Client } from "./client/client.ts"

const ENDPOINTS = [
  "channels_list",
  "channels_type_retrieve",
  "channels_retrieve",
  "channels_counts_list",
] as const
type Endpoint = (typeof ENDPOINTS)[number]

// One Trend per endpoint.
const trends: Record<string, Trend> = {}
for (const endpoint of ENDPOINTS) {
  trends[endpoint] = new Trend(`channels_${endpoint}`, true)
}

type DiscoveredChannel = {
  id: number
  channel_type: string
  name: string
}

/**
 * Discover real channel type/name/id values once, before the load ramps.
 * Runs in k6 setup() where http is allowed.
 */
export function discoverChannels(baseUrl: string): {
  channels: DiscoveredChannel[]
  channelTypes: string[]
} {
  const client = createV0Client()
  const res = client.channelsList({ limit: 100 })
  const results = res.response.json("results") as DiscoveredChannel[]
  if (!results || results.length === 0) {
    fail("channels discovery returned no results")
  }
  let channels = results.map((c) => ({
    id: c.id,
    channel_type: c.channel_type,
    name: c.name,
  }))
  // Optionally narrow to a channel name prefix when you want to target a
  // seeded dataset (for example, CHANNEL_NAME_PREFIX=loadtest-).
  const namePrefix = __ENV.CHANNEL_NAME_PREFIX
  if (namePrefix) {
    const matching = channels.filter((c) => c.name.startsWith(namePrefix))
    if (matching.length > 0) {
      channels = matching
    }
  }
  // The counts endpoint only applies to channel types backed by a resource
  // taxonomy (topic/department/unit); pathway channels have nothing to count.
  const COUNTABLE_TYPES = ["topic", "department", "unit"]
  const channelTypes = [...new Set(channels.map((c) => c.channel_type))].filter(
    (t) => COUNTABLE_TYPES.includes(t),
  )
  return { channels, channelTypes }
}

function record(endpoint: Endpoint, res) {
  trends[endpoint].add(res.response.timings.duration, { endpoint })
  check(res, {
    [`${endpoint} is 200`]: (r) => r.response.status === 200,
  })
}

const tags = (endpoint: Endpoint) => ({ tags: { endpoint } })

export function testChannels(data: {
  channels: DiscoveredChannel[]
  channelTypes: string[]
}) {
  const { channels, channelTypes } = data
  const client = createV0Client()
  const channel = randomItem(channels)
  const channelType = randomItem(channelTypes)

  record(
    "channels_list",
    client.channelsList({ limit: 50 }, tags("channels_list")),
  )

  record(
    "channels_type_retrieve",
    client.channelsTypeRetrieve(
      channel.channel_type,
      channel.name,
      tags("channels_type_retrieve"),
    ),
  )

  record(
    "channels_retrieve",
    client.channelsRetrieve(channel.id, tags("channels_retrieve")),
  )

  record(
    "channels_counts_list",
    client.channelsCountsList(channelType, tags("channels_counts_list")),
  )
}
