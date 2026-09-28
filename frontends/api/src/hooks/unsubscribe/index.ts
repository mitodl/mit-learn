import { useMutation } from "@tanstack/react-query"
import { unsubscribeApi } from "../../clients"
import type { MutationHookOptions } from "../../mutations/mutationMeta"

const useUnsubscribe = ({ meta }: MutationHookOptions = {}) =>
  useMutation({
    mutationFn: (token: string) =>
      unsubscribeApi.unsubscribeCreate({ token }).then((res) => res.data),
    meta,
  })

export { useUnsubscribe }
