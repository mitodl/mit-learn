"use client"

import React from "react"
import dynamic from "next/dynamic"
import ArithmixFlagGate from "./ArithmixFlagGate"
import GameSubNav from "@/components/GameSubNav/GameSubNav"

// The mynumbers package accesses `document` at module-evaluation time, so it
// must be loaded client-side only (no SSR).
const Arithmix = dynamic(
  () => import("@mitodl/arithmix").then((mod) => mod.Arithmix),
  {
    ssr: false,
  },
)

const ArithmixClient: React.FC = () => {
  return (
    <ArithmixFlagGate>
      <GameSubNav title="Arithmix" />
      <Arithmix basename="/games/arithmix" />
    </ArithmixFlagGate>
  )
}

export default ArithmixClient
