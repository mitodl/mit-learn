import React from "react"
import { Metadata } from "next"
import { standardizeMetadata } from "@/common/metadata"
import GameSubNav from "@/components/GameSubNav/GameSubNav"
import HacksnackClient from "./HacksnackClient"
import HacksnackFlagGate from "./HacksnackFlagGate"
import type { AppPageProps } from "@/common/searchParams"

export const metadata: Metadata = standardizeMetadata({
  title: "Hack Snack",
})

const Page: React.FC<AppPageProps<"/games/hacksnack">> = () => {
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY
  return (
    <HacksnackFlagGate>
      <GameSubNav title="HackSnack" />
      <HacksnackClient googleMapsApiKey={googleMapsApiKey} />
    </HacksnackFlagGate>
  )
}

export default Page
