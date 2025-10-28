"use client"

import React, { useState, useEffect, useMemo } from "react"
import dynamic from "next/dynamic"
import { type EditorConfig } from "ckeditor5"
import type { Editor } from "@ckeditor/ckeditor5-core"

import { Dialog, Typography } from "ol-components"
import { Course } from "./types"

import "ckeditor5/ckeditor5.css"
import "./styles.css"

const mockCourses = [
  {
    id: "1",
    title: "React for Beginners",
    image:
      "https://35904.cdn.cke-cs.com/A8zpYq0deQ8s5ZchTmUI/images/5025b810afce449ed73f6c18c929040073a27f14dd6ba674.webp",
    description:
      'Free open source text" can refer to many programs, including text editors like Notepad++ and LibreOffice Writer, text-to-speech models like Mozilla TTS and eSpeak, and speech-to-text models such as Whisper and DeepSpeech. The best choice depends on the specific need, such as writing, editing code, or converting speech to tex',
  },
  {
    id: "2",
    title: "Next.js Advanced",
    image:
      "https://35904.cdn.cke-cs.com/A8zpYq0deQ8s5ZchTmUI/images/5025b810afce449ed73f6c18c929040073a27f14dd6ba674.webp",
    description: "Master SSR and routing.",
  },
]

const CKEditor = dynamic(
  async () => (await import("@ckeditor/ckeditor5-react")).CKEditor,
  { ssr: false },
)

export interface CKEditorClientProps {
  value: string
  onChange: (val: string) => void
  uploadUrl: string
  getCKEditorTokenFetchUrl: () => Promise<string | null>
}

export const CKEditorClient: React.FC<CKEditorClientProps> = ({
  value,
  onChange,
  uploadUrl,
  getCKEditorTokenFetchUrl,
}) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [EditorModules, setEditorModules] = useState<any>(null)
  const [data, setData] = useState(value || "")
  const [open, setOpen] = useState(false)

  // store selected course info (for Dialog content)
  const [selectedCourse] = useState<Course | null>(null)

  useEffect(() => {
    const handler = (e: CustomEvent) => {
      setEditorModules(e.detail.editor)
      setOpen(true)
    }
    document.addEventListener("openCoursePicker", handler as EventListener)
    return () =>
      document.removeEventListener("openCoursePicker", handler as EventListener)
  }, [])

  const handleCourseSelect = (course: Course) => {
    if (!EditorModules) {
      console.warn("Editor instance not ready")
      setOpen(false)
      return
    }
    setOpen(false)
    EditorModules.execute("insertCourse", course)
    EditorModules.editing.view.focus()
  }

  useEffect(() => {
    ;(async () => {
      const CKEditorModules = await import("ckeditor5")
      const {
        ClassicEditor,
        Essentials,
        Paragraph,
        Bold,
        Italic,
        Heading,
        Link,
        List,
        BlockQuote,
        Autoformat,
        Image,
        ImageToolbar,
        ImageUpload,
        EasyImage,
        MediaEmbed,
        CloudServices,
        ImageResize,
        ImageResizeEditing,
        ImageResizeHandles,
        ImageStyle,
        ImageStyleEditing,
        ImageStyleUI,
        Widget,
        Underline,
        Strikethrough,
        Alignment,

        CodeBlock,
        FontSize,
        FontColor,
        FontBackgroundColor,
        Undo,
        Table,
        TableToolbar,
      } = CKEditorModules

      const { createMediaFloatPlugin } = await import("./MediaPlugin")
      const MediaFloatPlugin = createMediaFloatPlugin(CKEditorModules)

      const { createDefaultImageStylePlugin } = await import(
        "./DefaultImageStylePlugin"
      )
      const DefaultImageStylePlugin =
        createDefaultImageStylePlugin(CKEditorModules)

      const { createInsertCoursePlugin } = await import("./InsertCoursePlugin")
      const InsertCoursePlugin = createInsertCoursePlugin(CKEditorModules)

      setEditorModules({
        ClassicEditor,
        Essentials,
        Paragraph,
        Bold,
        Italic,
        Heading,
        Link,
        List,
        BlockQuote,
        Autoformat,
        Underline,
        Strikethrough,
        Alignment,
        CodeBlock,
        FontSize,
        FontColor,
        FontBackgroundColor,
        Undo,
        Table,
        TableToolbar,
        Image,
        ImageToolbar,
        ImageUpload,
        EasyImage,
        CloudServices,
        ImageResize,
        ImageResizeEditing,
        ImageResizeHandles,
        ImageStyle,
        ImageStyleEditing,
        ImageStyleUI,
        MediaEmbed,
        Widget, // ✅ ensure this line exists
        MediaFloatPlugin,
        DefaultImageStylePlugin,
        InsertCoursePlugin,
        // also expose the original modules object if you want:
        _CKEditorModules: CKEditorModules,
      })
    })()
  }, [])

  const editorConfig: EditorConfig = useMemo(() => {
    if (!EditorModules) return {}

    return {
      plugins: [
        EditorModules.Essentials,
        EditorModules.Paragraph,
        EditorModules.Bold,
        EditorModules.Italic,
        EditorModules.Heading,
        EditorModules.Link,
        EditorModules.List,
        EditorModules.BlockQuote,
        EditorModules.Autoformat,
        // 👇 Image-related plugins (all required for resizing + styling)
        EditorModules.Image,
        EditorModules.ImageToolbar,
        EditorModules.ImageUpload,
        EditorModules.EasyImage,
        EditorModules.ImageResize,
        EditorModules.ImageResizeEditing,
        EditorModules.ImageResizeHandles,
        EditorModules.ImageStyle,
        EditorModules.ImageStyleEditing,
        EditorModules.ImageStyleUI,
        EditorModules.CloudServices,
        EditorModules.MediaEmbed,
        EditorModules.Widget, // ✅ add Widget here
        EditorModules.MediaFloatPlugin, // ✅ your plugin now safe
        EditorModules.DefaultImageStylePlugin, // ✅ your plugin now safe
        EditorModules.InsertCoursePlugin, // ✅ your plugin now safe
      ],
      toolbar: {
        items: [
          "heading",
          "|",
          "bold",
          "italic",
          "underline",
          "link",
          "|",
          "bulletedList",
          "numberedList",
          "strikethrough",
          "|",
          "alignment", // text alignment
          "|",
          "blockQuote",
          "|",
          "numberedList",
          "bulletedList",
          "|",
          "uploadImage",
          "|",
          "insertTable",
          "mediaEmbed",
          "|",
          "mediaAlignLeft",
          "mediaAlignCenter",
          "mediaAlignRight",
          "|",
          "undo",
          "redo",
          "|",
          "insertCourse", // 👈 our custom button
          "|",
        ],
      },
      alignment: {
        options: ["left", "center", "right", "justify"],
      },
      placeholder: "Write something...",
      image: {
        toolbar: [
          "toggleImageCaption",
          "imageTextAlternative",
          "|",
          "imageStyle:alignLeft",
          "imageStyle:alignCenter",
          "imageStyle:alignRight",
          "|",
          "resizeImage",
        ],
        styles: [
          "alignLeft", // float left, text wraps right
          "alignCenter", // centered image
          "alignRight", // float right, text wraps left
        ],
        resizeOptions: [
          { name: "resizeImage:original", label: "Original", value: null },
          { name: "resizeImage:50", label: "50%", value: "50" },
          { name: "resizeImage:75", label: "75%", value: "75" },
        ],
        resizeUnit: "%",
      },

      cloudServices: {
        tokenUrl: getCKEditorTokenFetchUrl,
        uploadUrl: uploadUrl,
      },
      mediaEmbed: {
        previewsInData: true,
      },
    } as EditorConfig
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [EditorModules])

  if (!EditorModules) return <div>Loading editor...</div>

  return (
    <>
      <div className="ckeditor-container">
        <CKEditor
          editor={EditorModules.ClassicEditor}
          data={data}
          config={editorConfig}
          onReady={(editor) => {
            setEditorModules((prev: Editor) => ({
              ...prev,
              _activeEditor: editor,
            }))
          }}
          onChange={(_, editor) => {
            const html = editor.getData()
            setData(html)
            onChange(html)
          }}
        />
      </div>
      <Dialog
        onClose={() => setOpen(false)}
        open={open}
        title="Select a Course"
        actions={null}
      >
        {!selectedCourse ? (
          <>
            <Typography sx={{ marginBottom: "16px" }}>
              Choose a course to insert into the editor:
            </Typography>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                maxHeight: "400px",
                overflowY: "auto",
              }}
            >
              {mockCourses.map((course) => (
                <div
                  key={course.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleCourseSelect(course)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      handleCourseSelect(course)
                    }
                  }}
                  className="course-list-container"
                  onFocus={(e) =>
                    (e.currentTarget.style.boxShadow = "0 0 0 2px #007aff33")
                  }
                  onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "#fafafa")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "white")
                  }
                >
                  <img
                    src={course.image}
                    alt={course.title}
                    style={{
                      width: "80px",
                      height: "60px",
                      objectFit: "cover",
                      borderRadius: "6px",
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <Typography variant="subtitle1">{course.title}</Typography>
                    <Typography variant="body2" sx={{ color: "#555" }}>
                      {course.description}
                    </Typography>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <Typography sx={{ marginBottom: "16px" }}>
              {selectedCourse.description}
            </Typography>
          </>
        )}
      </Dialog>
    </>
  )
}
