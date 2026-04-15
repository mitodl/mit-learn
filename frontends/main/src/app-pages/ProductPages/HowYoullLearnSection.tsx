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

const HowYoullLearnIcon = styled(Image)({
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

// These fields come from the CMS page types. Once @mitodl/mitxonline-api-axios
// is published with these fields, this can be replaced with:
// Extract<keyof CoursePageItem & keyof ProgramPageItem, `hyl_choice_${string}`>
type HylChoiceKey =
  | "hyl_choice_realworld_learning"
  | "hyl_choice_learn_by_doing"
  | "hyl_choice_learn_from_others"
  | "hyl_choice_learn_on_demand"
  | "hyl_choice_ai_enabled_support"
  | "hyl_choice_stackable_credentials"

type HowYoullLearnItemData = {
  icon: typeof IconComputerBulb
  title: string
  text: string
}
type HowYoullLearnOption = {
  name: HylChoiceKey
  data: HowYoullLearnItemData
}

const HOW_YOULL_LEARN_OPTIONS: HowYoullLearnOption[] = [
  {
    name: "hyl_choice_realworld_learning",
    data: {
      icon: IconConnectedPeople,
      title: "Real-World Learning",
      text: "Learn from MIT faculty and experts who ground their teaching in real-world cases rather than mathematical models, making the material approachable for all.",
    },
  },
  {
    name: "hyl_choice_learn_by_doing",
    data: {
      icon: IconBrains,
      title: "Practical Application",
      text: "Apply your new knowledge with hands-on, practical exercises drawn from healthcare, sports, finance, sustainability, and more.",
    },
  },
  {
    name: "hyl_choice_learn_from_others",
    data: {
      icon: IconBrains,
      title: "Learn From Others",
      text: "Connect with an international community of professionals working on real-world projects.",
    },
  },
  {
    name: "hyl_choice_learn_on_demand",
    data: {
      icon: IconBrains,
      title: "Learn On Demand",
      text: "Access all course content online with complete flexibility to study at your own pace.",
    },
  },
  {
    name: "hyl_choice_ai_enabled_support",
    data: {
      icon: IconComputerBulb,
      title: "AI-Enabled Support",
      text: "Deepen your understanding of the course material and get help on assignments from AskTIM, the AI assistant built by MIT researchers.",
    },
  },
  {
    name: "hyl_choice_stackable_credentials",
    data: {
      icon: IconCertificate,
      title: "Stackable Credentials",
      text: "Earn an MIT Open Learning certificate at each milestone—module, course, and program—demonstrating your AI expertise. Available in paid courses only.",
    },
  },
]

const HowYoullLearnSection: React.FC<{
  page: CoursePageItem | ProgramPageItem
}> = ({ page }) => {
  const filteredOptions = HOW_YOULL_LEARN_OPTIONS.filter(
    (option) => (page as Record<HylChoiceKey, boolean>)[option.name],
  )
  return filteredOptions.length > 0 ? (
    <HowYoullLearnRoot aria-labelledby={HeadingIds.How}>
      <Typography variant="h4" component="h2" id={HeadingIds.How}>
        How you'll learn
      </Typography>
      <HowYoullLearnGrid>
        {filteredOptions.map((option) => (
          <HowYoullLearnItem key={option.name}>
            <HowYoullLearnHeader>
              <HowYoullLearnIcon
                src={option.data.icon}
                width={80}
                height={50}
                alt=""
              />
              <HowYoullLearnTitle>{option.data.title}</HowYoullLearnTitle>
            </HowYoullLearnHeader>
            <HowYoullLearnDescription>
              {option.data.text}
            </HowYoullLearnDescription>
          </HowYoullLearnItem>
        ))}
      </HowYoullLearnGrid>
    </HowYoullLearnRoot>
  ) : null
}

export default HowYoullLearnSection
export type { HowYoullLearnItemData }
