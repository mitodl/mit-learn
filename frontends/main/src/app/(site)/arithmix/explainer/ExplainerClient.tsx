"use client"

import React from "react"
import ArithmixFlagGate from "../ArithmixFlagGate"

// The mynumbers package accesses `document` at module-evaluation time, so the
// import is deferred to ArithmixFlagGate, which loads it client-side only.
const loadExplainer = () => import("mynumbers").then((mod) => mod.ExplainerPage)

const ExplainerClient: React.FC = () => {
  return <ArithmixFlagGate load={loadExplainer} />
}

export default ExplainerClient
