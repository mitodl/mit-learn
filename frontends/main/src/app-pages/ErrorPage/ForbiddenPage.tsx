import React, { useEffect } from "react"
import ErrorPageTemplate from "./ErrorPageTemplate"
import { useUserMe } from "api/hooks/user"
import { redirect } from "next/navigation"
import * as urls from "@/common/urls"

const ForbiddenPage: React.FC = () => {
  const { data: user } = useUserMe()

  useEffect(() => {
    if (!user?.is_authenticated) {
      const loginUrl = urls.login()
      redirect(loginUrl)
    }
  }, [user])
  return (
    <ErrorPageTemplate title="You do not have permission to access this resource." />
  )
}

export default ForbiddenPage
