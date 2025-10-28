import type { Editor, Plugin } from "ckeditor5"
export type SafePluginConstructor = {
  new (editor: Editor): Plugin
  requires?: unknown[]
}

export interface Course {
  id: string
  title: string
  image: string
  description: string
}
