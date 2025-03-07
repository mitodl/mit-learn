import React from "react"
import { styled, RoutedDrawer } from "ol-components"
import { RiCloseLine } from "@remixicon/react"
import { ActionButton } from "@mitodl/smoot-design"
import type { AiChatProps } from "@mitodl/smoot-design/ai"
import AiChatWithEntryScreen from "./AiChatWithEntryScreen"
import { getCsrfToken } from "@/common/utils"
import { RECOMMENDER_QUERY_PARAM } from "@/common/urls"

const CloseButton = styled(ActionButton)(({ theme }) => ({
  position: "absolute",
  top: "24px",
  right: "28px",
  zIndex: 2,
  backgroundColor: theme.custom.colors.lightGray2,
  "&&:hover": {
    backgroundColor: theme.custom.colors.red,
    color: theme.custom.colors.white,
  },
  [theme.breakpoints.down("md")]: {
    right: "24px",
  },
}))

const StyledAiChatWithEntryScreen = styled(AiChatWithEntryScreen)(
  ({ theme }) => ({
    width: "900px",
    [theme.breakpoints.down("md")]: {
      width: "100%",
    },
  }),
)

const INITIAL_MESSAGES: AiChatProps["initialMessages"] = [
  {
    content: "What do you want to learn about today?",
    role: "assistant",
  },
]

const STARTERS = [
  {
    content:
      "I'm interested in courses on quantum computing that offer certificates.",
  },
  {
    content:
      "I want to learn about global warming, can you recommend any videos?",
  },
  {
    content:
      "I would like to learn about linear regression, preferably at no cost.",
  },
]

const DrawerContent: React.FC<{
  onClose?: () => void
}> = ({ onClose }) => {
  return (
    <>
      <CloseButton
        onClick={onClose}
        variant="text"
        size="medium"
        aria-label="Close"
      >
        <RiCloseLine />
      </CloseButton>
      <StyledAiChatWithEntryScreen
        entryTitle="What do you want to learn from MIT?"
        starters={STARTERS}
        askTimTitle="to recommend a course"
        initialMessages={INITIAL_MESSAGES}
        requestOpts={{
          apiUrl: process.env.NEXT_PUBLIC_LEARN_AI_RECOMMENDATION_ENDPOINT!,
          fetchOpts: {
            headers: {
              "X-CSRFToken": getCsrfToken(),
            },
            credentials: "include",
          },
          transformBody: (messages) => ({
            message: messages[messages.length - 1].content,
          }),
        }}
      />
    </>
  )
}

const DRAWER_REQUIRED_PARAMS = [RECOMMENDER_QUERY_PARAM] as const
const AiRecommendationBotDrawer = () => {
  return (
    <RoutedDrawer
      hideCloseButton
      requiredParams={DRAWER_REQUIRED_PARAMS}
      aria-label="What do you want to learn about?"
      anchor="right"
      PaperProps={{
        sx: {
          minWidth: (theme) => ({
            minWidth: "900px",
            [theme.breakpoints.down("md")]: {
              width: "100%",
            },
          }),
        },
      }}
    >
      {({ closeDrawer }) => <DrawerContent onClose={closeDrawer} />}
    </RoutedDrawer>
  )
}

export default AiRecommendationBotDrawer
