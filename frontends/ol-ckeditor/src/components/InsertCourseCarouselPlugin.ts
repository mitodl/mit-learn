// InsertCourseCarouselPlugin.js
// NOTE: adapt import / export to your project module system if needed.

const MOCK_COURSES = [
  {
    id: "1",
    title: "Course A",
    image:
      "https://35904.cdn.cke-cs.com/A8zpYq0deQ8s5ZchTmUI/images/01c35ba4c768c8465ec1563610744ebc25567078532853aa.webp",
    description: "Intro to topic A",
  },
  {
    id: "2",
    title: "Course B",
    image:
      "https://35904.cdn.cke-cs.com/A8zpYq0deQ8s5ZchTmUI/images/fe330022e8ac9bdb0ddb483adb64448cd2d44b2fd976fd27.jpg",
    description: "Deep dive into B",
  },
]

export function createInsertCourseCarouselPlugin(CKEditorModules) {
  const { Plugin, Command, ButtonView } = CKEditorModules

  class InsertCarouselCommand extends Command {
    execute(courses = []) {
      const editor = this.editor

      // ✅ Prevent double execution
      if (this._isExecuting) return
      this._isExecuting = true
      setTimeout(() => (this._isExecuting = false), 0)

      editor.model.change((writer) => {
        const carousel = writer.createElement("courseCarousel")

        for (const course of courses) {
          const item = writer.createElement("courseItem", {
            id: course.id,
            title: course.title,
            image: course.image,
            description: course.description,
          })
          console.log("Inserting course item:", course)
          writer.append(item, carousel)
        }

        const root = editor.model.document.getRoot()
        const pos = writer.createPositionAt(root, "end")
        writer.insert(carousel, pos)

        const paragraph = writer.createElement("paragraph")
        writer.insert(paragraph, writer.createPositionAfter(carousel))
        writer.setSelection(paragraph, "in")
      })
    }
  }

  class InsertCourseCarouselPlugin extends Plugin {
    init() {
      const editor = this.editor

      // -------- 1) Schema ----------
      editor.model.schema.register("courseCarousel", {
        allowWhere: "$block",
        isObject: true,
        isBlock: true,
      })

      editor.model.schema.register("courseItem", {
        allowIn: "courseCarousel",
        allowAttributes: ["title", "image", "description"],
      })

      // -------- 2) Editing downcast (model -> editing view) ----------
      // courseCarousel -> <div class="course-carousel"> ...cards...</div>

      // ✅ Prevent double UI (placeholder only, no card here)

      // -------- 3) Data downcast (model -> data/html) ----------
      // ✅ Editing downcast - SHOW ONLY A PREVIEW BOX, NO CARDS
      // ✅ Only preview in editor
      editor.conversion.for("editingDowncast").elementToElement({
        model: "courseCarousel",
        view: (modelElement, { writer: vWriter }) => {
          const count = [...modelElement.getChildren()].length

          const container = vWriter.createContainerElement("div", {
            class: "course-carousel-editor-preview",
            style:
              "border:2px dashed #7aa2ff;padding:12px;margin:8px 0;background:#f7faff;border-radius:6px;",
          })

          const label = vWriter.createContainerElement("div", {
            style: "font-size:13px;color:#3d6de4;",
          })

          vWriter.insert(
            vWriter.createPositionAt(label, 0),
            vWriter.createText(`📚 Course Carousel (${count} items)`),
          )

          vWriter.insert(vWriter.createPositionAt(container, "end"), label)
          return container
        },
      })

      // ✅ Course items in editor = invisible anchors
      editor.conversion.for("editingDowncast").elementToElement({
        model: "courseItem",
        view: (modelElement, { writer: vWriter }) => {
          return vWriter.createEmptyElement("span", {
            "data-course-anchor": modelElement.getAttribute("title"),
            style: "display:none;",
          })
        },
      })

      // -------- 4) Upcast (data/html -> model) ----------
      editor.conversion.for("upcast").elementToElement({
        view: { name: "div", classes: "course-carousel" },
        model: "courseCarousel",
      })

      editor.conversion.for("upcast").elementToElement({
        view: {
          name: "div",
          classes: "carousel-course-card",
        },
        model: (viewElement, { writer: mWriter }) => {
          // ✅ Only accept cards that contain data attributes
          const title = viewElement.getAttribute("data-title")
          const image = viewElement.getAttribute("data-image")
          const description = viewElement.getAttribute("data-description")

          if (!title || !image) {
            // ❌ This is a visual duplicate — ignore it
            return null
          }

          return mWriter.createElement("courseItem", {
            title,
            image,
            description: description || "",
          })
        },
      })

      // -------- 5) Command & UI button ----------
      editor.commands.add(
        "insertCourseCarousel",
        new InsertCarouselCommand(editor),
      )

      editor.ui.componentFactory.add("insertCourseCarousel", (locale) => {
        const view = new ButtonView(locale)
        view.set({
          label: "Insert Courses",
          tooltip: true,
          withText: true,
        })

        view.on("execute", (evt) => {
          evt.stop() // ✅ Prevent double execution from UI

          const input = prompt("Enter course IDs (comma-separated, e.g. 1,2)")
          if (!input) return
          const ids = input.split(",").map((s) => s.trim())
          const courses = MOCK_COURSES.filter((c) => ids.includes(c.id))
          if (courses.length) {
            editor.execute("insertCourseCarousel", courses)
          }
        })

        return view
      })
    }
  }

  return InsertCourseCarouselPlugin
}
