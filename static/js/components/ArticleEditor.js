/* global SETTINGS: false */
// @flow
import React from "react"
import ReactDOMServer from "react-dom/server"
import CustomEditor from "@mitodl/ckeditor-custom-build"

import { getCKEditorJWT } from "../lib/api/ckeditor"
import { loadEmbedlyPlatform } from "../lib/embed"

type Props = {
  initialData?: Array<Object>,
  readOnly?: boolean,
  onChange?: Function
}

const editorClassName = (readOnly?: boolean): string =>
  `ck-editor ${readOnly ? "read-only" : ""}`.trim()

export default class ArticleEditor extends React.Component<Props> {
  editor: ?Object
  node: any

  initializeEditor = async (node: any) => {
    const { initialData, onChange, readOnly } = this.props

    loadEmbedlyPlatform()

    this.node = node

    try {
      const editor = await CustomEditor.create(initialData || [], {
        mediaEmbed: {
          previewsInData: true,
          providers:      [
            {
              name: "embedly",
              url:  /.+/,
              html: match => {
                const url = match[0]

                // we'll render this to a string because CKEditor
                // doesn't support any other return value for this function.
                // the embed.ly platform JS finds elements with the .embedly-card
                // class and turns them into embed cards
                return ReactDOMServer.renderToStaticMarkup(
                  <a
                    data-card-chrome="0"
                    data-card-controls="0"
                    data-card-key={SETTINGS.embedlyKey}
                    href={url}
                    className="embedly-card"
                  />
                )
              }
            }
          ]
        },
        cloudServices: {
          uploadUrl: SETTINGS.ckeditor_upload_url,
          tokenUrl:  getCKEditorJWT
        }
      })

      if (!readOnly) {
        editor.model.document.on("change:data", event => {
          if (onChange) {
            onChange(event, editor)
            onChange(editor.getData())
          }
        })

        if (this.node) {
          this.node.appendChild(editor.ui.view.toolbar.element)
        }
      } else {
        editor.isReadOnly = true
      }

      if (this.node) {
        this.node.appendChild(editor.ui.view.editable.element)
      }
      this.editor = editor

      if (!readOnly) {
        this.editor.editing.view.focus()
      }
    } catch (err) {
      console.error(err) // eslint-disable-line no-console
    }
  }

  async componentWillUnmount() {
    if (this.editor) {
      await this.editor.destroy()
      this.editor = null
    }
  }

  render() {
    const { readOnly } = this.props

    return (
      <div className={editorClassName(readOnly)} ref={this.initializeEditor} />
    )
  }
}
