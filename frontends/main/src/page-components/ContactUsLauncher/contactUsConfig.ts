import { env } from "@/env"
import type { ContactUsLauncherProps } from "@mitodl/smoot-design/contact-us"

export const isContactUsEnabled = (): boolean =>
  Boolean(env("NEXT_PUBLIC_LEARN_AI_SUPPORT_ENDPOINT"))

export const getContactUsSettings = (
  userEmail?: string,
): ContactUsLauncherProps["settings"] => ({
  chat: {
    apiUrl: env("NEXT_PUBLIC_LEARN_AI_SUPPORT_ENDPOINT")!,
    ...(userEmail ? { requestBody: { user_email: userEmail } } : {}),
  },
})
