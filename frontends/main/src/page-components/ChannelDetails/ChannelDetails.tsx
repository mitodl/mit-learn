import React, { useMemo } from "react"
import { styled, Typography } from "ol-components"
import { capitalize } from "ol-utilities"
import { ChannelTypeEnum, Channel } from "api/v0"
import { RiExternalLinkLine } from "@remixicon/react"

type ChannelDetailsProps = {
  channel: Channel
}

const FACETS_BY_CHANNEL_TYPE: Record<ChannelTypeEnum, string[]> = {
  [ChannelTypeEnum.Topic]: ["free", "department", "offered_by", "delivery"],
  [ChannelTypeEnum.Department]: ["free", "topic", "offered_by", "delivery"],
  [ChannelTypeEnum.Unit]: [
    "offerings",
    "audience",
    "fee",
    "formats",
    "content_types",
    "certifications",
    "more_information",
  ],
  [ChannelTypeEnum.Pathway]: [],
}

const ChannelLink = styled.a({
  display: "flex",
  alignItems: "center",
  span: {
    paddingRight: "2px",
  },
  svg: {
    marginBottom: "2px",
  },
})

const getFacetManifest = (channelType: ChannelTypeEnum) => {
  return [
    {
      type: "group",
      facets: [
        {
          name: "free",
          label: "Free",
        },
      ],
      name: "free",
    },
    {
      name: "topic",
      title: "Topic",
      order: 0,
    },
    {
      name: "formats",
      title: "Formats",
      order: 0,
    },
    {
      name: "fee",
      title: "Fee",
      order: 0,
    },
    {
      name: "department",
      title: "Department",
      order: -2,
    },
    {
      name: "offerings",
      title: "Offerings",
      order: -1,
    },
    {
      name: "level",
      title: "Level",
      order: 0,
    },
    {
      name: "content_types",
      title: "Type of Content",
      order: 0,
    },
    {
      name: "audience",
      title: "Audience",
      order: 0,
    },
    {
      name: "more_information",
      title: "More Information",

      labelFunction: (key: string, channelTitle: string) => (
        // eslint-disable react/jsx-no-target-blank
        <ChannelLink target="_blank" href={key} rel="noopener noreferrer">
          <span>{channelTitle} Website</span>
          <RiExternalLinkLine size={16} />
        </ChannelLink>
      ),
      order: 1,
    },
    {
      name: "platform",
      title: "Platform",
      order: 0,
    },
    {
      name: "offered_by",
      title: "Offered By",
      order: 0,
    },
    {
      name: "certifications",
      title: "Certificates",
      order: 0,
    },
    {
      name: "delivery",
      title: "Format",
      order: 0,
      labelFunction: (key: string) =>
        key
          .split("_")
          .map((word) => capitalize(word))
          .join("-"),
    },
  ].filter((facetSetting) =>
    (FACETS_BY_CHANNEL_TYPE[channelType] || []).includes(facetSetting.name),
  )
}

const getChannelDetails = (channel: Channel) => {
  const channelType = channel.channel_type
  const dataKey = `${channelType}_detail`
  const channelData = channel as unknown as Record<string, string[] | string>
  const data = channelData[dataKey] as unknown as Record<
    string,
    string[] | string
  >
  return data[channelType]
}
const InfoLabel = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.mitRed,
}))
const ChannelDetailsCard = styled.div(({ theme }) => ({
  borderRadius: "12px",
  backgroundColor: "white",
  padding: "36px",
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  [theme.breakpoints.up("md")]: {
    minWidth: "408px",
  },
  [theme.breakpoints.down("md")]: {
    padding: "16px",
    marginTop: "16px",
    width: "100%",
  },
}))

const ChannelDetails: React.FC<ChannelDetailsProps> = (props) => {
  const { channel } = props
  const channelDetails = getChannelDetails(channel)
  const channelType = channel.channel_type
  const channelTitle = channel.title

  const facetManifest = useMemo(
    () => getFacetManifest(channelType),
    [channelType],
  )

  const body = facetManifest
    .sort((a, b) => {
      if (!("order" in a)) return 1
      if (!("order" in b)) return -1
      return (a?.order || 0) - (b?.order || 0)
    })
    .map((value) => {
      const detailValue = (
        channelDetails as unknown as { [key: string]: string }
      )[value.name]
      if (detailValue) {
        const label = value?.labelFunction
          ? value.labelFunction(detailValue, channelTitle)
          : detailValue

        return (
          <div key={value.title}>
            <InfoLabel
              variant="subtitle2"
              sx={{ marginBottom: (theme) => theme.typography.pxToRem(4) }}
            >
              {value.title}
            </InfoLabel>
            <Typography variant="body3" color="text.secondary">
              {Array.isArray(label) ? label.join(" | ") : label}
            </Typography>
          </div>
        )
      }
      return null
    })
  return (
    <ChannelDetailsCard data-testid="unit-details">{body}</ChannelDetailsCard>
  )
}

export { ChannelDetails }
export type { ChannelDetailsProps }
