"use client"

import React from "react"
import { Container, Typography, styled } from "ol-components"
import { Button, ButtonLoadingIcon } from "@mitodl/smoot-design"
import { useUnsubscribe } from "api/hooks/unsubscribe"
import { UnsubscribedPage } from "@/app-pages/UnsubscribedPage/UnsubscribedPage"

const PageContainer = styled(Container)({
  paddingTop: "40px",
  paddingBottom: "80px",
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
      <Typography variant="h3" component="h1" gutterBottom>
        Unsubscribe from MIT Learn emails?
      </Typography>
      <Typography variant="body1" gutterBottom>
        Are you sure you want to unsubscribe from MIT Learn emails?
      </Typography>
      <Button
        disabled={unsubscribe.isPending}
        endIcon={unsubscribe.isPending ? <ButtonLoadingIcon /> : undefined}
        onClick={() => unsubscribe.mutate(token)}
      >
        Confirm unsubscribe
      </Button>
    </PageContainer>
  )
}

export { UnsubscribePage }
