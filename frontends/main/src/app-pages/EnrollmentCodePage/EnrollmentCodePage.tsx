"use client"
import React from "react"
import { styled, Breadcrumbs, Container, Typography } from "ol-components"
import * as urls from "@/common/urls"
import { useB2BAttachMutation } from "api/mitxonline-hooks/organizations"
import { useMitxOnlineUserMe } from "api/mitxonline-hooks/user"
import { userQueries } from "api/hooks/user"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next-nprogress-bar"

type EnrollmentCodePage = {
  code: string
}

const InterstitialMessage = styled(Typography)(({ theme }) => ({
  ...theme.typography.body1,
  textAlign: "center",
}))

const OrgRedirect: React.FC<{ orgId: number }> = ({ orgId }) => {
  const { data: mitxOnlineUser } = useMitxOnlineUserMe()
  const router = useRouter()
  const orgSlug = mitxOnlineUser?.b2b_organizations?.find(
    (org) => org.id === orgId,
  )?.slug
  React.useEffect(() => {
    if (orgSlug) {
      router.push(urls.organizationView(orgSlug.replace("org-", "")))
    }
  }, [orgSlug, router])
  if (!orgSlug) {
    return (
      <Typography color="error">
        Error: Could not find organization information.
      </Typography>
    )
  }
  return <Typography>Redirecting to organization dashboard...</Typography>
}

const EnrollmentCodePage: React.FC<EnrollmentCodePage> = ({ code }) => {
  const {
    data: contracts,
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
  }, [isSuccess, userLoading, user, code, router])

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
      {isSuccess && contracts?.data && contracts.data.length > 0 && (
        <OrgRedirect orgId={contracts.data[0].organization} />
      )}
    </Container>
  )
}

export default EnrollmentCodePage
