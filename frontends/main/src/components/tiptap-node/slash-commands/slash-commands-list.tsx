"use client"

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from "react"
import { styled } from "ol-components"
import { Editor } from "@tiptap/react"
import { Range } from "@tiptap/core"
import { CommandItem, getSuggestionItems } from "./slash-commands-extension"

const CommandsMenu = styled.div({
  background: "white",
  border: "1px solid #e0e0e0",
  borderRadius: "8px",
  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
  padding: "8px",
  minWidth: "280px",
  maxHeight: "400px",
  overflowY: "auto",
})

const StyledCommandItem = styled.div<{ $isSelected: boolean }>(
  {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "8px 12px",
    borderRadius: "4px",
    cursor: "pointer",
    transition: "background-color 0.15s",
    userSelect: "none",

    "&:hover": {
      backgroundColor: "#f5f5f5",
    },
  },
  ({ $isSelected }) =>
    $isSelected && {
      backgroundColor: "#e8f0fe",

      "&:hover": {
        backgroundColor: "#d2e3fc",
      },
    },
)

const CommandIcon = styled.div({
  fontSize: "18px",
  // eslint-disable-next-line ol-kit/no-manual-font-weight
  fontWeight: 600,
  color: "#666",
  minWidth: "24px",
  textAlign: "center",
})

const CommandContent = styled.div({
  flex: 1,
  minWidth: 0,
})

const CommandTitle = styled.div({
  fontSize: "14px",
  // eslint-disable-next-line ol-kit/no-manual-font-weight
  fontWeight: 500,
  color: "#333",
})

const CommandDescription = styled.div({
  fontSize: "12px",
  color: "#666",
  marginTop: "2px",
})

interface SlashCommandsListProps {
  items: CommandItem[]
  command: (item: CommandItem) => void
  editor: Editor
  range: Range
  query: string
}

export const SlashCommandsList = forwardRef(
  (props: SlashCommandsListProps, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0)

    const filteredItems = getSuggestionItems(props.query)

    const selectItem = (index: number) => {
      const item = filteredItems[index]

      if (item) {
        props.command(item)
      }
    }

    const upHandler = () => {
      setSelectedIndex(
        (selectedIndex + filteredItems.length - 1) % filteredItems.length,
      )
    }

    const downHandler = () => {
      setSelectedIndex((selectedIndex + 1) % filteredItems.length)
    }

    const enterHandler = () => {
      selectItem(selectedIndex)
    }

    useEffect(() => {
      setSelectedIndex(0)
    }, [filteredItems.length])

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: { event: KeyboardEvent }) => {
        if (event.key === "ArrowUp") {
          upHandler()
          return true
        }

        if (event.key === "ArrowDown") {
          downHandler()
          return true
        }

        if (event.key === "Enter" || event.key === "Tab") {
          event.preventDefault()
          enterHandler()
          return true
        }

        return false
      },
    }))

    if (filteredItems.length === 0) {
      return (
        <CommandsMenu>
          <StyledCommandItem $isSelected={false}>
            <CommandContent>
              <CommandTitle>No results</CommandTitle>
              <CommandDescription>
                Try a different search term
              </CommandDescription>
            </CommandContent>
          </StyledCommandItem>
        </CommandsMenu>
      )
    }

    return (
      <CommandsMenu>
        {filteredItems.map((item, index) => (
          <StyledCommandItem
            key={index}
            $isSelected={index === selectedIndex}
            onClick={() => selectItem(index)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <CommandIcon>{item.icon}</CommandIcon>
            <CommandContent>
              <CommandTitle>{item.title}</CommandTitle>
              {item.description && (
                <CommandDescription>{item.description}</CommandDescription>
              )}
            </CommandContent>
          </StyledCommandItem>
        ))}
      </CommandsMenu>
    )
  },
)

SlashCommandsList.displayName = "SlashCommandsList"
