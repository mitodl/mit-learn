"use client"

import React, { useEffect } from "react"
import { ForbiddenError } from "@/common/errors"
import { Permission, userQueries } from "api/hooks/user"
import { redirectLoginToCurrent } from "@/common/utils"
import { useQuery } from "@tanstack/react-query"

type RestrictedRouteProps = {
  children?: React.ReactNode
  requires: Permission
}

/**
 * Use `<RestrictedRoute />` to restrict access to routes based on user. This
 * component can be used in two ways:
 *
 * 1. Restrict a single page by directly wrapping a page component:
 * ```tsx
 * routes = [
 *   {
 *     element: <RestrictedRoute requires={...}> <SomePage /> </RestrictedRoute>
 *     path: "/some/url"
 *   }
 * ]
 * ```
 * 2. Restrict multiple pages by using as a "layout route" grouping child routes
 * ```
 * routes = [
 *   {
 *     element: <RestrictedRoute requires={...} />
 *     children: [
 *        { element: <SomePage />, path: "/some/url" },
 *        { element: <AnotherPage />, path: "/other/url"},
 *     ]
 *   }
 * ]
 * ```
 */
const RestrictedRoute: React.FC<RestrictedRouteProps> = ({
  children,
  requires,
}) => {
  const { isLoading, data: user } = useQuery({
    ...userQueries.me(),
    staleTime: 0, // Force refetch on mount
  })
  const shouldRedirect = !isLoading && !user?.is_authenticated
  useEffect(() => {
    /**
     * Note: If user data exists in query cache, user might see content
     * while refetching fresh user data to verify auth.
     * This is optimistic: since the cached data will almost always be valid
     * and any "secret" data is gated via API auth checks anyway.
     */
    if (shouldRedirect) {
      redirectLoginToCurrent()
    }
  }, [shouldRedirect])
  if (isLoading) return null
  if (shouldRedirect) return null
  if (!isLoading && !user?.[requires]) {
    // This error should be caught by an [`errorElement`](https://reactrouter.com/en/main/route/error-element).
    throw new ForbiddenError("Not allowed.")
  }

  return children
}

export default RestrictedRoute
