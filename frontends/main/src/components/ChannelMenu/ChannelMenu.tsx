import React, { useMemo } from "react"
import styled from "@emotion/styled"
import * as routes from "@/common/urls"
import { SimpleMenu } from "ol-components/SimpleMenu/SimpleMenu"
import type { SimpleMenuItem } from "ol-components/SimpleMenu/SimpleMenu"
import { ActionButton } from "ol-components/Button/Button"
import { RiSettings4Fill } from "@remixicon/react"

const InvertedButton = styled(ActionButton)({ color: "white" })

const ChannelMenu: React.FC<{ channelType: string; name: string }> = ({
  channelType,
  name,
}) => {
  const items: SimpleMenuItem[] = useMemo(() => {
    return [
      {
        key: "settings",
        label: "Channel Settings",
        href: routes.makeChannelEditPath(channelType, name),
      },
    ]
  }, [channelType, name])
  return (
    <SimpleMenu
      items={items}
      trigger={
        <InvertedButton variant="text">
          <RiSettings4Fill />
        </InvertedButton>
      }
    />
  )
}

export default ChannelMenu
