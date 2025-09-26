"use client"
import React from "react"
import { styled, Breadcrumbs, Container, Typography } from "ol-components"
import * as urls from "@/common/urls"
import { useB2BAttachMutation } from "api/mitxonline-hooks/organizations"
import { useMitxOnlineCurrentUser } from "api/mitxonline-hooks/user"
import { userQueries } from "api/hooks/user"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next-nprogress-bar"

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
  const router = useRouter()

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
      const loginUrlString = urls.auth({
        loginNext: {
          pathname: urls.b2bAttachView(code),
          searchParams: null,
        },
        // On signup, redirect to the attach page so attachment can occur.
        signupNext: {
          pathname: urls.b2bAttachView(code),
          searchParams: null,
        },
      })
      const loginUrl = new URL(loginUrlString)
      loginUrl.searchParams.set("skip_onboarding", "1")
      router.push(loginUrl.toString())
    }
    if (isSuccess) {
      const org = mitxOnlineUser?.b2b_organizations?.[0]
      if (org) {
        router.push(urls.organizationView(org.slug.replace("org-", "")))
      }
    }
  }, [isSuccess, userLoading, user, mitxOnlineUser, code, router])

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
