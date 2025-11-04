"use client"
import React from "react"
import { CKEditorClient } from "ol-ckeditor"
import { ckeditorApi } from "api/clients"
import { useArticleDetail, useArticleCreate } from "api/hooks/articles"

const CkeditorArticle = ({ articleId }: { articleId: number }) => {
  const [title, setTitle] = React.useState<string>("")
  const [editorContent, setEditorContent] = React.useState<string>("")
  const id = Number(articleId)
  // const { data, isLoading } = useArticleDetail(id)

  // React.useEffect(() => {
  //   if (data) {
  //     console.log("dat============", data)
  //     setTitle(data.title)
  //     setEditorContent(data.html)
  //   }
  // }, [isLoading])
  const { mutate: createArticle, isPending } = useArticleCreate()

  const getCKEditorTokenFetchUrl = async () => {
    const response = await ckeditorApi.ckeditorRetrieve()
    return response.data.token
  }

  const handleSave = () => {
    if (!title.trim()) {
      alert("Please enter a title")
      return
    }

    const payload = {
      title: title.trim(),
      html: editorContent,
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createArticle(payload as any, {
      onSuccess: () => {
        alert("✅ Article saved successfully")
        setTitle("")
        setEditorContent("")
      },
      onError: () => {
        alert("❌ Failed to save article")
      },
    })
  }
  // if (isLoading) return <div className="loading">Loading...</div>
  console.log("editorContent==================:", editorContent)
  return (
    <div className="article-wrapper">
      <h1 className="article-title">Create Article</h1>

      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Enter article title"
        className="input-field"
      />

      <div className="editor-box">
        <CKEditorClient
          value={editorContent}
          getCKEditorTokenFetchUrl={getCKEditorTokenFetchUrl}
          uploadUrl={process.env.NEXT_PUBLIC_CKEDITOR_UPLOAD_URL || ""}
          onChange={(content) => setEditorContent(content)}
        />
      </div>

      <div style={{ textAlign: "right" }}>
        <button
          onClick={handleSave}
          disabled={isPending}
          className="button-save"
        >
          {isPending ? "Saving..." : "Save Article"}
        </button>
      </div>
    </div>
  )
}

export { CkeditorArticle }
