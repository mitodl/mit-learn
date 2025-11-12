"use client"
import React from "react"
import { styled, Breadcrumbs, Container, Typography } from "ol-components"
import * as urls from "@/common/urls"
import { useB2BAttachMutation } from "api/mitxonline-hooks/organizations"
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

const EnrollmentCodePage: React.FC<EnrollmentCodePage> = ({ code }) => {
  const [hasEnrolled, setHasEnrolled] = React.useState(false)
  const router = useRouter()

  const enrollment = useB2BAttachMutation({
    enrollment_code: code,
  })

  const { isLoading: userLoading, data: user } = useQuery({
    ...userQueries.me(),
    staleTime: 0,
  })

  React.useEffect(() => {
    if (user?.is_authenticated && !hasEnrolled && !enrollment.isPending) {
      setHasEnrolled(true)
      enrollment.mutate()
    }
  }, [user?.is_authenticated, hasEnrolled, enrollment])

  // Handle redirect based on response status code
  // 201: Successfully attached to new contract(s) -> redirect to dashboard
  // 200: Already attached to all contracts -> redirect to dashboard
  // 404: Invalid or expired code -> show error
  React.useEffect(() => {
    if (enrollment.isSuccess) {
      router.push(urls.DASHBOARD_HOME)
    } else if (enrollment.isError) {
      router.push(urls.DASHBOARD_HOME_ENROLLMENT_ERROR)
    }
  }, [enrollment.isSuccess, enrollment.isError, router])

  React.useEffect(() => {
    if (userLoading) {
      return
    }
    if (!user?.is_authenticated) {
      const loginUrlString = urls.auth({
        next: {
          pathname: urls.b2bAttachView(code),
          searchParams: null,
        },
      })
      const loginUrl = new URL(loginUrlString)
      loginUrl.searchParams.set("skip_onboarding", "1")
      router.push(loginUrl.toString())
    }
  }, [userLoading, user, code, router])

  return (
    <Container>
      <Breadcrumbs
        variant="light"
        ancestors={[{ href: urls.HOME, label: "Home" }]}
        current="Use Enrollment Code"
      />
      {enrollment.isPending && (
        <InterstitialMessage>Validating code "{code}"...</InterstitialMessage>
      )}
    </Container>
  )
}

export default EnrollmentCodePage
