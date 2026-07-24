"use client"

import React from "react"
import { Card, Container, Typography, styled } from "ol-components"
import { ButtonLink } from "@mitodl/smoot-design"
import * as urls from "@/common/urls"

const PageContainer = styled(Container)({
  paddingTop: "40px",
  paddingBottom: "80px",
})

const CardStyled = styled(Card)({
  maxWidth: "600px",
  margin: "0 auto",
})

const CardBody = styled.div({
  padding: "32px",
})

const BodyText = styled(Typography)({
  padding: "24px 0",
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
        <CardStyled>
          <Card.Content>
            <CardBody>
              <Typography variant="h3" component="h1">
                Unable to Unsubscribe
              </Typography>
              <BodyText variant="body1">
                Unable to unsubscribe you with that link, login to unsubscribe
                manually.
              </BodyText>
              <ButtonLink href={loginUrl}>Log in</ButtonLink>
            </CardBody>
          </Card.Content>
        </CardStyled>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <CardStyled>
        <Card.Content>
          <CardBody>
            <Typography variant="h3" component="h1">
              Unsubscribed
            </Typography>
            <BodyText variant="body1">
              You have successfully unsubscribed from MIT Learn.
            </BodyText>
          </CardBody>
        </Card.Content>
      </CardStyled>
    </PageContainer>
  )
}

export { UnsubscribedPage }
