"use client"

import React from "react"
import dynamic from "next/dynamic"

const HackSnackGame = dynamic(
  () => import("@mitodl/hacksnack").then((mod) => mod.HackSnackGame),
  {
    ssr: false,
  },
)

interface HacksnackClientProps {
  googleMapsApiKey?: string
}

const HacksnackClient: React.FC<HacksnackClientProps> = ({
  googleMapsApiKey,
}) => {
  return <HackSnackGame googleMapsApiKey={googleMapsApiKey} />
}

export default HacksnackClient
