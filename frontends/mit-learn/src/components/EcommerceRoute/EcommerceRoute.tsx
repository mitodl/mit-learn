import React from "react"
import { Outlet, useParams } from "react-router"
import { useUsersMe } from "ue-api/hooks/users"
import { ECOMMERCE_LOGIN } from "@/common/ecommerce_urls"

type EcommerceRouteProps = {
  children?: React.ReactNode
}

/**
 * EcommerceRoute is based on RestrictedRoute, but simplified to work with
 * ecommerce. We just care if you have a session in Unified Ecommerce. If you
 * don't, then we'll send you over there to log in.
 */

const generateNextUrl = (system: string | undefined) => {
  return `${ECOMMERCE_LOGIN}?next=${system || ""}` || ECOMMERCE_LOGIN
}

const EcommerceRoute: React.FC<EcommerceRouteProps> = ({ children }) => {
  const { isError, error, isLoading, data: user } = useUsersMe()
  const { system } = useParams()
  const nextUrl = generateNextUrl(system)

  if (isLoading) return null
  if (isError || !user.id) {
    // Redirect unauthenticated users to login
    window.location.assign(nextUrl)
    return (
      <>
        No session, maybe.
        {isError ? <p>Got an error: {error ? <>{error}</> : null}</p> : ""}
        {user ? <p>User ID: {user.id ? user.id : "null"}</p> : ""}
      </>
    )
  }

  /**
   * Rendering an Outlet allows this to be used as a layout route grouping many
   * child routes with the same auth condition.
   */
  return children ? children : <Outlet />
}

export default EcommerceRoute
