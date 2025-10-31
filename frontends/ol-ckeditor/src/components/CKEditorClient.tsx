"use client"

import React, { useState, useEffect, useMemo } from "react"
import dynamic from "next/dynamic"
import { type EditorConfig } from "ckeditor5"
import type { Editor } from "@ckeditor/ckeditor5-core"
import { Dialog, Typography, SearchInput, LoadingSpinner } from "ol-components"
import { useCkeditorParams } from "api/hooks/ckeditor"
import { useLearningResourcesSearch } from "api/hooks/learningResources"
import type { Course } from "./types"

import "ckeditor5/ckeditor5.css"
import "./styles.css"

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
  // --- Core editor and modal states
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [EditorModules, setEditorModules] = useState<any>(null)
  console.log("EditorModules====================:", value)
  const [data, setData] = useState(value || "")
  const [open, setOpen] = useState(false)
  const [isLoader, setIsLoader] = useState(false)

  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")

  const [token, setToken] = useState<string | null>(null)
  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(query), 400)
    return () => clearTimeout(timeout)
  }, [query])

  const { data: coursesData, isLoading } = useLearningResourcesSearch(
    { q: debouncedQuery },
    { keepPreviousData: true },
  )

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
    if (!EditorModules) return
    setOpen(false)
    EditorModules.execute("insertCourse", {
      ...course,
      image: course.image || "",
    })
    EditorModules.editing.view.focus()
  }

  useEffect(() => {
    setIsLoader(true)
    ;(async () => {
      try {
        // 👇 Test token first!
        const token = await getCKEditorTokenFetchUrl()

        if (!token || typeof token !== "string")
          throw new Error("Invalid token")
        setToken(token)

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

        const { createInsertCoursePlugin } = await import(
          "./InsertCoursePlugin"
        )
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
          Widget,
          MediaFloatPlugin,
          DefaultImageStylePlugin,
          InsertCoursePlugin,
          _CKEditorModules: CKEditorModules,
        })
      } catch (error) {
        console.error("CKEditor token fetch failed:", error)
        setIsLoader(false)
      }
    })()
  }, [])
  // Push initial value into editor when ready
  // useEffect(() => {
  //   if (EditorModules?._activeEditor && value) {
  //     const editor = EditorModules._activeEditor
  //     if (editor.getData() !== value) {
  //       editor.setData(value)
  //     }
  //   }
  // }, [EditorModules?._activeEditor])

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
        EditorModules.Underline,
        EditorModules.Strikethrough,
        EditorModules.Alignment,
        EditorModules.CodeBlock,
        EditorModules.FontSize,
        EditorModules.FontColor,
        EditorModules.FontBackgroundColor,
        EditorModules.Undo,
        EditorModules.Table,
        EditorModules.TableToolbar,
        EditorModules.Image,
        EditorModules.ImageToolbar,
        EditorModules.ImageUpload,
        EditorModules.EasyImage,
        EditorModules.CloudServices,
        EditorModules.ImageResize,
        EditorModules.ImageResizeEditing,
        EditorModules.ImageResizeHandles,
        EditorModules.ImageStyle,
        EditorModules.ImageStyleEditing,
        EditorModules.ImageStyleUI,
        EditorModules.MediaEmbed,
        EditorModules.Widget,
        EditorModules.MediaFloatPlugin,
        EditorModules.DefaultImageStylePlugin,
        EditorModules.InsertCoursePlugin,
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
          "alignment",
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
          "insertCourse",
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
        tokenUrl: async () => token,
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
      <LoadingSpinner color="inherit" loading={isLoader || !token} size={16} />
      <div className="ckeditor-container">
        <CKEditor
          editor={EditorModules.ClassicEditor}
          data={data}
          config={editorConfig}
          onReady={(editor) => {
            console.log("CKEditor is ready to use!", editor)
            setIsLoader(false)
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
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <SearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onClear={() => setQuery("")}
            onSubmit={(e) => setDebouncedQuery(e.target.value)} // triggers search
            placeholder="Search for courses..."
            fullWidth
          />

          {isLoading ? (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                padding: "20px 0",
              }}
            >
              <LoadingSpinner color="inherit" loading={isLoading} size={16} />
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                maxHeight: "400px",
                overflowY: "auto",
              }}
            >
              {coursesData?.results?.length ? (
                coursesData.results.map((resource) => {
                  const course: Course = {
                    id: resource.id,
                    title: resource.title,
                    description: resource.description || "",
                    image: resource.image?.url || "",
                  }

                  return (
                    <div
                      key={course.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleCourseSelect(course)}
                      className="course-list-container"
                      onKeyDown={(e) =>
                        ["Enter", " "].includes(e.key) &&
                        handleCourseSelect(course)
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
                      <div style={{ flex: 1, marginLeft: "12px" }}>
                        <Typography variant="subtitle2">
                          {course.title}
                        </Typography>
                        {course.short_description && (
                          <Typography
                            variant="body2"
                            sx={{ color: "gray", fontSize: "0.85rem" }}
                          >
                            {course.short_description.slice(0, 80)}…
                          </Typography>
                        )}
                      </div>
                    </div>
                  )
                })
              ) : (
                <Typography>No courses found.</Typography>
              )}
            </div>
          )}
        </div>
      </Dialog>
    </>
  )
}
