import { queryOptions } from "@tanstack/react-query"
import { programLettersApi } from "../../clients"

const programLetterKeys = {
  root: ["programLetters"],
  detailRoot: () => [...programLetterKeys.root, "detail"],
  detail: (id: string) => [...programLetterKeys.detailRoot(), id],
}
const programLetterQueries = {
  detail: (id: string) =>
    queryOptions({
      queryKey: programLetterKeys.detail(id),
      queryFn: () =>
        programLettersApi
          .programLettersRetrieve({ id })
          .then((res) => res.data),
    }),
}

export { programLetterQueries, programLetterKeys }
