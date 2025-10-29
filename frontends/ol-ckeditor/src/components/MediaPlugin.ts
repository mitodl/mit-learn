import type {
  Editor,
  Writer,
  Plugin,
  DowncastConversionApi,
  DowncastDispatcher,
} from "ckeditor5"
import type { Element as ModelElement } from "@ckeditor/ckeditor5-engine"

function isModelElement(item: unknown): item is ModelElement {
  return (
    typeof item === "object" &&
    item !== null &&
    "name" in item &&
    typeof (item as { name: unknown }).name === "string"
  )
}

type Alignment = "left" | "center" | "right"

type SafePluginConstructor = {
  new (editor: Editor): Plugin
  requires?: unknown[]
}

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
      const valid =
        element && (element.name === "media" || element.name === "mediaEmbed")
      this.isEnabled = !!valid
      this.value =
        valid && element?.getAttribute("alignment") === this.alignment
    }

    override execute(): void {
      const selection = this.editor.model.document.selection
      const element =
        selection.getSelectedElement() || selection.getFirstPosition()?.parent

      const name = element?.name
      if (!name || !["media", "mediaEmbed"].includes(name)) {
        console.warn("Not a media element, skipping")
        return
      }

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

      // ✅ Typed downcast event handler
      for (const modelName of ["media", "mediaEmbed"]) {
        editor.conversion
          .for("downcast")
          .add((dispatcher: DowncastDispatcher) => {
            dispatcher.on(
              "attribute:alignment",
              (
                _evt: unknown,
                data: {
                  item: unknown
                  attributeKey: string
                  attributeNewValue: string | null
                  attributeOldValue: string | null
                },
                conversionApi: DowncastConversionApi,
              ) => {
                const { writer, mapper } = conversionApi
                const { item, attributeNewValue } = data

                // ✅ Use type guard instead of `any`
                if (!isModelElement(item)) return
                if (item.name !== modelName) return

                const viewElement = mapper.toViewElement(item)
                if (!viewElement) return

                writer.removeClass(
                  ["align-left", "align-right", "align-center"],
                  viewElement,
                )

                if (attributeNewValue) {
                  const classMap = {
                    left: "align-left",
                    center: "align-center",
                    right: "align-right",
                  } as const

                  const newClass =
                    classMap[attributeNewValue as keyof typeof classMap]
                  if (newClass) {
                    writer.addClass(newClass, viewElement)
                    console.log(
                      `✅ Applied alignment class: ${newClass} for ${modelName}`,
                    )
                  }
                }
              },
              { priority: "low" },
            )
          })
      }

      // ✅ Register alignment commands
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
          view.bind("isOn").to(command, "value", (value: unknown) => !!value)
          view.bind("isEnabled").to(command, "isEnabled")
          view.on("execute", () => editor.execute(name))
          return view
        })
      }

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

  return MediaFloatPlugin as unknown as SafePluginConstructor
}
