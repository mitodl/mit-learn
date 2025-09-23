import { queryOptions } from "@tanstack/react-query"
import {
  // pagesApi,
  axiosInstance,
  pagesApi,
} from "../../clients"
import { CoursePageList } from "@mitodl/mitxonline-api-axios/v2"
const pagesKeys = {
  root: ["mitxonline", "pages"],
  coursePageDetail: (readableId: string) => [
    ...pagesKeys.root,
    "course_detail",
    readableId,
  ],
}

const getPagesDetail = async (readableId: string) => {
  // TODO: When MITxOnline is published, API client will support readable_id param.
  // The API supports it now, just not the client.
  // return pagesApi
  // .pagesfieldstypecmsCoursePageRetrieve({ readable_id: readableId })
  // .then((res) => res.data)
  const todo = (
    ..._params: Parameters<typeof pagesApi.pagesfieldstypecmsCoursePageRetrieve>
  ) => {}
  // @ts-expect-error See above ... This error will trigger when client is updated.
  todo({ readable_id: readableId })

  const BASE_PATH =
    process.env.NEXT_PUBLIC_MITX_ONLINE_BASE_URL?.replace(/\/+$/, "") ?? ""

  const url = `${BASE_PATH}/api/v2/pages/?fields=*&readable_id=${encodeURIComponent(readableId)}&type=cms.CoursePage`
  return axiosInstance.get<CoursePageList>(url)
}

const pagesQueries = {
  courseDetail: (readableId: string) =>
    queryOptions({
      queryKey: pagesKeys.coursePageDetail(readableId),
      queryFn: async () => {
        return getPagesDetail(readableId).then((res) => res.data)
      },
    }),
}

export { pagesQueries, pagesKeys, getPagesDetail }
