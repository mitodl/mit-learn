import React from "react"
import { VisuallyHidden } from "@mitodl/smoot-design"

const AnnounceContext = React.createContext<(message: string) => void>(() => {})

/**
 * A polite live region that outlives dialogs and navigations within the
 * dashboard, so outcomes can still be announced after the UI that caused them
 * is gone.
 */
const DashboardAnnouncer: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [message, setMessage] = React.useState("")
  return (
    <AnnounceContext.Provider value={setMessage}>
      {children}
      <VisuallyHidden aria-live="polite" aria-atomic="true">
        {message}
      </VisuallyHidden>
    </AnnounceContext.Provider>
  )
}

const useDashboardAnnounce = () => React.useContext(AnnounceContext)

export { DashboardAnnouncer, useDashboardAnnounce }
