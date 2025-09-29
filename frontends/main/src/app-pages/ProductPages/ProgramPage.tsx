import React from "react"

type ProgramPageProps = {
  readableId: string
}
const ProgramPage: React.FC<ProgramPageProps> = ({ readableId }) => {
  return <div>Program Page {readableId}</div>
}

export default ProgramPage
