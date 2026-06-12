"use client"

import React from "react"
import dynamic from "next/dynamic"
import ArithmixFlagGate from "./ArithmixFlagGate"

// The mynumbers package accesses `document` at module-evaluation time, so it
// must be loaded client-side only (no SSR).
const Arithmix = dynamic(
  () => import("mynumbers").then((mod) => mod.Arithmix),
  {
    ssr: false,
  },
)

const ArithmixClient: React.FC = () => {
  return (
    <ArithmixFlagGate>
      <Arithmix basename="/arithmix" />
    </ArithmixFlagGate>
  )
}

export default ArithmixClient
