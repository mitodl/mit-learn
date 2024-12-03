import { PersonaOptions } from "@nlux/react"

export const personas: PersonaOptions = {
  assistant: {
    name: "Tutor Tim",
    avatar: "/images/mit_mascot_tim.png",
    tagline: "What do you want to learn about today?",
  },
  user: {
    name: "Marissa",
    // @ts-expect-error skipping user avatar
    avatar: undefined,
  },
}
