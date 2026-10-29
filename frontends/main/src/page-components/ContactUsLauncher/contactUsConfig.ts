import { env } from "@/env"
import type { ContactUsLauncherProps } from "@mitodl/smoot-design/contact-us"

export const isContactUsEnabled = (): boolean =>
  Boolean(env("NEXT_PUBLIC_LEARN_AI_SUPPORT_ENDPOINT"))

export const getContactUsSettings = (
  requester: { email?: string; name?: string; username?: string } = {},
): ContactUsLauncherProps["settings"] => {
  const requestBody = {
    ...(requester.email ? { user_email: requester.email } : {}),
    ...(requester.name ? { user_name: requester.name } : {}),
    ...(requester.username ? { user_username: requester.username } : {}),
  }
  return {
    chat: {
      apiUrl: env("NEXT_PUBLIC_LEARN_AI_SUPPORT_ENDPOINT")!,
      ...(Object.keys(requestBody).length > 0 ? { requestBody } : {}),
    },
  }
}
