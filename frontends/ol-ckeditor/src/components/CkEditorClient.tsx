"use client"

import React, { useState, useEffect, useMemo } from "react"
import dynamic from "next/dynamic"
import { type EditorConfig } from "ckeditor5"
import type { Editor } from "@ckeditor/ckeditor5-core"
import { LoadingSpinner } from "ol-components"

import "ckeditor5/ckeditor5.css"

const CKEditor = dynamic(
  async () => (await import("@ckeditor/ckeditor5-react")).CKEditor,
  { ssr: false },
)

export interface CKEditorClientProps {
  value: string
  onChange: (val: string) => void
}

export const CKEditorClient: React.FC<CKEditorClientProps> = ({
  value,
  onChange,
}) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [EditorModules, setEditorModules] = useState<any>(null)
  const [data, setData] = useState(value || "")
  const [isLoader, setIsLoader] = useState(false)

  useEffect(() => {
    setIsLoader(true)
    ;(async () => {
      try {
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
          MediaEmbed,
          Base64UploadAdapter,
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
          AutoImage,
          AutoLink,
          Code,
          FindAndReplace,
          Font,
          GeneralHtmlSupport,
          Highlight,
          HorizontalLine,
          HtmlEmbed,
          ImageCaption,
          ImageInsert,
          Indent,
          IndentBlock,
          LinkImage,
          ListProperties,
          Mention,
          PageBreak,
          PasteFromOffice,
          PictureEditing,
          RemoveFormat,
          ShowBlocks,
          SpecialCharacters,
          SpecialCharactersEssentials,
          Style,
          Subscript,
          Superscript,
          TableCaption,
          TableCellProperties,
          TableColumnResize,
          TableProperties,
          TextPartLanguage,
          TextTransformation,
          TodoList,
        } = CKEditorModules

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
          Base64UploadAdapter,
          ImageResize,
          ImageResizeEditing,
          ImageResizeHandles,
          ImageStyle,
          ImageStyleEditing,
          ImageStyleUI,
          MediaEmbed,
          Widget,
          AutoImage,
          AutoLink,
          Code,
          FindAndReplace,
          Font,
          GeneralHtmlSupport,
          Highlight,
          HorizontalLine,
          HtmlEmbed,
          ImageCaption,
          ImageInsert,
          Indent,
          IndentBlock,
          LinkImage,
          ListProperties,
          Mention,
          PageBreak,
          PasteFromOffice,
          PictureEditing,
          RemoveFormat,
          ShowBlocks,
          SpecialCharacters,
          SpecialCharactersEssentials,
          Style,
          Subscript,
          Superscript,
          TableCaption,
          TableCellProperties,
          TableColumnResize,
          TableProperties,
          TextPartLanguage,
          TextTransformation,
          TodoList,
          _CKEditorModules: CKEditorModules,
        })
      } catch (error) {
        console.error("CKEditor token fetch failed:", error)
        setIsLoader(false)
      }
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
        EditorModules.Base64UploadAdapter,
        EditorModules.ImageResize,
        EditorModules.ImageResizeEditing,
        EditorModules.ImageResizeHandles,
        EditorModules.ImageStyle,
        EditorModules.ImageStyleEditing,
        EditorModules.ImageStyleUI,
        EditorModules.MediaEmbed,
        EditorModules.Widget,
        EditorModules.AutoImage,
        EditorModules.AutoLink,
        EditorModules.Code,
        EditorModules.FindAndReplace,
        EditorModules.Font,
        EditorModules.GeneralHtmlSupport,
        EditorModules.Highlight,
        EditorModules.HorizontalLine,
        EditorModules.HtmlEmbed,
        EditorModules.ImageCaption,
        EditorModules.ImageInsert,
        EditorModules.Indent,
        EditorModules.IndentBlock,
        EditorModules.LinkImage,
        EditorModules.ListProperties,
        EditorModules.Mention,
        EditorModules.PageBreak,
        EditorModules.PasteFromOffice,
        EditorModules.PictureEditing,
        EditorModules.RemoveFormat,
        EditorModules.ShowBlocks,
        EditorModules.SpecialCharacters,
        EditorModules.SpecialCharactersEssentials,
        EditorModules.Style,
        EditorModules.Subscript,
        EditorModules.Superscript,
        EditorModules.TableCaption,
        EditorModules.TableCellProperties,
        EditorModules.TableColumnResize,
        EditorModules.TableProperties,
        EditorModules.TextPartLanguage,
        EditorModules.TextTransformation,
        EditorModules.TodoList,
      ],
      toolbar: {
        items: [
          "heading",
          "|",
          "findAndReplace",
          "selectAll",
          "|",
          "bold",
          "italic",
          "underline",
          "link",
          "|",
          "bulletedList",
          "numberedList",
          "strikethrough",
          "code",
          "subscript",
          "superscript",
          "removeFormat",
          "|",
          "outdent",
          "indent",
          "|",
          "todoList",
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
          "undo",
          "redo",
          "fontSize",
          "fontFamily",
          "fontColor",
          "fontBackgroundColor",
          "highlight",
          "|",
          "link",
          "blockQuote",
          "insertTable",
          "codeBlock",
          "htmlEmbed",
          "|",
          "specialCharacters",
          "horizontalLine",
          "pageBreak",
          "|",
          "textPartLanguage",
          "|",
          "sourceEditingEnhanced",
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
        styles: ["alignLeft", "alignCenter", "alignRight"],
        resizeOptions: [
          { name: "resizeImage:original", label: "Original", value: null },
          { name: "resizeImage:50", label: "50%", value: "50" },
          { name: "resizeImage:75", label: "75%", value: "75" },
        ],
        resizeUnit: "%",
      },
      mediaEmbed: {
        previewsInData: true,
      },
    } as EditorConfig
  }, [EditorModules])

  if (!EditorModules)
    return <LoadingSpinner color="inherit" loading={isLoader} size={16} />

  return (
    <div>
      <CKEditor
        editor={EditorModules.ClassicEditor}
        data={data}
        config={editorConfig}
        onReady={(editor) => {
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
  )
}
