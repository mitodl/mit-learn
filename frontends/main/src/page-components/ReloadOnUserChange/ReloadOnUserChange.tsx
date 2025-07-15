import * as React from "react"
import { useUserMe } from "api/hooks/user"

/**
 * Do a full page reload when user data changes from authenticated:
 *  - authenticated -> authenticated
 *  - authenticated -> different authenticated user
 *
 * => full page reload.
 *
 * This is only relevant if user logs out in another tab or session expires.
 */
const ReloadOnUserChange: React.FC = () => {
  /**
   * NOTE: This could just as well be a hook, but there's no particular
   * component that makes sense to render it.
   *
   * So let's make it a component and render as a direct child of QueryClientProvider.
   */

  const { data: user } = useUserMe()
  const userRef = React.useRef(user)

  // Reload the page when the user changes
  React.useEffect(() => {
    if (userRef.current?.id && user?.id !== userRef.current.id) {
      window.location.reload()
    }
    userRef.current = user
  }, [user])

  return null // This component does not render anything
}

export { ReloadOnUserChange }
