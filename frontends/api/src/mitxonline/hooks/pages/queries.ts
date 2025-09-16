import { queryOptions } from "@tanstack/react-query"
import { pagesApi } from "../../clients"

const pagesKeys = {
  root: ["mitxonline", "pages"],
  coursePageDetail: (readableId: string) => [
    ...pagesKeys.root,
    "course_detail",
    readableId,
  ],
}

const pagesQueries = {
  pagesDetail: (readableId: string) =>
    queryOptions({
      queryKey: pagesKeys.coursePageDetail(readableId),
      queryFn: async () => {
        return pagesApi
          .pagesfieldstypecmsCoursePageRetrieve({ readable_id: readableId })
          .then((res) => res.data)
      },
    }),
}

export { pagesQueries, pagesKeys }
