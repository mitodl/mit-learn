import { useQuery } from "@tanstack/react-query"
import { programLetterQueries } from "./queries"

/**
 * Query is disabled if id is undefined.
 */
const useProgramLettersDetail = (id: string | undefined) => {
  return useQuery({
    ...programLetterQueries.detail(id ?? ""),
    enabled: id !== undefined,
  })
}

export { useProgramLettersDetail }
