import type { SafePluginConstructor } from "./types"
export function createDefaultImageStylePlugin(
  CKEditorModules: typeof import("ckeditor5"),
): SafePluginConstructor {
  const { Plugin } = CKEditorModules

  return class DefaultImageStylePlugin extends Plugin {
    init() {
      const editor = this.editor

      // When image is inserted, apply default width and alignment if not present
      editor.model.document.on("change:data", () => {
        const selection = editor.model.document.selection
        const element = selection.getSelectedElement()
        if (!element || !element.is("element", "imageBlock")) return

        editor.model.change((writer) => {
          if (!element.getAttribute("width")) {
            writer.setAttribute("width", "50", element)
          }

          // Set default alignment (float left)
          if (!element.getAttribute("imageStyle")) {
            writer.setAttribute("imageStyle", "alignLeft", element)
          }
        })
      })
    }
  }
}
