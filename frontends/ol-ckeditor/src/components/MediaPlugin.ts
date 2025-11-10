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

      for (const attr of ["width", "height"] as const) {
        editor.conversion.for("downcast").add((dispatcher) => {
          dispatcher.on(
            `attribute:${attr}`,
            (evt, data, api) => {
              let { item, attributeNewValue } = data
              const { mapper, writer } = api

              if (!item.is?.("element", "media")) return

              const viewFigure = mapper.toViewElement(item)
              if (!viewFigure) return

              // Get the <div data-oembed-url="...">
              const oembedDiv = viewFigure.getChild(0)

              if (!oembedDiv) return
              if (attr === "height") attributeNewValue = "auto" // we don't set height style
              if (attributeNewValue) {
                // apply style to inner div not figure
                writer.setStyle(attr, attributeNewValue, oembedDiv)
              } else {
                writer.removeStyle(attr, oembedDiv)
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

      // debounce handler so we don't thrash the model while dragging
      editor.editing.view.document.on("change", () => {
        const domRoot = editor.editing.view.getDomRoot()
        console.log("DOM Root:", domRoot)
        if (!domRoot) return

        const wrappers = domRoot.querySelectorAll(".ck-media__wrapper")

        wrappers.forEach((wrapper: HTMLElement) => {
          if ((wrapper as any)._resizeObserverAttached) return
          ;(wrapper as any)._resizeObserverAttached = true
          let lastWidth = ""
          let lastHeight = ""

          const observer = new ResizeObserver(() => {
            //console.log("Setting up ResizeObserver for wrapper-=-=-=-=-=:", wrapper)
            const width = wrapper.style.width
            const height = wrapper.style.height

            // ignore live drag movement; apply when values settle
            if (width === lastWidth && height === lastHeight) return
            lastWidth = width
            lastHeight = height

            const viewWrapper =
              editor.editing.view.domConverter.mapDomToView(wrapper)
            const figure = viewWrapper?.parent
            console.log("Figure Element:", figure)
            console.log(viewWrapper)
            if (!figure?.hasClass("media")) return
            const modelEl = editor.editing.mapper.toModelElement(figure)
            if (!modelEl) return

            editor.model.change((writer) => {
              if (width) writer.setAttribute("width", width, modelEl)
              if (height) writer.setAttribute("height", height, modelEl)
            })
          })

          observer.observe(wrapper)
        })
      })
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
