import React from "react"
import type { Channel } from "api/v0"
import { styled } from "ol-components"

export const AVATAR_SMALL = "small" as const
export const AVATAR_MEDIUM = "medium" as const
export const AVATAR_LARGE = "large" as const

type ImageVariant = "normal" | "inverted"

type ImageSize =
  | typeof AVATAR_SMALL
  | typeof AVATAR_MEDIUM
  | typeof AVATAR_LARGE

type AvatarProps = {
  imageSize?: ImageSize
  channel: Channel
  editable?: boolean
  formImageUrl?: string | null
  name?: string
  imageVariant?: ImageVariant | null
}

const initials = (title: string): string => {
  return title
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((item) => (item[0] ?? "").toUpperCase())
    .join("")
}

const getImage = (channel: Channel, imageSize: ImageSize | undefined) => {
  switch (imageSize) {
    case AVATAR_LARGE:
      return channel.avatar
    case AVATAR_SMALL:
      return channel.avatar_small
    default:
      return channel.avatar_medium
  }
}

const IMG_SIZES = {
  small: "22px",
  medium: "57px",
  large: "90px",
}
const FONT_STYLES = {
  small: "subtitle1",
  medium: "h3",
  large: "h2",
} as const

type AvatarStyleProps = Required<
  Pick<AvatarProps, "imageSize" | "imageVariant">
>
const AvatarContainer = styled.div<AvatarStyleProps>(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  height: ({ imageSize }) => IMG_SIZES[imageSize],
  width: "auto",
  [theme.breakpoints.down("sm")]: {
    height: "auto",
    width: "100%",
  },
}))

const AvatarImg = styled.img<AvatarStyleProps>({
  minHeight: 0,
  minWidth: 0,
  height: ({ imageSize }) => IMG_SIZES[imageSize],
  width: "auto",
  variants: [
    {
      props: { imageVariant: "inverted" },
      style: { filter: "saturate(0%) invert(100%)" },
    },
  ],
})

const AvatarInitials = styled.div<AvatarStyleProps>(({ theme }) => ({
  minHeight: 0,
  minWidth: 0,
  height: ({ imageSize }) => IMG_SIZES[imageSize],
  width: "auto",
  color: "white",
  variants: [
    {
      props: { imageVariant: "inverted" },
      style: { filter: "saturate(0%) invert(100%)" },
    },
    {
      props: { imageSize: AVATAR_SMALL },
      style: {
        ...theme.typography[FONT_STYLES[AVATAR_SMALL]],
        height: IMG_SIZES[AVATAR_SMALL],
      },
    },
    {
      props: { imageSize: AVATAR_MEDIUM },
      style: {
        ...theme.typography[FONT_STYLES[AVATAR_MEDIUM]],
        height: IMG_SIZES[AVATAR_MEDIUM],
      },
    },
    {
      props: { imageSize: AVATAR_LARGE },
      style: {
        ...theme.typography[FONT_STYLES[AVATAR_LARGE]],
        height: IMG_SIZES[AVATAR_LARGE],
      },
    },
  ],
}))

const ChannelAvatar: React.FC<AvatarProps> = (props) => {
  const {
    channel,
    formImageUrl,
    imageSize = "medium",
    imageVariant = "normal",
  } = props

  const imageUrl = formImageUrl || getImage(channel, imageSize)

  return (
    <AvatarContainer imageSize={imageSize} imageVariant={imageVariant}>
      {!imageUrl ? (
        <AvatarInitials imageSize={imageSize} imageVariant={imageVariant}>
          {initials(channel.title)}
        </AvatarInitials>
      ) : (
        <AvatarImg
          alt=""
          src={imageUrl}
          imageSize={imageSize}
          imageVariant={imageVariant}
        />
      )}
    </AvatarContainer>
  )
}

export default ChannelAvatar
