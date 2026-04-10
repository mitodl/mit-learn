import { Container, styled } from "ol-components"

const PodcastContainer = styled(Container)(({ theme }) => ({
  maxWidth: "1080px !important",
  padding: "0 !important",
  [theme.breakpoints.down("md")]: {
    padding: "0 16px !important",
  },
  [theme.breakpoints.down("sm")]: {
    padding: "0 16px !important",
  },
}))

export default PodcastContainer
