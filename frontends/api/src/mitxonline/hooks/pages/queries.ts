import { queryOptions } from "@tanstack/react-query"
import { pagesApi } from "../../clients"

const pagesKeys = {
  root: ["mitxonline", "pages"],
  coursePages: (readableId: string) => [
    ...pagesKeys.root,
    "course_detail",
    readableId,
  ],
  programPages: (readableId: string) => [
    ...pagesKeys.root,
    "program_detail",
    readableId,
  ],
}

const pagesQueries = {
  coursePages: (readableId: string) =>
    queryOptions({
      queryKey: pagesKeys.coursePages(readableId),
      queryFn: async () => {
        return pagesApi
          .pagesfieldstypecmsCoursePageRetrieve({ readable_id: readableId })
          .then((res) => res.data)
      },
    }),
  programPages: (readableId: string) =>
    queryOptions({
      queryKey: pagesKeys.programPages(readableId),
      queryFn: async () => {
        return pagesApi
          .pagesfieldstypecmsProgramPageRetrieve({ readable_id: readableId })
          .then((res) => res.data)
      },
    }),
}

export { pagesQueries, pagesKeys }
