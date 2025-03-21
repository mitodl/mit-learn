/* eslint-disable react-hooks/rules-of-hooks */
import React, { useEffect, useState } from "react"
import type { Meta, StoryObj } from "@storybook/react"
import { TabButtonList, TabButton, TabButtonLink } from "./TabButtonList"
import TabContext from "@mui/lab/TabContext"
import { Button } from "@mitodl/smoot-design"
import Stack from "@mui/material/Stack"
import TabPanel from "@mui/lab/TabPanel"
import Typography from "@mui/material/Typography"
import { faker } from "@faker-js/faker/locale/en"
import Container from "@mui/material/Container"
import { TabListProps } from "@mui/lab/TabList"
import { usePathname } from "next/navigation"

type StoryProps = TabListProps & {
  count: number
}

const meta: Meta<StoryProps> = {
  title: "smoot-design/TabButtons",
  argTypes: {
    variant: {
      options: ["scrollable", "fullWidth", "standard"],
      control: { type: "radio" },
    },
    scrollButtons: {
      options: ["auto", true, false],
      control: { type: "radio" },
    },
  },
  args: {
    count: 4,
    variant: "scrollable",
    allowScrollButtonsMobile: true,
    scrollButtons: "auto",
  },
  render: ({ count, ...others }) => {
    const [value, setValue] = React.useState("tab1")
    return (
      <Container maxWidth="sm">
        <TabContext value={value}>
          <Stack direction="row">
            <TabButtonList
              {...others}
              onChange={(_event, val) => setValue(val)}
            >
              {Array(count)
                .fill(null)
                .map((_, i) => (
                  <TabButton
                    key={`tab-${i}`}
                    value={`tab${i + 1}`}
                    label={`Tab ${i + 1}`}
                  />
                ))}
            </TabButtonList>

            <Stack
              direction="row"
              justifyContent="end"
              sx={{ paddingLeft: "16px" }}
            >
              <Button>Other UI</Button>
            </Stack>
          </Stack>
          {Array(count)
            .fill(null)
            .map((_, i) => (
              <TabPanel key={`tab-${i}`} value={`tab${i + 1}`}>
                <Typography variant="h4">Header {i + 1}</Typography>
                {faker.lorem.paragraphs(2)}
              </TabPanel>
            ))}
        </TabContext>
      </Container>
    )
  },
}

export default meta

type Story = StoryObj<StoryProps>

export const ButtonTabs: Story = {}
export const ManyButtonTabs: Story = {
  args: {
    count: 12,
  },
}

export const LinkTabs: Story = {
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/#link2",
      },
    },
  },
  render: () => {
    const pathname = usePathname()
    const [hash, setHash] = useState<string | undefined>()

    useEffect(() => {
      setHash(pathname.match(/(#.+)/)?.[0])
    }, [pathname])

    return (
      <div>
        Current Location:
        <pre>{JSON.stringify(pathname, null, 2)}</pre>
        <TabContext value={hash!}>
          <TabButtonList>
            <TabButtonLink value="#link1" href="#link1" label="Tab 1" />
            <TabButtonLink value="#link2" href="#link2" label="Tab 2" />
            <TabButtonLink value="#link3" href="#link3" label="Tab 3" />
          </TabButtonList>
        </TabContext>
      </div>
    )
  },
}
