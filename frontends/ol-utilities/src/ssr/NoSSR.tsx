"use client"

import React, { useState, useEffect, ReactNode, startTransition } from "react"

type NoSSRProps = {
  children: ReactNode
  onSSR?: ReactNode
}

export const NoSSR: React.FC<NoSSRProps> = ({ children, onSSR = null }) => {
  const [isClient, setClient] = useState(false)

  useEffect(() => {
    startTransition(() => {
      setClient(true)
    })
  }, [])

  return isClient ? children : onSSR
}
