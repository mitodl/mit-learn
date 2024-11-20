import React from "react"
import { useUsersMe } from "ue-api/hooks/users"
import { redirect } from "react-router-dom";

type EcommerceSessionProps = {
  children: React.ReactNode
}

/**
 * Simple wrapper to standardize the feature flag check for ecommerce UI pages.
 * If the flag is enabled, display the children; if not, throw a ForbiddenError
 * like you'd get for an unauthenticated route.
 *
 * There's a PostHogFeature component that is provided but went this route
 * because it seemed to be inconsistent - sometimes having the flag enabled
 * resulted in it tossing to the error page.
 *
 * Set the feature flag here using the enum, and then make sure it's also
 * defined in commmon/feature_flags too.
 */

const EcommerceSession: React.FC<EcommerceSessionProps> = ({ children }) => {
  const userData = useUsersMe()
  
  if (userData.isError) {
    // Not logged in. We should throw them.. somewhere. But for now we'll just
    // pop a message.

    const myUrl = new URL(window.location.href)

    redirect(`http://ue.odl.local:9080/establish_session/?next=${myUrl.pathname}`)
    return <div>Not logged in. Sending you to ecommerce to login.</div>
  }

  return children
}

export default EcommerceSession
