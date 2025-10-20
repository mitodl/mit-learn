import React, { useEffect } from "react"
import ErrorPageTemplate from "./ErrorPageTemplate"
import { userQueries } from "api/hooks/user"
import { useQuery } from "@tanstack/react-query"
import { redirectAuthToCurrent } from "@/common/client-utils"

const ForbiddenPage: React.FC = () => {
  const user = useQuery({
    ...userQueries.me(),
    staleTime: 0, // Force refetch on mount
  })

  const shouldRedirect =
    user.isFetchedAfterMount && !user.data?.is_authenticated

  useEffect(() => {
    if (shouldRedirect) {
      redirectAuthToCurrent()
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
