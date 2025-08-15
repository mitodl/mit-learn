"use client"
import React from "react"
import { redirect } from "next/navigation"
import { styled, Breadcrumbs, Container, Typography } from "ol-components"
import * as urls from "@/common/urls"
import { useB2BAttachMutation } from "api/mitxonline-hooks/organizations"

type B2BAttachPageProps = {
  code: string
}

const InterstitialMessage = styled(Typography)(({ theme }) => ({
  ...theme.typography.body1,
  textAlign: "center",
}))

const B2BAttachPage: React.FC<B2BAttachPageProps> = ({ code }) => {
  const {
    mutate: attach,
    isSuccess,
    isPending,
  } = useB2BAttachMutation({
    enrollment_code: code,
  })

  React.useEffect(() => {
    attach()
  }, [])

  React.useEffect(() => {
    if (isSuccess) {
      redirect(urls.DASHBOARD_HOME)
    }
  }, [isSuccess])

  return (
    <Container>
      <Breadcrumbs
        variant="light"
        ancestors={[{ href: urls.HOME, label: "Home" }]}
        current="Use Enrollment Code"
      />
      {isPending && (
        <InterstitialMessage>Validating code "{code}"...</InterstitialMessage>
      )}
    </Container>
  )
}

export default B2BAttachPage
