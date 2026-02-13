import "@tiptap/core"

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    highlight: {
      setHighlight: (attributes?: { color: string }) => ReturnType
      toggleHighlight: (attributes?: { color: string }) => ReturnType
      unsetHighlight: () => ReturnType
    }
  }
}
