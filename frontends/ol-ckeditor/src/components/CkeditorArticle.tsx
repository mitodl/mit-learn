"use client"
import React from "react"
import { CKEditorClient } from "ol-ckeditor"
import { useArticleCreate } from "api/hooks/articles"
import { Button, Input, Alert } from "@mitodl/smoot-design"
import { Container, Typography } from "ol-components"

import "./style.css"

const CkeditorArticle = () => {
  const [title, setTitle] = React.useState<string>("")
  const [editorContent, setEditorContent] = React.useState<string>("")
  const [editorKey, setEditorKey] = React.useState(0)
  const [alertText, setAlertText] = React.useState("")
  const [severity, setSeverity] = React.useState<"success" | "error">("success")

  const { mutate: createArticle, isPending } = useArticleCreate()

  const handleSave = () => {
    setAlertText("")

    const payload = {
      title: title.trim(),
      html: editorContent,
    }

    createArticle(
      payload as {
        html: string
        title: string
      },
      {
        onSuccess: (article) => {
          setAlertText(`✅ Article saved successfully, id: ${article.id}`)
          setSeverity("success")
          setTitle("")
          setEditorContent("")
          setEditorKey((prev) => prev + 1)
        },
        onError: () => {
          setAlertText("❌ Failed to save article")
          setSeverity("error")
        },
      },
    )
  }

  return (
    <Container className="article-wrapper">
      <h1>Write Article</h1>
      {alertText && (
        <Alert
          key={alertText}
          severity={severity}
          className="info-alert"
          closable
        >
          <Typography variant="body2" color="textPrimary">
            {alertText}
          </Typography>
        </Alert>
      )}
      <Input
        type="text"
        value={title}
        onChange={(e) => {
          setTitle(e.target.value)
          setAlertText("")
        }}
        placeholder="Enter article title"
        className="input-field"
      />

      <div className="editor-box">
        <CKEditorClient
          key={editorKey}
          value={editorContent}
          onChange={(content) => setEditorContent(content)}
        />
      </div>

      <div className="save-button">
        <Button
          variant="primary"
          disabled={isPending || !title.trim()}
          onClick={handleSave}
        >
          {isPending ? "Saving..." : "Save Article"}
        </Button>
      </div>
    </Container>
  )
}

export { CkeditorArticle }
