import { redirect } from "next/navigation"
import type { AppPageProps } from "@/common/searchParams"

const Page = async (props: AppPageProps<"/news/[slugOrId]/edit">) => {
  const { slugOrId } = await props.params
  redirect(`/website_content/news/${slugOrId}/edit`)
}

export default Page
