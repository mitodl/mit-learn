"use client"
import React from "react"
import { styled, Breadcrumbs, Container, Typography } from "ol-components"
import * as urls from "@/common/urls"
import { useB2BAttachMutation } from "api/mitxonline-hooks/organizations"
import { userQueries } from "api/hooks/user"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next-nprogress-bar"
import { mitxUserQueries } from "api/mitxonline-hooks/user"

type EnrollmentCodePage = {
  code: string
}

const InterstitialMessage = styled(Typography)(({ theme }) => ({
  ...theme.typography.body1,
  textAlign: "center",
}))

const EnrollmentCodePage: React.FC<EnrollmentCodePage> = ({ code }) => {
  const mitxOnlineUser = useQuery(mitxUserQueries.me())
  const initialOrgsRef = React.useRef<number | null>(null)
  const [hasEnrolled, setHasEnrolled] = React.useState(false)

  // Capture initial organization count once
  if (
    initialOrgsRef.current === null &&
    mitxOnlineUser.data?.b2b_organizations
  ) {
    initialOrgsRef.current = mitxOnlineUser.data.b2b_organizations.length
  }

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

  // Handle redirect after mutation succeeds and query is refetched
  React.useEffect(() => {
    if (enrollment.isSuccess && !enrollment.isPending) {
      const currentOrgCount =
        mitxOnlineUser.data?.b2b_organizations?.length ?? 0
      if (initialOrgsRef.current === currentOrgCount) {
        router.push(urls.DASHBOARD_HOME_ENROLLMENT_ERROR)
      } else {
        router.push(urls.DASHBOARD_HOME)
      }
    }
  }, [
    enrollment.isSuccess,
    enrollment.isPending,
    mitxOnlineUser.data?.b2b_organizations?.length,
    router,
  ])

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
