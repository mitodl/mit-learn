"use client"

import React from "react"
import { Container, Typography, styled } from "ol-components"
import { ButtonLink } from "@mitodl/smoot-design"
import * as urls from "@/common/urls"

const PageContainer = styled(Container)({
  paddingTop: "40px",
  paddingBottom: "80px",
})

type UnsubscribedPageProps = {
  errorCode?: string
}

const UnsubscribedPage: React.FC<UnsubscribedPageProps> = ({ errorCode }) => {
  if (errorCode) {
    const loginUrl = urls.auth({
      next: { pathname: urls.SETTINGS, searchParams: null },
    })
    return (
      <PageContainer>
        <Typography variant="h3" component="h1" gutterBottom>
          Unable to Unsubscribe
        </Typography>
        <Typography variant="body1" gutterBottom>
          Unable to unsubscribe you with that link, login to unsubscribe
          manually.
        </Typography>
        <ButtonLink href={loginUrl}>Log in</ButtonLink>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <Typography variant="h3" component="h1" gutterBottom>
        Unsubscribed
      </Typography>
      <Typography variant="body1">
        You have successfully unsubscribed from MIT Learn.
      </Typography>
    </PageContainer>
  )
}

export { UnsubscribedPage }
