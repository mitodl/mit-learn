"use client"
import React from "react"
import { styled, Breadcrumbs, Container, Typography } from "ol-components"
import * as urls from "@/common/urls"
import { useB2BAttachMutation } from "api/mitxonline-hooks/organizations"

type B2BAttachPageProps = {
  code: string;
};

const InterstitialMessage = styled(Typography)(({ theme }) => ({
  ...theme.typography.body1,
  textAlign: "center",
}))

const B2BAttachPage: React.FC<B2BAttachPageProps> = ({ code }) => {
  const { mutate: attach, isSuccess } = useB2BAttachMutation(code)

  React.useEffect(() => attach(code), [attach, code])

  if (isSuccess) {
    window.history.replaceState(null, "", urls.DASHBOARD_HOME);
  }

  return (
    <Container>
      <Breadcrumbs
        variant="light"
        ancestors={[{ href: urls.HOME, label: "Home" }]}
        current="Use Enrollment Code"
      />

      <InterstitialMessage>
        Validating code "{code}"... 
      </InterstitialMessage>
    </Container>
  )
}

export default B2BAttachPage
