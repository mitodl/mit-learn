import { redirect } from "next/navigation"

const Page = async (props: { params: Promise<{ slugOrId: string }> }) => {
  const { slugOrId } = await props.params
  redirect(`/website_content/article/${slugOrId}/edit`)
}

export default Page
