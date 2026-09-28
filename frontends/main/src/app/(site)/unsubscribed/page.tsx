import React from "react"
import { Metadata } from "next"
import { UnsubscribedPage } from "@/app-pages/UnsubscribedPage/UnsubscribedPage"
import { standardizeMetadata } from "@/common/metadata"
import type { AppPageProps } from "@/common/searchParams"

export const metadata: Metadata = standardizeMetadata({
  title: "Unsubscribed",
})

const Page = async ({ searchParams }: AppPageProps<"/unsubscribed">) => {
  const { error_code: errorCode } = await searchParams // eslint-disable-line camelcase
  return (
    <UnsubscribedPage
      errorCode={typeof errorCode === "string" ? errorCode : undefined}
    />
  )
}

export default Page
