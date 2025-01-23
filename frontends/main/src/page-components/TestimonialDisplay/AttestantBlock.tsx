import React from "react"
import { RiAccountCircleFill } from "@remixicon/react"
import { TruncateText, styled } from "ol-components"
import type { Attestation } from "api/v0"
import Image from "next/image"

type AttestantAvatarPosition = "start" | "end"
type AttestantBlockColor = "light" | "dark"
type AttestantAvatarStyle = "homepage" | "unit"
type AttestantBlockVariant = "standard" | "condensed"

type AttestantBlockChildProps = {
  avatarPosition?: AttestantAvatarPosition
  avatarStyle?: AttestantAvatarStyle
  color?: AttestantBlockColor
  variant?: AttestantBlockVariant
}

type AttestantBlockProps = AttestantBlockChildProps & {
  attestation: Attestation
}

const StyledRiAccountCircleFill = styled(RiAccountCircleFill)({
  width: "40px",
  height: "40px",
})

const AttestantBlockContainer = styled("cite")<AttestantBlockChildProps>(
  ({ theme }) => ({
    display: "flex",
    flexShrink: 0,
    ...theme.typography.body3,
    [theme.breakpoints.down("sm")]: {
      width: "100%",
      height: "56px",
      marginLeft: "0px",
    },
    variants: [
      {
        props: { avatarPosition: "start" },
        style: {
          flexDirection: "row",
          width: 300,
          marginLeft: 24,
          [theme.breakpoints.down("sm")]: {
            marginTop: 24,
          },
        },
      },
      {
        props: { avatarPosition: "end" },
        style: {
          flexDirection: "row-reverse",
          width: "100%",
          marginLeft: 0,
          [theme.breakpoints.down("sm")]: {
            marginTop: 0,
          },
        },
      },
    ],
  }),
)

const AttestantAvatar = styled("div")<AttestantBlockChildProps>(
  ({ theme }) => ({
    img: {
      objectFit: "cover",
      borderRadius: "50%",
      background: theme.custom.colors.white,
      width: "40px",
      height: "40px",
      boxShadow:
        "0px 2px 4px 0px rgba(37, 38, 43, 0.10), 0px 2px 4px 0px rgba(37, 38, 43, 0.10)",
    },
    [theme.breakpoints.down("sm")]: {
      display: ({ avatarStyle }) =>
        avatarStyle === "homepage" ? "none" : "block",
    },
    variants: [
      {
        props: { avatarPosition: "start" },
        style: {
          marginLeft: 0,
          marginRight: 12,
        },
      },
      {
        props: { avatarPosition: "end" },
        style: {
          marginLeft: 14,
          marginRight: 0,
        },
      },
    ],
  }),
)

const AttestantNameBlock = styled("div")<AttestantBlockChildProps>(
  ({ theme }) => ({
    flexGrow: "1",
    width: "auto",
    textAlign: ({ avatarPosition }) => avatarPosition,
    color: ({ color }) =>
      color === "light"
        ? theme.custom.colors.lightGray2
        : theme.custom.colors.silverGrayDark,
  }),
)

const AttestantName = styled("div")<AttestantBlockChildProps>(({ theme }) => ({
  ...theme.typography.subtitle1,
  whiteSpace: "nowrap",
  lineHeight: "125%",
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.subtitle1,
  },
  variants: [
    {
      props: { variant: "standard" },
      style: theme.typography.h5,
    },
    {
      props: { color: "light" },
      style: { color: theme.custom.colors.white },
    },
  ],
}))

const AttestantTitle = styled("div")<AttestantBlockChildProps>(({ theme }) => ({
  ...theme.typography.body3,
  color: theme.custom.colors.silverGrayDark,
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.body2,
  },
  variants: [
    {
      props: { variant: "standard" },
      style: theme.typography.body1,
    },
    {
      props: { color: "light" },
      style: { color: theme.custom.colors.lightGray2 },
    },
  ],
}))

const AttestantBlock: React.FC<AttestantBlockProps> = ({
  attestation,
  avatarPosition = "start",
  avatarStyle: avatar = "unit",
  color = "light",
  variant = "standard",
}) => {
  return (
    <AttestantBlockContainer avatarPosition={avatarPosition} color={color}>
      <AttestantAvatar
        avatarPosition={avatarPosition}
        color={color}
        avatarStyle={avatar}
      >
        {attestation.avatar_medium ? (
          <Image
            src={attestation.avatar_medium}
            alt=""
            width={40}
            height={40}
          />
        ) : (
          <StyledRiAccountCircleFill />
        )}
      </AttestantAvatar>
      <AttestantNameBlock avatarPosition={avatarPosition} color={color}>
        <AttestantName
          avatarPosition={avatarPosition}
          color={color}
          variant={variant}
        >
          {attestation?.attestant_name}
        </AttestantName>
        <AttestantTitle variant={variant} color={color}>
          <TruncateText lineClamp={2}>{attestation.title}</TruncateText>
        </AttestantTitle>
      </AttestantNameBlock>
    </AttestantBlockContainer>
  )
}

export default AttestantBlock
