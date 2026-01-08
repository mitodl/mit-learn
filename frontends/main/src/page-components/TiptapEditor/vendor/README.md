# TipTap vendor files

The TipTap [Simple template](https://tiptap.dev/docs/ui-components/templates/simple-editor) ejects library code to the project. To facilitate library upgrades and distinguish vendor code from our own TipTap extensions, we must ensure that library code lives in the vendor directory unedited.

A Git precommit hook prevents us from pushing changes here.

## Extending TipTap

To extend TipTap functionality, create custom extensions **outside** the `vendor` directory:

1. **Create custom extensions** in the parent `TiptapEditor` directory in the dedicated `extensions` subdirectory
2. **Import vendor code** as needed using relative paths (e.g., `./vendor/components/...`, `./vendor/lib/...`, `./vendor/hooks/...`)
3. **Use TipTap's extension API** to extend existing nodes, marks, or create new ones:

   ```typescript
   import { Extension } from "@tiptap/core"

   export const CustomExtension = Extension.create({
     name: "customExtension",
     // ... extension configuration
   })
   ```

4. **Compose extensions** in your editor configuration (see `ArticleEditor.tsx` for an example)

**Important:** Never modify files in the `vendor` directory. Instead, create wrapper extensions or compose vendor extensions with your custom logic in files outside `vendor`.
