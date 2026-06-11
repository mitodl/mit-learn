"use client"

import React from "react"
import dynamic from "next/dynamic"
import ArithmixFlagGate from "../ArithmixFlagGate"

// The mynumbers package accesses `document` at module-evaluation time, so it
// must be loaded client-side only (no SSR).
const ExplainerPage = dynamic(
  () => import("mynumbers").then((mod) => mod.ExplainerPage),
  { ssr: false },
)

const ExplainerClient: React.FC = () => {
  return (
    <ArithmixFlagGate>
      <ExplainerPage />
    </ArithmixFlagGate>
  )
}

export default ExplainerClient
