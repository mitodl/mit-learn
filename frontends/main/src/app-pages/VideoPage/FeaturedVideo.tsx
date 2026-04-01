import React from "react"
import Image from "next/image"
import { Container, Typography, styled } from "ol-components"
import { RiPlayFill } from "@remixicon/react"
import type { VideoResource, LearningResourceTopic } from "api/v1"

const FeaturedSection = styled.button({
  cursor: "pointer",
  borderRadius: "6px",
  overflow: "hidden",
  display: "block",
  width: "100%",
  background: "none",
  border: "none",
  padding: 0,
  textAlign: "left",
})

const FeaturedImageWrapper = styled.div(({ theme }) => ({
  position: "relative",
  width: "100%",
  paddingTop: "52%",
  overflow: "hidden",
  backgroundColor: "#111",
  [theme.breakpoints.down("sm")]: {
    paddingTop: "80%",
  },
}))

const FeaturedGradient = styled.div({
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
  background:
    "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.55) 35%, rgba(0,0,0,0.10) 65%, transparent 100%)",
})

const FeaturedOverlayContent = styled.div(({ theme }) => ({
  position: "absolute",
  bottom: 0,
  left: 0,
  right: 0,
  padding: "28px 24px",
  [theme.breakpoints.down("sm")]: {
    padding: "16px",
  },
}))

const FeaturedPlayRow = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "10px",
  marginBottom: "8px",
  [theme.breakpoints.down("sm")]: {
    marginBottom: "4px",
  },
}))

const FeaturedPlayBtn = styled.div({
  width: 44,
  height: 44,
  borderRadius: "6px",
  backgroundColor: "#A31F34",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#fff",
  flexShrink: 0,
  svg: { width: 18, height: 18 },
})

const FeaturedInterviewLabel = styled(Typography)(({ theme }) => ({
  textTransform: "uppercase",
  ...theme.typography.body4,
  letterSpacing: "0.12em",
  color: "rgba(255,255,255,0.75)",
  fontWeight: theme.typography.fontWeightMedium,
  marginBottom: "4px",
  display: "block",
}))

const FeaturedTitle = styled(Typography)(({ theme }) => ({
  ...theme.typography.h5,
  color: "#fff",
  fontWeight: theme.typography.fontWeightBold,
  lineHeight: 1.2,
  [theme.breakpoints.down("sm")]: {
    fontSize: "1rem",
  },
}))

const FeaturedInfoStrip = styled.div(({ theme }) => ({
  backgroundColor: "transparent",
  borderTop: "1px solid rgba(255,255,255,0.20)",
  marginTop: "16px",
  paddingTop: "14px",
  [theme.breakpoints.down("sm")]: {
    marginTop: "10px",
    paddingTop: "10px",
  },
}))

const FeaturedInfoInner = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "flex-start",
  gap: "48px",
  flexWrap: "wrap",
  [theme.breakpoints.down("sm")]: {
    gap: "12px",
  },
}))

const FeaturedInfoItem = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "3px",
})

const FeaturedInfoLabel = styled(Typography)(({ theme }) => ({
  ...theme.typography.body4,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "rgba(255,255,255,0.5)",
  fontWeight: theme.typography.fontWeightMedium,
}))

const FeaturedInfoValue = styled(Typography)(({ theme }) => ({
  ...theme.typography.body2,
  color: "#fff",
  fontWeight: theme.typography.fontWeightBold,
}))

const FeaturedInfoValueContainer = styled.div({
  display: "flex",
})

const FeaturedInfoTags = styled.div(({ theme }) => ({
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
  marginLeft: "auto",
  [theme.breakpoints.down("sm")]: { marginLeft: 0 },
}))

const FeaturedInfoTag = styled.span(({ theme }) => ({
  display: "inline-block",
  border: "1px solid rgba(255,255,255,0.40)",
  color: "#fff",
  ...theme.typography.body3,
  padding: "4px 10px",
  borderRadius: "4px",
  backgroundColor: "transparent",
}))

type FeaturedVideoProps = {
  video: VideoResource
  onPlay: (video: VideoResource) => void
}

const FeaturedVideo: React.FC<FeaturedVideoProps> = ({ video, onPlay }) => {
  const imageUrl = video.image?.url ?? null
  const topics: LearningResourceTopic[] = video.topics?.slice(0, 4) ?? []

  return (
    <div style={{ padding: "24px 0 0" }}>
      <Container>
        <FeaturedSection type="button" onClick={() => onPlay(video)}>
          <FeaturedImageWrapper>
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={video.title}
                fill
                sizes="100vw"
                style={{ objectFit: "cover", opacity: 0.85 }}
              />
            ) : (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundColor: "#1a1a2e",
                }}
              />
            )}
            <FeaturedGradient />
            <FeaturedOverlayContent>
              <FeaturedPlayRow>
                <FeaturedPlayBtn>
                  <RiPlayFill />
                </FeaturedPlayBtn>
                <div>
                  <FeaturedInterviewLabel>
                    Featured Interview
                  </FeaturedInterviewLabel>
                  <FeaturedTitle>{video.title}</FeaturedTitle>
                </div>
              </FeaturedPlayRow>

              <FeaturedInfoStrip>
                <FeaturedInfoInner>
                  <FeaturedInfoItem>
                    <FeaturedInfoLabel>Topics</FeaturedInfoLabel>
                    <FeaturedInfoValueContainer>
                      {topics.map((topic: LearningResourceTopic) => (
                        <FeaturedInfoValue key={topic.id}>
                          {topic.name}
                        </FeaturedInfoValue>
                      ))}
                    </FeaturedInfoValueContainer>
                  </FeaturedInfoItem>
                  {topics.length > 0 && (
                    <FeaturedInfoTags>
                      <FeaturedInfoTag>Governance</FeaturedInfoTag>
                      <FeaturedInfoTag>AI Ethics</FeaturedInfoTag>
                    </FeaturedInfoTags>
                  )}
                </FeaturedInfoInner>
              </FeaturedInfoStrip>
            </FeaturedOverlayContent>
          </FeaturedImageWrapper>
        </FeaturedSection>
      </Container>
    </div>
  )
}

export default FeaturedVideo
