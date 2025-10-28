"use client"
import React from "react"
import { CKEditorClient } from "ol-ckeditor"
import { ckeditorApi } from "api/clients"

const ArticlesPage: React.FC = () => {
  const getCKEditorTokenFetchUrl = async () => {
    const response = await ckeditorApi.ckeditorRetrieve()
    return response.data.token
  }

  return (
    <div>
      <CKEditorClient
        value={""}
        getCKEditorTokenFetchUrl={getCKEditorTokenFetchUrl}
        uploadUrl={process.env.NEXT_PUBLIC_CKEDITOR_UPLOAD_URL || ""}
        onChange={() => {}}
      />
    </div>
  )
}

export { ArticlesPage }
