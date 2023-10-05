import React, { useMemo, useEffect, useState, useCallback } from "react"
import { CKEditor } from "@ckeditor/ckeditor5-react"

import { ClassicEditor } from "@ckeditor/ckeditor5-editor-classic"
import type { EditorConfig } from "@ckeditor/ckeditor5-core"

import { Essentials } from "@ckeditor/ckeditor5-essentials"
import { UploadAdapter } from "@ckeditor/ckeditor5-adapter-ckfinder"
import { Autoformat } from "@ckeditor/ckeditor5-autoformat"
import { Bold, Italic } from "@ckeditor/ckeditor5-basic-styles"
import { BlockQuote } from "@ckeditor/ckeditor5-block-quote"
import { EasyImage } from "@ckeditor/ckeditor5-easy-image"
import { Heading } from "@ckeditor/ckeditor5-heading"
import {
  Image,
  ImageStyle,
  ImageToolbar,
  ImageUpload,
} from "@ckeditor/ckeditor5-image"
import { Link } from "@ckeditor/ckeditor5-link"
import { List } from "@ckeditor/ckeditor5-list"
import { MediaEmbed } from "@ckeditor/ckeditor5-media-embed"
import { Paragraph } from "@ckeditor/ckeditor5-paragraph"
import { CloudServices } from "@ckeditor/ckeditor5-cloud-services"

// block toolbar setup
import { BlockToolbar } from "@ckeditor/ckeditor5-ui"
import { ParagraphButtonUI } from "@ckeditor/ckeditor5-paragraph"
import { ensureEmbedlyPlatform } from "ol-util"
import BlockEditorIcon from "./BlockEditorIcon"
import { icons } from "@ckeditor/ckeditor5-core"

const baseEditorConfig: EditorConfig = {
  plugins: [
    Essentials,
    Autoformat,
    Bold,
    Italic,
    BlockQuote,
    Heading,
    Link,
    List,
    MediaEmbed,
    Paragraph,
    BlockToolbar,
    UploadAdapter,
    CloudServices,
    EasyImage,
    Image,
    ImageStyle,
    ImageToolbar,
    ImageUpload,
    ParagraphButtonUI,
    BlockEditorIcon,
  ],
  blockToolbar: ["mediaEmbed", "imageUpload"],
  toolbar: {
    items: [
      "heading",
      "bold",
      "italic",
      "link",
      "bulletedList",
      "numberedList",
      "blockQuote",
    ],
  },
  placeholder: "Write here...",
  image: {
    toolbar: [
      "imageStyle:block",
      "imageStyle:side",
      "|",
      "imageTextAlternative",
    ],
  },
  // cloudServices: getCloudServicesConfig(),
  // mediaEmbed: {
  //   previewsInData: true,
  //   providers: [
  //     {
  //       name: "embedly",
  //       url: /.+/,
  //       html: (match) => {
  //         const url = match[0]

  //         return embedlyCardHtml(url)
  //       },
  //     },
  //   ],
  // },
  blockEditorIcon: {
    icon: icons.plus,
  },
}

type CkeditorArticleProps = {
  initialData?: string
  onReady?: () => void
  onChange?: (value: string) => void
  onBlur?: () => void
  id?: string
  className?: string
  config?: Partial<EditorConfig>
}

const CkeditorArticle: React.FC<CkeditorArticleProps> = ({
  initialData,
  onReady,
  onChange,
  onBlur,
  id,
  className,
  config,
}) => {
  const [editor, setEditor] = useState<ClassicEditor | null>(null)
  const fullConfig = useMemo(() => {
    return {
      ...baseEditorConfig,
      ...config,
    }
  }, [config])

  useEffect(() => {
    ensureEmbedlyPlatform()
  }, [])

  useEffect(() => {
    if (editor && initialData !== undefined) {
      editor.setData(initialData)
    }
  }, [initialData, editor])

  const handleChange = useCallback(
    (_event: unknown, editor: ClassicEditor) => {
      onChange?.(editor.getData())
    },
    [onChange],
  )

  return (
    <div id={id} className={className}>
      <CKEditor
        editor={ClassicEditor}
        config={fullConfig}
        onReady={(editor) => {
          setEditor(editor)
          onReady?.()
        }}
        onChange={handleChange}
        onBlur={onBlur}
      />
    </div>
  )
}

export default CkeditorArticle
export type { CkeditorArticleProps }
