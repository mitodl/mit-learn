import React from "react"
import { Typography } from "ol-components"
import { styled } from "@mitodl/smoot-design"
import { HeadingIds } from "./util"
import RawHTML from "./RawHTML"

const WhatYoullLearnRoot = styled.section(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "32px",
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  borderRadius: "8px",
  padding: "32px",
  [theme.breakpoints.down("md")]: {
    padding: "0",
    border: "none",
  },
}))

const checkmarkSvgEncoded = (color: string) =>
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 20C4.47715 20 0 15.5228 0 10C0 4.47715 4.47715 0 10 0C15.5228 0 20 4.47715 20 10C20 15.5228 15.5228 20 10 20ZM10 18C14.4183 18 18 14.4183 18 10C18 5.58172 14.4183 2 10 2C5.58172 2 2 5.58172 2 10C2 14.4183 5.58172 18 10 18ZM9.0026 14L4.75999 9.7574L6.17421 8.3431L9.0026 11.1716L14.6595 5.51472L16.0737 6.92893L9.0026 14Z" fill="${color}"/></svg>`,
  )

const WhatHTML = styled(RawHTML)(({ theme }) => ({
  "> ul": {
    display: "grid",
    gap: "32px",
    gridTemplateColumns: "1fr 1fr",
    [theme.breakpoints.down("sm")]: {
      gridTemplateColumns: "1fr",
    },
    listStyle: "none",
    padding: 0,
    "> li": {
      paddingLeft: "32px",
      position: "relative" as const,
      "&::before": {
        content: '""',
        position: "absolute" as const,
        left: 0,
        top: "2px",
        width: "20px",
        height: "20px",
        backgroundImage: `url('data:image/svg+xml,${checkmarkSvgEncoded(theme.custom.colors.green)}')`,
        backgroundRepeat: "no-repeat",
        backgroundSize: "contain",
      },
    },
  },
}))

const WhatYoullLearnSection: React.FC<{ html: string }> = ({ html }) => {
  return (
    <WhatYoullLearnRoot aria-labelledby={HeadingIds.What}>
      <Typography variant="h4" component="h2" id={HeadingIds.What}>
        What you'll learn
      </Typography>
      <WhatHTML html={html} />
    </WhatYoullLearnRoot>
  )
}

export default WhatYoullLearnSection
