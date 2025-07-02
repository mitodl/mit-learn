import React from "react"
import { Typography, styled } from "ol-components"
import { ButtonLink } from "@mitodl/smoot-design"
import { HOME } from "@/common/urls"
import Image from "next/image"
import backgroundImage from "@/public/images/backgrounds/error_page_background.svg"
import timImage from "@/public/images/tim_three_quarter_half.svg"
import timSpeechBubble from "@/public/images/tim_speech_bubble.svg"

type ErrorPageTemplateProps = {
  title: string
  timSays?: string
}

const Page = styled.div(({ theme }) => ({
  backgroundImage: `url(${backgroundImage.src})`,
  backgroundAttachment: "fixed",
  backgroundRepeat: "no-repeat",
  backgroundSize: "contain",
  flexGrow: 1,
  height: "100%",
  [theme.breakpoints.down("sm")]: {
    backgroundImage: "none",
  },
}))

const ErrorContainer = styled.div(({ theme }) => ({
  padding: "56px 0",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "32px",
  [theme.breakpoints.down("sm")]: {
    gap: "24px",
    padding: "48px 0 40px 0",
  },
}))

const ImageContainer = styled.div({
  width: "367px",
  height: "307px",
  position: "relative",
  margin: "0 auto",
})

const TimImage = styled(Image)({
  width: "276px",
  height: "auto",
  position: "absolute",
  bottom: "0",
  right: "0",
})

const TimSpeechImage = styled(Image)({
  width: "169px",
  height: "auto",
  position: "absolute",
  top: "2px",
  left: "0",
})

const TimSays = styled(Typography)(({ theme }) => ({
  ...theme.typography.h2,
  position: "absolute",
  top: "19px",
  left: "0",
  fontStyle: "italic",
  width: "151px",
  textAlign: "center",
}))

const Footer = styled.div(({ theme }) => ({
  [theme.breakpoints.down("sm")]: {
    marginTop: "8px",
  },
}))

const Button = styled(ButtonLink)({
  minWidth: "200px",
})

const ErrorPageTemplate: React.FC<ErrorPageTemplateProps> = ({
  title,
  timSays,
}) => {
  return (
    <Page>
      <ErrorContainer>
        <ImageContainer>
          <TimSpeechImage src={timSpeechBubble} alt="" />
          <TimSays>{timSays || "Oops!"}</TimSays>
          <TimImage src={timImage} alt="" />
        </ImageContainer>
        <Typography
          component="h1"
          variant="h3"
          sx={{ textAlign: "center", margin: "0 30px" }}
        >
          {title}
        </Typography>
        <Footer>
          <Button variant="primary" href={HOME}>
            Home
          </Button>
        </Footer>
      </ErrorContainer>
    </Page>
  )
}

export default ErrorPageTemplate
