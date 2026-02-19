import React from "react"
import { Typography } from "ol-components"
import { styled } from "@mitodl/smoot-design"
import Image from "next/image"
import { HeadingIds } from "./util"

import IconBookPlay from "@/public/images/product/icon_book_play.png"
import IconBrains from "@/public/images/product/icon_brains.png"
import IconCertificate from "@/public/images/product/icon_certificate.png"
import IconComputerBulb from "@/public/images/product/icon_computer_lightbulb.png"
import IconConnectedPeople from "@/public/images/product/icon_connected_people.png"

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

const HowYoullLearnIcon = styled(Image)({
  width: "80px",
  height: "50px",
  flexShrink: 0,
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

type HowYoullLearnItemData = {
  icon: typeof IconComputerBulb
  title: string
  text: string
}

// Placeholder data — will be replaced by API-driven content.
const DEFAULT_HOW_DATA: HowYoullLearnItemData[] = [
  {
    icon: IconComputerBulb,
    title: "Learn by doing",
    text: "Practice processes and methods through simulations, assessments, case studies, and tools.",
  },
  {
    icon: IconConnectedPeople,
    title: "Learn from others",
    text: "Connect with an international community of professionals while working on projects based on real-world examples.",
  },
  {
    icon: IconBookPlay,
    title: "Learn on demand",
    text: "Access course content online and watch videos at your own pace.",
  },
  {
    icon: IconBrains,
    title: "Reflect and apply",
    text: "Bring new skills to your organization through real-world examples and prompts for reflection.",
  },
  {
    icon: IconCertificate,
    title: "Demonstrate your success",
    text: "Earn a credential from MIT to showcase your achievement.",
  },
  {
    icon: IconConnectedPeople,
    title: "Learn from the best",
    text: "Gain insights from MIT faculty and industry experts.",
  },
]

const HowYoullLearnSection: React.FC<{
  data: HowYoullLearnItemData[]
}> = ({ data }) => {
  return (
    <HowYoullLearnRoot aria-labelledby={HeadingIds.How}>
      <Typography variant="h4" component="h2" id={HeadingIds.How}>
        How you'll learn
      </Typography>
      <HowYoullLearnGrid>
        {data.map((item, index) => (
          <HowYoullLearnItem key={index}>
            <HowYoullLearnHeader>
              <HowYoullLearnIcon
                src={item.icon}
                width={80}
                height={50}
                alt=""
              />
              <HowYoullLearnTitle>{item.title}</HowYoullLearnTitle>
            </HowYoullLearnHeader>
            <HowYoullLearnDescription>{item.text}</HowYoullLearnDescription>
          </HowYoullLearnItem>
        ))}
      </HowYoullLearnGrid>
    </HowYoullLearnRoot>
  )
}

export default HowYoullLearnSection
export { DEFAULT_HOW_DATA }
export type { HowYoullLearnItemData }
