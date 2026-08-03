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
 * A receipt is per-learner data behind MITx Online's session cookie, which is not
 * forwarded on server-side requests, so the order is fetched client-side rather
 * than prefetched and hydrated here.
 */
const Page: React.FC<PageProps<"/receipt/[orderId]">> = async ({ params }) => {
  const { orderId } = await params
  const id = Number(orderId)
  if (!Number.isInteger(id) || id <= 0) {
    notFound()
  }

  return <ReceiptPage orderId={id} />
}

export default Page
