"use client"

import React, { useRef } from "react"
import { useRouter } from "next-nprogress-bar"
import { Permission } from "api/hooks/user"
import RestrictedRoute from "@/components/RestrictedRoute/RestrictedRoute"
import { ArticleEditor, styled, HEADER_HEIGHT, Container } from "ol-components"
import { Button } from "@mitodl/smoot-design"
import { articlesView } from "@/common/urls"
import StarterKit from "@tiptap/starter-kit"
import {
  MenuButtonBold,
  MenuButtonItalic,
  MenuControlsContainer,
  MenuDivider,
  MenuSelectHeading,
  RichTextEditor,
  type RichTextEditorRef,
} from "mui-tiptap"
import { ResourceCardExtension } from "./ResourceCardExtension"
import { Placeholder, Selection } from "@tiptap/extensions"
import Document from "@tiptap/extension-document"

const CustomDocument = Document.extend({
  content: "heading paragraph (paragraph | resourceCard)*",
})

const EXTENSIONS = [
  CustomDocument,
  StarterKit.configure({
    document: false,
  }),
  ResourceCardExtension,
  Placeholder.configure({
    placeholder: ({ node }) => {
      if (node.type.name === "heading") {
        return "Add a title"
      }
      if (node.type.name === "description") {
        return "Add a description"
      }
      if (node.type.name === "paragraph") {
        return "Add a paragraph"
      }
      if (node.type.name === "resourceCard") {
        return "Add a learning resource card"
      }
      return ""
    },
  }),
]

const ArticleNewPage: React.FC = () => {
  const router = useRouter()
  const rteRef = useRef<RichTextEditorRef>(null)

  return (
    <RestrictedRoute requires={Permission.ArticleEditor}>
      <Container>
        <RichTextEditor
          sx={{ width: "100%", minHeight: "500px" }}
          immediatelyRender={false}
          ref={rteRef}
          extensions={EXTENSIONS} // Or any Tiptap extensions you wish!
          content="" // Initial content for the editor
          // Optionally include `renderControls` for a menu-bar atop the editor:
          renderControls={() => (
            <MenuControlsContainer>
              <MenuSelectHeading />
              <MenuDivider />
              <MenuButtonBold />
              <MenuButtonItalic />
              <Button
                size="small"
                variant="secondary"
                onClick={() => {
                  const id = prompt("Enter learning resource id")
                  rteRef.current?.editor?.commands.insertContent({
                    type: "resourceCard",
                    attrs: { resourceId: id },
                  })
                }}
              >
                Add Learning Resource
              </Button>
              {/* Add more controls of your choosing here */}
            </MenuControlsContainer>
          )}
        />
      </Container>
    </RestrictedRoute>
  )
}

export { ArticleNewPage }
