import React from "react"
import { Metadata } from "next"
import { standardizeMetadata } from "@/common/metadata"
import GameSubNav from "@/components/GameSubNav/GameSubNav"
import HacksnackClient from "./HacksnackClient"

export const metadata: Metadata = standardizeMetadata({
  title: "Hack Snack",
})

const Page: React.FC = () => {
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY
  return (
    <>
      <GameSubNav title="HackSnack" />
      <HacksnackClient googleMapsApiKey={googleMapsApiKey} />
    </>
  )
}

export default Page
