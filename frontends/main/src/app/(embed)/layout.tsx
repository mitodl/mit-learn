import React from "react"
import { MITLearnGlobalStyles } from "ol-components"
export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <MITLearnGlobalStyles />
      {children}
    </>
  )
}
