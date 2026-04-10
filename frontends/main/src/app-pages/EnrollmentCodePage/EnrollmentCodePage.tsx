"use client"
import React from "react"
import { styled, Breadcrumbs, Container, Typography } from "ol-components"
import {
  enrollmentAlertSuccessUrl,
  enrollmentAlertErrorUrl,
} from "@/common/mitxonline"
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
  const router = useRouter()

  const enrollment = useB2BAttachMutation({
    enrollment_code: code,
  })

  const { isLoading: userLoading, data: user } = useQuery({
    ...userQueries.me(),
    staleTime: 0,
  })

  React.useEffect(() => {
    if (
      user?.is_authenticated &&
      !enrollment.isPending &&
      !enrollment.isSuccess &&
      !enrollment.isError
    ) {
      enrollment.mutate(undefined, {
        onSuccess: (response) => {
          const contract = response.data[0]

          if (contract) {
            router.push(
              enrollmentAlertSuccessUrl({
                title: contract.name,
                orgId: contract.organization,
              }),
            )
            return
          }

          router.push(urls.DASHBOARD_HOME)
        },
        onError: () => {
          router.push(enrollmentAlertErrorUrl())
        },
      })
    }
  }, [user?.is_authenticated, enrollment, router])

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
