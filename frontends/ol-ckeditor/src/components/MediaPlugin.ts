import type { Editor, Writer, Plugin } from "ckeditor5"

type Alignment = "left" | "center" | "right"

/**
 * ✅ Minimal and type-safe representation of a Plugin class constructor.
 * Matches CKEditor's expectations, avoids leaking internal types.
 */
type SafePluginConstructor = {
  new (editor: Editor): Plugin
  requires?: unknown[]
}

/**
 * Factory that creates a CKEditor plugin allowing media alignment & width control.
 */
export function createMediaFloatPlugin(
  CKEditorModules: typeof import("ckeditor5"),
): SafePluginConstructor {
  const { Plugin, Command, ButtonView, Widget } = CKEditorModules

  class MediaAlignCommand extends Command {
    private readonly alignment: Alignment

    constructor(editor: Editor, alignment: Alignment) {
      super(editor)
      this.alignment = alignment
    }

    override refresh(): void {
      const element = this.editor.model.document.selection.getSelectedElement()
      this.isEnabled = !!element && element.name === "media"
      this.value = element?.getAttribute("alignment") === this.alignment
    }

    override execute(): void {
      const element = this.editor.model.document.selection.getSelectedElement()
      if (!element || element.name !== "media") return

      this.editor.model.change((writer: Writer) => {
        const current = element.getAttribute("alignment") as Alignment | null
        if (current === this.alignment) {
          writer.removeAttribute("alignment", element)
        } else {
          writer.setAttribute("alignment", this.alignment, element)
        }
      })
    }
  }

  class MediaFloatPlugin extends Plugin {
    static get requires() {
      return [Widget]
    }

    init(): void {
      const editor = this.editor

      editor.model.schema.extend("media", {
        allowAttributes: ["alignment", "width"],
      })

      // ✅ Downcast: alignment → CSS class
      editor.conversion.for("downcast").attributeToAttribute({
        model: { name: "media", key: "alignment" },
        view: (value: string) => {
          const classes: Record<Alignment, string> = {
            left: "align-left",
            center: "align-center",
            right: "align-right",
          }
          return { key: "class", value: classes[value as Alignment] }
        },
      })

      // ✅ Downcast: width → style
      editor.conversion.for("downcast").attributeToAttribute({
        model: { name: "media", key: "width" },
        view: (value: string) => ({ key: "style", value: `width:${value};` }),
      })

      // ✅ Downcast: alignment → figure class for <mediaEmbed>
      editor.conversion.for("downcast").attributeToAttribute({
        model: { name: "mediaEmbed", key: "alignment" },
        view: (value: string) => {
          const align = value as Alignment
          if (align === "center") {
            // Instead of just a class, apply an inline style for centering
            return {
              key: "style",
              value: `
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  margin: 0 auto;
                  width: 100%;
                  height: auto;
                `.replace(/\s+/g, " "), // compact
            }
          }

          const classes: Record<Exclude<Alignment, "center">, string> = {
            left: "align-left",
            right: "align-right",
          }

          return { key: "class", value: classes[align] }
        },
      })

      // ✅ Register commands + toolbar buttons
      const alignments: Alignment[] = ["left", "center", "right"]
      for (const align of alignments) {
        const name = `mediaAlign${align[0].toUpperCase()}${align.slice(1)}`
        const command = new MediaAlignCommand(editor, align)
        editor.commands.add(name, command)

        editor.ui.componentFactory.add(name, (locale) => {
          const view = new ButtonView(locale)
          view.set({
            label: `Align ${align}`,
            withText: true,
            tooltip: true,
          })

          // Reactive state bindings
          view.bind("isOn").to(command, "value", (value: unknown) => !!value)
          view.bind("isEnabled").to(command, "isEnabled")

          view.on("execute", () => editor.execute(name))
          return view
        })
      }

      // ✅ Ensure defaults
      editor.model.document.on("change:data", () => {
        const element = editor.model.document.selection.getSelectedElement()
        if (!element || element.name !== "media") return
        editor.model.change((writer) => {
          if (!element.getAttribute("alignment"))
            writer.setAttribute("alignment", "left", element)
          if (!element.getAttribute("width"))
            writer.setAttribute("width", "auto", element)
        })
      })
    }
  }

  // ✅ Type-correct return
  return MediaFloatPlugin as unknown as SafePluginConstructor
}
