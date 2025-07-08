import React, { useEffect } from "react"
import ErrorPageTemplate from "./ErrorPageTemplate"
import { userQueries } from "api/hooks/user"
import { redirect } from "next/navigation"
import * as urls from "@/common/urls"
import { useQuery } from "@tanstack/react-query"

const ForbiddenPage: React.FC = () => {
  const user = useQuery({
    ...userQueries.me(),
    staleTime: 0, // Force refetch on mount
  })

  const shouldRedirect =
    user.isFetchedAfterMount && !user.data?.is_authenticated

  useEffect(() => {
    if (shouldRedirect) {
      const loginUrl = urls.login()
      redirect(loginUrl)
    }
  }, [shouldRedirect])

  return (
    <ErrorPageTemplate
      // Continue to show loading state while redirecting
      loading={!user.isFetchedAfterMount || shouldRedirect}
      title="You do not have permission to access this resource."
    />
  )
}

export default ForbiddenPage
