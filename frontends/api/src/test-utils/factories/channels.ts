import { faker } from "@faker-js/faker/locale/en"
import {
  makePaginatedFactory,
  mergeOverrides,
  type PartialFactory,
} from "ol-test-utilities"
import { UniqueEnforcer } from "enforce-unique"
import {
  ChannelTypeEnum,
  DepartmentChannel,
  Channel,
  UnitChannel,
  PathwayChannel,
  TopicChannel,
} from "../../generated/v0"
import { offeror } from "./learningResources"
const channelType = () =>
  faker.helpers.arrayElement(Object.values(ChannelTypeEnum))

const channel: PartialFactory<Channel> = (overrides = {}) => {
  overrides = mergeOverrides(
    {
      channel_type: channelType(),
      configuration: {
        banner_background: "/static/images/test.jpg",
        heading: "this is a test heading",
        logo: "/static/images/test.svg",
        name: "test",
        sub_heading: "this is a subheading",
      },
    },
    overrides,
  )
  switch (overrides.channel_type) {
    case ChannelTypeEnum.Department:
      return departmentChannel(overrides)
    case ChannelTypeEnum.Topic:
      return topicChannel(overrides)
    case ChannelTypeEnum.Unit:
      return unitChannel(overrides)
    case ChannelTypeEnum.Pathway:
      return pathwayChannel(overrides)
    default:
      throw Error(`Invalid resource type: ${overrides.channel_type}`)
  }
}

const departmentChannel: PartialFactory<DepartmentChannel> = (
  overrides = {},
) => {
  return mergeOverrides<DepartmentChannel>(
    _channelShared(),
    { channel_type: ChannelTypeEnum.Department },
    {
      configuration: {
        banner_background: "/images/unit_banners/mitpe.jpg",
        heading: "test",
        logo: "/static/test.svg",
        name: "test",
        sub_heading: "test",
        subheader: "test",
      },
    },
    {
      department_detail: {
        department: faker.lorem.slug(),
      },
    },
    overrides,
  )
}

const topicChannel: PartialFactory<TopicChannel> = (overrides = {}) => {
  return mergeOverrides<TopicChannel>(
    _channelShared(),
    { channel_type: ChannelTypeEnum.Topic },
    {
      configuration: {
        banner_background: "/images/unit_banners/mitpe.jpg",
        heading: "test",
        logo: "/static/test.svg",
        name: "test",
        sub_heading: "test",
        subheader: "test",
      },
    },
    {
      topic_detail: {
        topic: faker.number.int(),
      },
    },
    overrides,
  )
}

const unitChannel: PartialFactory<UnitChannel> = (overrides = {}) => {
  return mergeOverrides<UnitChannel>(
    _channelShared(),
    { channel_type: ChannelTypeEnum.Unit },
    {
      configuration: {
        banner_background: "/images/unit_banners/mitpe.jpg",
        heading: "test",
        logo: "/static/test.svg",
        name: "test",
        sub_heading: "test",
        subheader: "test",
      },
    },
    {
      unit_detail: {
        unit: offeror(),
      },
    },
    overrides,
  )
}

const pathwayChannel: PartialFactory<PathwayChannel> = (overrides = {}) => {
  return mergeOverrides<PathwayChannel>(
    _channelShared(),
    { channel_type: ChannelTypeEnum.Pathway },
    overrides,
  )
}
const uniqueEnforcerSlug = new UniqueEnforcer()

const _channelShared = (): Partial<Omit<Channel, "channel_type">> => {
  return {
    name: uniqueEnforcerSlug.enforce(() => {
      return faker.lorem.slug()
    }),
    about: faker.lorem.paragraph(),
    title: faker.lorem.words(faker.number.int({ min: 1, max: 4 })),
    public_description: faker.lorem.paragraph(),
    banner: new URL(faker.internet.url()).toString(),
    avatar_small: new URL(faker.internet.url()).toString(),
    avatar_medium: new URL(faker.internet.url()).toString(),
    avatar: new URL(faker.internet.url()).toString(),
    is_moderator: faker.datatype.boolean(),
    widget_list: faker.number.int(),
    sub_channels: [],
    featured_list: null,
    lists: [],
    updated_on: faker.date.recent().toString(),
    created_on: faker.date.recent().toString(),
    id: faker.number.int(),
    ga_tracking_id: faker.lorem.slug(),
    configuration: {},
    search_filter: faker.helpers.mustache("{key}={value}", {
      key: faker.lorem.slug(),
      value: faker.lorem.slug(),
    }),
    channel_url: `${faker.internet.url({ appendSlash: false })}${faker.system.directoryPath()}`,
  }
}

const channels = makePaginatedFactory(channel)

export { channels, channel }
