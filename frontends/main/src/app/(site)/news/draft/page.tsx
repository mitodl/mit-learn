import { redirect } from "next/navigation"

const Page = () => {
  redirect("/website_content/drafts?content_type=news")
}

export default Page
