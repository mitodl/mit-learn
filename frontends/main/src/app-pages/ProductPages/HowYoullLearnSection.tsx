import React from "react"
import { Typography } from "ol-components"
import { styled } from "@mitodl/smoot-design"
import Image from "next/image"
import { HeadingIds } from "./util"

import IconBrains from "@/public/images/product/icon_brains.png"
import IconCertificate from "@/public/images/product/icon_certificate.png"
import IconComputerBulb from "@/public/images/product/icon_computer_lightbulb.png"
import IconConnectedPeople from "@/public/images/product/icon_connected_people.png"

import type {
  CoursePageItem,
  ProgramPageItem,
} from "@mitodl/mitxonline-api-axios/v2"

const HowYoullLearnRoot = styled.section(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "32px",
  [theme.breakpoints.down("md")]: {
    gap: "24px",
  },
}))

const HowYoullLearnGrid = styled.ul(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "32px 56px",
  listStyle: "none",
  padding: 0,
  margin: 0,
  [theme.breakpoints.down("md")]: {
    gap: "16px",
  },
  [theme.breakpoints.down("sm")]: {
    gridTemplateColumns: "1fr",
    gap: "24px",
  },
}))

const HowYoullLearnItem = styled.li(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  borderRadius: "4px",
  padding: "24px",
}))

const HowYoullLearnHeader = styled.div({
  display: "flex",
  gap: "16px",
  alignItems: "center",
})

const HowYoullLearnIconImage = styled(Image)({
  width: "80px",
  height: "50px",
  flexShrink: 0,
  objectFit: "contain",
})

const HowYoullLearnTitle = styled.strong(({ theme }) => ({
  ...theme.typography.subtitle1,
}))

const HowYoullLearnDescription = styled.p(({ theme }) => ({
  ...theme.typography.body1,
  lineHeight: "1.5",
  margin: 0,
  [theme.breakpoints.down("md")]: {
    ...theme.typography.body2,
  },
}))

const HowYoullLearnIcon: React.FC<{
  src: string
  width: number
  height: number
  alt: string
}> = ({ src, width, height, alt }) => {
  let iconSrc: typeof IconBrains | null = null
  switch (src) {
    case "IconBrains":
      iconSrc = IconBrains
      break
    case "IconCertificate":
      iconSrc = IconCertificate
      break
    case "IconComputerBulb":
      iconSrc = IconComputerBulb
      break
    case "IconConnectedPeople":
      iconSrc = IconConnectedPeople
      break
    default:
      console.warn(`Unknown how_youll_learn icon: ${src}`)
  }

  return (
    iconSrc && (
      <HowYoullLearnIconImage
        src={iconSrc}
        width={width}
        height={height}
        alt={alt}
      />
    )
  )
}

const HowYoullLearnSection: React.FC<{
  page: CoursePageItem | ProgramPageItem
}> = ({ page }) => {
  const filteredOptions = page.how_youll_learn ?? []

  return filteredOptions.length > 0 ? (
    <HowYoullLearnRoot aria-labelledby={HeadingIds.How}>
      <Typography variant="h4" component="h2" id={HeadingIds.How}>
        How you'll learn
      </Typography>
      <HowYoullLearnGrid>
        {filteredOptions.map((option) => (
          <HowYoullLearnItem key={option.key}>
            <HowYoullLearnHeader>
              <HowYoullLearnIcon
                src={option.icon}
                width={80}
                height={50}
                alt=""
              />
              <HowYoullLearnTitle>{option.title}</HowYoullLearnTitle>
            </HowYoullLearnHeader>
            <HowYoullLearnDescription>{option.text}</HowYoullLearnDescription>
          </HowYoullLearnItem>
        ))}
      </HowYoullLearnGrid>
    </HowYoullLearnRoot>
  ) : null
}

export default HowYoullLearnSection
