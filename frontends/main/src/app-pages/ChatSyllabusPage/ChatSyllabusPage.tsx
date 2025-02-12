"use client"
import React, { useState } from "react"
import { styled, MenuItem, Alert } from "ol-components"
import { FeatureFlags } from "@/common/feature_flags"
import { useFeatureFlagEnabled } from "posthog-js/react"
import StyledContainer from "@/page-components/StyledContainer/StyledContainer"
// eslint-disable-next-line
import { InputLabel, Select } from "@mui/material"
import { AiChat, AiChatProps } from "@mitodl/smoot-design/ai"
import { extractJSONFromComment } from "ol-utilities"
import { getCsrfToken } from "@/common/utils"

const STARTERS: AiChatProps["conversationStarters"] = [
  { content: "What are the prerequisites for this course?" },
  { content: "Does this course include any written assignments?" },
]

const INITIAL_MESSAGES: AiChatProps["initialMessages"] = [
  {
    content:
      "Hello! I'm here to help you with any questions you have about this course.",
    role: "assistant",
  },
]

const FormContainer = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  paddingTop: "40px",
  gap: "40px",
  width: "800px",
  [theme.breakpoints.down("md")]: {
    paddingTop: "24px",
    gap: "32px",
  },
}))

const StyledDebugPre = styled.pre({
  width: "80%",
  whiteSpace: "pre-wrap",
})

const ChatSyllabusPage = () => {
  const botEnabled = useFeatureFlagEnabled(FeatureFlags.RecommendationBot)
  const [readableId, setReadableId] = useState("18.06SC+fall_2011")
  const [collectionName, setCollectionName] = useState("content_files")
  const [debugInfo, setDebugInfo] = useState("")

  return (
    <StyledContainer>
      {botEnabled ? (
        <>
          <form id="chat-form">
            <FormContainer>
              <div>
                <InputLabel>Course</InputLabel>
                <Select
                  label="Course"
                  value={readableId}
                  onChange={(e) => setReadableId(e.target.value)}
                >
                  <MenuItem value="18.06SC+fall_2011">
                    Linear Algebra (OCW)
                  </MenuItem>
                  <MenuItem value="7.01SC+fall_2011">
                    Fundamentals of Biology (OCW)
                  </MenuItem>
                  <MenuItem value="3.091SC+fall_2010">
                    Intro to Solid State Chemistry (OCW)
                  </MenuItem>
                  <MenuItem value="6.01SC+spring_2011">
                    Intro to Electrical Engineering (OCW)
                  </MenuItem>
                  <MenuItem value="MITx+6.00.1x">
                    Intro to Computer Science & Programming Using Python (EdX)
                  </MenuItem>
                  <MenuItem value="MITx+7.00x">
                    Introduction to Biology - The Secret of Life (EdX)
                  </MenuItem>
                  <MenuItem value="course-v1:MITxT+10.50.CH04x">
                    Analysis of Transport Phenomena: Asymptotics (EdX)
                  </MenuItem>
                  <MenuItem value="course-v1:MITxT+18.03.1x">
                    {" "}
                    Introduction to Differential Equations(EdX)
                  </MenuItem>
                </Select>
                <InputLabel>Contentfile Chunk Size</InputLabel>
                <Select
                  label="Contentfile Chunk Size"
                  value={collectionName}
                  onChange={(e) => setCollectionName(e.target.value)}
                >
                  <MenuItem value="content_files">
                    Default (model dependant - 8191 for OpenAI)
                  </MenuItem>
                  <MenuItem value="content_files_512">512</MenuItem>
                  <MenuItem value="content_files_1024">1024</MenuItem>
                </Select>
              </div>
            </FormContainer>
          </form>
          <AiChat
            askTimTitle={`about course ${readableId}`}
            initialMessages={INITIAL_MESSAGES}
            conversationStarters={STARTERS}
            requestOpts={{
              apiUrl: `${process.env.NEXT_PUBLIC_MITOL_API_BASE_URL}/api/v0/syllabus_agent/`,
              fetchOpts: {
                headers: {
                  "X-CSRFToken": getCsrfToken(),
                },
              },
              transformBody: (messages) => {
                return {
                  message: messages[messages.length - 1].content,
                  readable_id: readableId,
                  collection_name: collectionName,
                }
              },
              onFinish: (message) => {
                const contentParts = message.content.split("<!--")
                if (contentParts.length > 1) {
                  setDebugInfo(contentParts[1])
                }
              },
            }}
          />
          {debugInfo &&
            (debugInfo.toString().includes('{"error":') ? (
              <Alert severity="error">
                {extractJSONFromComment(debugInfo)?.error?.message ||
                  "Sorry, an unexpected error occurred."}
              </Alert>
            ) : debugInfo ? (
              <div>
                <p>Debug Info:</p>
                <StyledDebugPre>
                  {debugInfo
                    ? JSON.stringify(
                        extractJSONFromComment(`<!--${debugInfo}`),
                        null,
                        4,
                      )
                    : ""}
                </StyledDebugPre>
              </div>
            ) : null)}
        </>
      ) : (
        <></>
      )}
    </StyledContainer>
  )
}

export default ChatSyllabusPage
