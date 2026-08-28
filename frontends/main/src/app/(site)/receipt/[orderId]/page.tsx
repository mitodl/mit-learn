import type { AppPageProps } from "@/common/searchParams"
import React from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { standardizeMetadata } from "@/common/metadata"
import ReceiptPage from "@/app-pages/ReceiptPage/ReceiptPage"

export const metadata: Metadata = standardizeMetadata({
  title: "Receipt",
  robots: { index: false },
})

/**
 * Fetched client-side: MITx Online's session cookie is not forwarded on
 * server-side requests, so the order cannot be prefetched here.
 */
const Page: React.FC<AppPageProps<"/receipt/[orderId]">> = async ({
  params,
}) => {
  const { orderId } = await params
  const id = Number(orderId)
  if (!Number.isInteger(id) || id <= 0) {
    notFound()
  }

  return <ReceiptPage orderId={id} />
}

export default Page
