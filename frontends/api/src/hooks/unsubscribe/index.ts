import { useMutation } from "@tanstack/react-query"
import { unsubscribeApi } from "../../clients"

const useUnsubscribe = () =>
  useMutation({
    mutationFn: (token: string) =>
      unsubscribeApi.unsubscribeCreate({ token }).then((res) => res.data),
  })

export { useUnsubscribe }
