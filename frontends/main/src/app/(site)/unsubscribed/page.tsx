import React from "react"
import { Metadata } from "next"
import { UnsubscribedPage } from "@/app-pages/UnsubscribedPage/UnsubscribedPage"
import { standardizeMetadata } from "@/common/metadata"

export const metadata: Metadata = standardizeMetadata({
  title: "Unsubscribed",
})

const Page = async ({
  searchParams,
}: {
  searchParams: Promise<{ error_code?: string }>
}) => {
  const { error_code: errorCode } = await searchParams // eslint-disable-line camelcase
  return <UnsubscribedPage errorCode={errorCode} />
}

export default Page
