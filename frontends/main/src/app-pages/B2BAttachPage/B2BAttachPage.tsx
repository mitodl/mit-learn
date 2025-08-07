"use client"
import React from "react"
import { Breadcrumbs, Container, Typography } from "ol-components"
import * as urls from "@/common/urls"
import { useB2BAttachMutation } from "api/mitxonline-hooks/organizations"

type B2BAttachPageProps = {
  code: string;
};

const B2BAttachPage: React.FC<B2BAttachPageProps> = ({ code }) => {
  // This is an interstitial. The user sits here until we validate the code,
  // then we toss them to the dashboard.

  const { mutate: attach, isSuccess } = useB2BAttachMutation(code)

  React.useEffect(() => {
    // Trigger the attach mutation when the component mounts
    console.log("attempting to attach code", code)
    attach(code)
  }, [attach, code])

  if (isSuccess) {
    //window.history.replaceState(null, "", urls.DASHBOARD_HOME);
  }

  return (
    <Container>
      <Breadcrumbs
        variant="light"
        ancestors={[{ href: urls.HOME, label: "Home" }]}
        current="Use Enrollment Code"
      />

      <Typography component="h1" variant="h3">
        Please Wait
      </Typography>

      <Typography>
        {isSuccess ? <>Your enrollment code {code} has been validated.</> : <>Please wait while we validate your enrollment code {code}</>}
      </Typography>
    </Container>
  )
}

export default B2BAttachPage
