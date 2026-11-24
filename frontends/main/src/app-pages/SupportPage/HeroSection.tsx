import React from "react"
import Image from "next/image"
import { styled } from "ol-components"
import { ButtonLink } from "@mitodl/smoot-design"
import type { RemixiconComponentType } from "@remixicon/react"
import { RiArrowRightLine, RiHeartLine, RiTeamLine } from "@remixicon/react"
import { getSupportShareStoryUrl } from "@/common/config"
import { Section, SectionInner } from "./SectionLayout"
import { OPEN_LEARNING_GIVE_URL } from "./links"

const HeroBand = styled(Section)(({ theme }) => ({
  padding: "80px 24px 120px",
  backgroundImage: `linear-gradient(190deg, ${theme.custom.colors.white} 12.5%, ${theme.custom.colors.lightGray2} 87.5%)`,
  borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
  [theme.breakpoints.down("md")]: {
    padding: "40px 16px 56px",
  },
  [theme.breakpoints.down("sm")]: {
    padding: "32px 16px",
  },
}))

const Inner = styled(SectionInner)(({ theme }) => ({
  display: "flex",
  gap: "72px",
  [theme.breakpoints.down("md")]: {
    flexDirection: "column",
    gap: "32px",
  },
  [theme.breakpoints.down("sm")]: {
    gap: "24px",
  },
}))

const Left = styled.div(({ theme }) => ({
  flex: "736 1 0",
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: "40px",
  [theme.breakpoints.down("sm")]: {
    gap: "24px",
  },
}))

const Copy = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  [theme.breakpoints.down("sm")]: {
    gap: "8px",
  },
}))

const Title = styled.h1(({ theme }) => ({
  ...theme.typography.h1,
  color: theme.custom.colors.darkGray2,
  margin: 0,
  [theme.breakpoints.down("md")]: {
    ...theme.typography.h2,
  },
}))

const Subtitle = styled.p(({ theme }) => ({
  ...theme.typography.h5,
  color: theme.custom.colors.darkGray2,
  margin: 0,
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.subtitle1,
    lineHeight: 1.5,
  },
}))

const Options = styled.ul({
  display: "flex",
  flexDirection: "column",
  gap: "24px",
  listStyle: "none",
  margin: 0,
  padding: 0,
})

const Option = styled("li", {
  shouldForwardProp: (prop) => prop !== "highlighted",
})<{ highlighted?: boolean }>(({ theme, highlighted }) => ({
  display: "flex",
  alignItems: "center",
  gap: "16px",
  minHeight: "88px",
  padding: "24px",
  backgroundColor: theme.custom.colors.white,
  border: `1px solid ${
    highlighted ? theme.custom.colors.red : theme.custom.colors.silverGrayLight
  }`,
  borderRadius: "8px",
  [theme.breakpoints.down("sm")]: {
    display: "grid",
    gridTemplateColumns: "48px minmax(0, 1fr)",
    alignItems: "start",
    rowGap: "16px",
    columnGap: 0,
    // 16px from the card's outer edge, as in the design, whose border sits
    // inside the padding.
    padding: "15px",
  },
}))

const OptionIcon = styled("span", {
  shouldForwardProp: (prop) => prop !== "iconColor" && prop !== "mobileSize",
})<{ iconColor: "red" | "darkGray2"; mobileSize: number }>(
  ({ theme, iconColor, mobileSize }) => ({
    display: "flex",
    flexShrink: 0,
    padding: "4px",
    color: theme.custom.colors[iconColor],
    svg: {
      width: "40px",
      height: "40px",
    },
    // In a 48px slot beside the title; the design draws the two icons at
    // slightly different sizes so they look the same weight.
    [theme.breakpoints.down("sm")]: {
      padding: mobileSize < 36 ? "0 4px" : 0,
      svg: {
        width: `${mobileSize}px`,
        height: `${mobileSize}px`,
      },
    },
  }),
)

const OptionText = styled.div({
  flex: 1,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: "4px",
})

const OptionTitle = styled.h2(({ theme }) => ({
  ...theme.typography.h4,
  color: theme.custom.colors.darkGray2,
  margin: 0,
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.h5,
    fontSize: theme.typography.pxToRem(20),
    lineHeight: theme.typography.pxToRem(28),
  },
}))

const OptionBody = styled.p(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.custom.colors.silverGrayDark,
  margin: 0,
}))

const OptionButton = styled(ButtonLink)(({ theme }) => ({
  flexShrink: 0,
  width: "174px",
  [theme.breakpoints.down("sm")]: {
    gridColumn: "1 / -1",
    width: "100%",
  },
}))

const Right = styled.figure(({ theme }) => ({
  flex: "468 1 0",
  minWidth: 0,
  position: "relative",
  margin: 0,
  [theme.breakpoints.down("md")]: {
    flex: "none",
    height: "300px",
  },
  [theme.breakpoints.down("sm")]: {
    height: "260px",
  },
}))

const Photo = styled(Image)({
  objectFit: "cover",
})

const Caption = styled.figcaption(({ theme }) => ({
  ...theme.typography.body3,
  fontSize: theme.typography.pxToRem(11),
  position: "absolute",
  right: "16px",
  bottom: "18px",
  padding: "12px 20px",
  backgroundColor: theme.custom.colors.white,
  color: theme.custom.colors.silverGrayDark,
  [theme.breakpoints.down("sm")]: {
    right: "8px",
    bottom: "8px",
    padding: "12px 16px",
  },
}))

type SupportOption = {
  title: string
  body: string
  icon: RemixiconComponentType
  iconColor: "red" | "darkGray2"
  /** Icon size on phones, in px. */
  mobileIconSize: number
  cta: string
  href: string
  highlighted?: boolean
  newTab?: boolean
}

const HeroSection: React.FC = () => {
  const shareStoryUrl = getSupportShareStoryUrl()
  const options: SupportOption[] = [
    {
      title: "Give",
      body: "Support the continued availability of free and open MIT education.",
      icon: RiHeartLine,
      iconColor: "red",
      mobileIconSize: 32,
      cta: "Make a donation",
      href: OPEN_LEARNING_GIVE_URL,
      highlighted: true,
    },
  ]
  if (shareStoryUrl) {
    options.push({
      title: "Share your story",
      body: "Tell us how open learning has made a difference for you.",
      icon: RiTeamLine,
      iconColor: "darkGray2",
      mobileIconSize: 36,
      cta: "Share your story",
      href: shareStoryUrl,
      newTab: true,
    })
  }

  return (
    <HeroBand>
      <Inner>
        <Left>
          <Copy>
            <Title>Support open education.</Title>
            <Subtitle>
              Help keep MIT’s high-quality educational resources available to
              learners everywhere. Your support can take many forms.
            </Subtitle>
          </Copy>
          <Options>
            {options.map(({ icon: Icon, ...option }) => (
              <Option key={option.title} highlighted={option.highlighted}>
                <OptionIcon
                  aria-hidden
                  iconColor={option.iconColor}
                  mobileSize={option.mobileIconSize}
                >
                  <Icon />
                </OptionIcon>
                <OptionText>
                  <OptionTitle>{option.title}</OptionTitle>
                  <OptionBody>{option.body}</OptionBody>
                </OptionText>
                <OptionButton
                  variant={option.highlighted ? "primary" : "secondary"}
                  size="medium"
                  href={option.href}
                  endIcon={<RiArrowRightLine aria-hidden />}
                  {...(option.newTab
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                >
                  {option.cta}
                </OptionButton>
              </Option>
            ))}
          </Options>
        </Left>
        <Right>
          <Photo
            src="/images/support/hero-whiteboard.jpg"
            alt="MIT learners working together at a whiteboard"
            fill
            sizes="(max-width: 900px) 100vw, 468px"
            priority
          />
          <Caption>From the OCW 20-year book of impact</Caption>
        </Right>
      </Inner>
    </HeroBand>
  )
}

export default HeroSection
