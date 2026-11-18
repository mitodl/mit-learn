"use client"

import React from "react"
import dynamic from "next/dynamic"
import GameSubNav from "@/components/GameSubNav/GameSubNav"

// @mitodl/arithmix reads `window` while rendering, so it must be loaded
// client-side only (no SSR).
const Arithmix = dynamic(
  () => import("@mitodl/arithmix").then((mod) => mod.Arithmix),
  {
    ssr: false,
  },
)

const ArithmixClient: React.FC = () => {
  return (
    <>
      <GameSubNav title="Arithmix" />
      <Arithmix basename="/games/arithmix" />
    </>
  )
}

export default ArithmixClient
