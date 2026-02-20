import { styled } from "@mitodl/smoot-design"
import UnstyledRawHTML from "@/components/UnstyledRawHTML/UnstyledRawHTML"

const RawHTML = styled(UnstyledRawHTML)(({ theme }) => ({
  "*:first-child": {
    marginTop: 0,
  },
  ...theme.typography.body1,
  lineHeight: "1.5",
  p: {
    marginTop: "16px",
    marginBottom: "0",
  },
  "& > ul": {
    listStyleType: "none",
    marginTop: "16px",
    marginBottom: 0,
    padding: 0,
  },
  [theme.breakpoints.down("md")]: {
    ...theme.typography.body2,
    lineHeight: 1.57,
  },
}))

export default RawHTML
