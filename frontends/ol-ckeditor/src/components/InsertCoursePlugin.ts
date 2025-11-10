import type { ViewElement, ViewNode } from "@ckeditor/ckeditor5-engine"
import type { UpcastConversionApi } from "@ckeditor/ckeditor5-engine/src/conversion/upcastdispatcher"
import type { DowncastConversionApi } from "@ckeditor/ckeditor5-engine/src/conversion/downcastdispatcher"
// eslint-disable-next-line import/no-extraneous-dependencies
import Element from "@ckeditor/ckeditor5-engine/src/model/element"

import type { SafePluginConstructor } from "./types"

interface Course {
  id: string
  title: string
  image: string
  description: string
}

export function createInsertCoursePlugin(
  CKEditorModules: typeof import("ckeditor5"),
): SafePluginConstructor {
  const { Plugin, Command, ButtonView } = CKEditorModules

  class InsertCourseCommand extends Command {
    override execute(course: Course) {
      const editor = this.editor

      editor.model.change((writer) => {
        const courseElement = writer.createElement("course", {
          title: course.title,
          image: course.image,
          description: course.description,
        })

        // 🟢 Insert course at the end of the document instead of replacing selection
        const root = editor.model.document.getRoot()
        if (!root) {
          console.warn("Editor model root not available yet.")
          return
        }
        const endPosition = writer.createPositionAt(root, "end")

        editor.model.insertContent(courseElement, endPosition)

        // 🟢 Add a paragraph after to allow user to keep typing
        const paragraph = writer.createElement("paragraph")
        editor.model.insertContent(
          paragraph,
          writer.createPositionAfter(courseElement),
        )
        writer.setSelection(paragraph, "in")
      })
    }

    override refresh() {
      this.isEnabled = true
    }
  }

  class InsertCoursePlugin extends Plugin {
    init() {
      const editor = this.editor

      // --- Schema ---
      editor.model.schema.register("course", {
        allowWhere: "$block",
        allowAttributes: ["title", "image", "description"],
        isBlock: true,
        isObject: true,
      })

      // --- Upcast (HTML → Model) ---
      editor.conversion.for("upcast").elementToElement({
        view: { name: "figure", classes: "course-card" },
        model: (viewElement: ViewElement, { writer }: UpcastConversionApi) => {
          let title = ""
          let description = ""
          let image = ""

          const img = viewElement.getChild(0) as ViewElement | null
          const infoDiv = viewElement.getChild(1) as ViewElement | null

          // ✅ extract <img src="...">
          if (img && img.is("element")) {
            const src = img.getAttribute("src")
            if (typeof src === "string") {
              image = src
            }
          }

          // ✅ extract title & description safely
          if (infoDiv && infoDiv.is("element")) {
            const titleEl = infoDiv.getChild(0) as ViewElement | null
            const descEl = infoDiv.getChild(1) as ViewElement | null

            const maybeTitle = titleEl?.getChild(0) as ViewNode | null
            const maybeDesc = descEl?.getChild(0) as ViewNode | null

            if (maybeTitle && "data" in maybeTitle) {
              title = (maybeTitle as { data: string }).data
            }
            if (maybeDesc && "data" in maybeDesc) {
              description = (maybeDesc as { data: string }).data
            }
          }

          return writer.createElement("course", { title, image, description })
        },
      })

      // --- Shared Downcast Renderer ---
      const renderCourseView = (
        modelElement: Element,
        { writer }: DowncastConversionApi,
      ) => {
        const title = (modelElement.getAttribute("title") as string) || ""
        const image = (modelElement.getAttribute("image") as string) || ""
        const description =
          (modelElement.getAttribute("description") as string) || ""

        return writer.createRawElement(
          "figure",
          { class: "course-card" },
          (domElement: HTMLElement) => {
            domElement.innerHTML = `
        <img src="${image}" alt="${title}" />
        <div class="course-info">
          <h3 class="course-title">${title}</h3>
          <p class="course-description">${description}</p>
        </div>
      `
          },
        )
      }

      // --- Downcasts ---
      editor.conversion.for("dataDowncast").elementToElement({
        model: "course",
        view: renderCourseView,
      })

      editor.conversion.for("editingDowncast").elementToElement({
        model: "course",
        view: renderCourseView,
      })

      // --- Command ---
      editor.commands.add("insertCourse", new InsertCourseCommand(editor))

      // --- Toolbar Button ---
      editor.ui.componentFactory.add("insertCourse", (locale) => {
        const view = new ButtonView(locale)
        view.set({
          label: "Insert Course",
          withText: true,
          tooltip: true,
        })

        view.on("execute", () => {
          const event = new CustomEvent("openCoursePicker", {
            detail: { editor },
          })
          document.dispatchEvent(event)
        })

        return view
      })
    }
  }

  return InsertCoursePlugin as unknown as SafePluginConstructor
}
