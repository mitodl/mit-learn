import { queryOptions } from "@tanstack/react-query"
import {
  // pagesApi,
  axiosInstance,
} from "../../clients"
const pagesKeys = {
  root: ["mitxonline", "pages"],
  coursePageDetail: (readableId: string) => [
    ...pagesKeys.root,
    "course_detail",
    readableId,
  ],
}

const pagesQueries = {
  courseDetail: (readableId: string) =>
    queryOptions({
      queryKey: pagesKeys.coursePageDetail(readableId),
      queryFn: async () => {
        const BASE_PATH =
          process.env.NEXT_PUBLIC_MITX_ONLINE_BASE_URL?.replace(/\/+$/, "") ??
          ""

        const url = `${BASE_PATH}/api/v2/pages/?fields=*&readable_id=${encodeURIComponent(readableId)}&type=cms.CoursePage`

        return axiosInstance.get(url).then((res) => res.data)
        // TODO: When MITxOnline is published, API client will support readable_id param.
        // The API supports it now, just not the client.
        // return pagesApi
        //   .pagesfieldstypecmsCoursePageRetrieve({ readable_id: readableId })
        //   .then((res) => res.data)
      },
    }),
}

export { pagesQueries, pagesKeys }
