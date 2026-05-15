"use client"

import React from "react"
import { ErrorContent } from "@/app-pages/ErrorPage/ErrorPageTemplate"
import { styled } from "ol-components"
import backgroundImage from "@/public/images/backgrounds/error_page_background.svg"

const Page = styled.div(({ theme }) => ({
  backgroundImage: `url(${backgroundImage.src})`,
  backgroundAttachment: "fixed",
  backgroundRepeat: "no-repeat",
  backgroundSize: "contain",
  flexGrow: 1,
  height: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  [theme.breakpoints.down("sm")]: {
    backgroundImage: "none",
  },
}))

const EmbedNotFoundPage: React.FC = () => {
  return (
    <Page>
      <ErrorContent
        title="Looks like we couldn't find what you were looking for!"
        timSays="404"
        showHomeButton={false}
      />
    </Page>
  )
}

export default EmbedNotFoundPage
