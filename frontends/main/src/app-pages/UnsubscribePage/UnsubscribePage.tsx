"use client"

import React from "react"
import { Card, Container, Typography, styled } from "ol-components"
import { Button, ButtonLoadingIcon } from "@mitodl/smoot-design"
import { useUnsubscribe } from "api/hooks/unsubscribe"
import { UnsubscribedPage } from "@/app-pages/UnsubscribedPage/UnsubscribedPage"

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

type UnsubscribePageProps = {
  token?: string
}

const UnsubscribePage: React.FC<UnsubscribePageProps> = ({ token }) => {
  const unsubscribe = useUnsubscribe()

  if (!token) {
    return <UnsubscribedPage errorCode="invalid_token" />
  }
  if (unsubscribe.isSuccess) {
    return <UnsubscribedPage />
  }
  if (unsubscribe.isError) {
    return <UnsubscribedPage errorCode="invalid_token" />
  }

  return (
    <PageContainer>
      <CardStyled>
        <Card.Content>
          <CardBody>
            <Typography variant="h3" component="h1">
              Unsubscribe
            </Typography>
            <BodyText variant="body1">
              Are you sure you want to unsubscribe from MIT Learn emails?
            </BodyText>
            <Button
              disabled={unsubscribe.isPending}
              endIcon={
                unsubscribe.isPending ? <ButtonLoadingIcon /> : undefined
              }
              onClick={() => unsubscribe.mutate(token)}
            >
              Yes, unsubscribe me
            </Button>
          </CardBody>
        </Card.Content>
      </CardStyled>
    </PageContainer>
  )
}

export { UnsubscribePage }
