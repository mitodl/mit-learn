import { redirect } from "next/navigation"
import { websiteContentDraftsView } from "@/common/urls"

const Page = () => {
  redirect(websiteContentDraftsView("article"))
}

export default Page
