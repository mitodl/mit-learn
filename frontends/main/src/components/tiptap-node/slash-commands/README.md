# Slash Commands for Tiptap Editor

This implements a Notion-style slash commands menu for the Tiptap editor. Type `/` anywhere in the editor to open a searchable command menu.

## Installation

First, install the required dependency:

```bash
npm install @tiptap/suggestion
```

## Usage

The slash commands extension is already configured in `NewArticlePage.tsx`. Here's how it works:

### Basic Setup

```typescript
import {
  SlashCommands,
  renderSlashCommands,
  getSuggestionItems,
} from "@/components/tiptap-node/slash-commands"

const extensions = [
  // ... other extensions
  SlashCommands.configure({
    suggestion: {
      items: ({ query }) => getSuggestionItems(query),
      render: renderSlashCommands,
    },
  }),
]
```

## Available Commands

When you type `/` in the editor, you'll see these commands:

- **Heading 1, 2, 3** - Create section headings
- **Bullet List** - Create a bulleted list
- **Numbered List** - Create a numbered list
- **Task List** - Create a checklist with checkboxes
- **Blockquote** - Add a quote
- **Code Block** - Insert code with syntax highlighting
- **Horizontal Rule** - Add a divider line
- **Resource Card** - Insert a learning resource card
- **Ask TIM Button** - Insert an AI assistant button

## Keyboard Navigation

- `↑` / `↓` - Navigate through commands
- `Enter` or `Tab` - Execute selected command
- `Esc` - Close the menu
- Type to filter commands

## Customization

### Adding New Commands

Edit `slash-commands-extension.tsx` and add to the `getSlashCommands()` function:

```typescript
{
  title: "My Custom Command",
  description: "What this command does",
  icon: "🎯",
  command: ({ editor, range }) => {
    editor
      .chain()
      .focus()
      .deleteRange(range)
      .insertContent("Custom content")
      .run()
  },
  aliases: ["custom", "mycmd"],
}
```

### Styling

Edit `slash-commands.scss` to customize the appearance of the command menu.

## Features

- ✅ Searchable command menu
- ✅ Keyboard navigation
- ✅ Mouse interaction
- ✅ Command aliases for better discoverability
- ✅ Responsive design
- ✅ TypeScript support
