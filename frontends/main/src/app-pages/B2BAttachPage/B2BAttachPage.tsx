"use client"
import React from "react"
import { redirect } from "next/navigation"
import { styled, Breadcrumbs, Container, Typography } from "ol-components"
import * as urls from "@/common/urls"
import { useB2BAttachMutation } from "api/mitxonline-hooks/organizations"
import { useMitxOnlineCurrentUser } from "api/mitxonline-hooks/user"
import { userQueries } from "api/hooks/user"
import { useQuery } from "@tanstack/react-query"

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

  const { isLoading: userLoading, data: user } = useQuery({
    ...userQueries.me(),
    staleTime: 0,
  })
  const { data: mitxOnlineUser } = useMitxOnlineCurrentUser()

  React.useEffect(() => {
    attach?.()
  }, [attach])

  React.useEffect(() => {
    if (userLoading) {
      return
    }
    if (!user?.is_authenticated) {
      const loginUrl = urls.login({
        pathname: urls.b2bAttachView(code),
        searchParams: new URLSearchParams({ skip_onboarding: "1" }),
      })
      redirect(loginUrl)
    }
    if (isSuccess) {
      const orgs = mitxOnlineUser?.b2b_organizations || []
      if (orgs.length > 0) {
        const org = orgs[0]
        redirect(urls.organizationView(org.slug.replace("org-", "")))
      }
    }
  }, [isSuccess, userLoading, user, mitxOnlineUser, code])

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
