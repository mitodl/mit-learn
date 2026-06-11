"use client"

import React from "react"
import ArithmixFlagGate from "./ArithmixFlagGate"

// The mynumbers package accesses `document` at module-evaluation time, so the
// import is deferred to ArithmixFlagGate, which loads it client-side only.
const loadArithmix = () => import("mynumbers").then((mod) => mod.Arithmix)

const ArithmixClient: React.FC = () => {
  return (
    <ArithmixFlagGate
      load={loadArithmix}
      componentProps={{ basename: "/arithmix" }}
    />
  )
}

export default ArithmixClient
