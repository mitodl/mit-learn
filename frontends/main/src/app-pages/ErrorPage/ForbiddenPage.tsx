import React, { useEffect } from "react"
import ErrorPageTemplate from "./ErrorPageTemplate"
import { userQueries } from "api/hooks/user"
import { redirect } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { useLoginToCurrent } from "@/common/utils"

const ForbiddenPage: React.FC = () => {
  const user = useQuery({
    ...userQueries.me(),
    staleTime: 0, // Force refetch on mount
  })

  const shouldRedirect =
    user.isFetchedAfterMount && !user.data?.is_authenticated

  const loginUrl = useLoginToCurrent()
  useEffect(() => {
    if (shouldRedirect) {
      redirect(loginUrl)
    }
  }, [shouldRedirect, loginUrl])

  return (
    <ErrorPageTemplate
      // Continue to show loading state while redirecting
      loading={!user.isFetchedAfterMount || shouldRedirect}
      title="You do not have permission to access this resource."
    />
  )
}

export default ForbiddenPage
