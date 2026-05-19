import { redirect } from "next/navigation"

const Page = () => {
  redirect("/website_content/drafts?content_type=article")
}

export default Page
