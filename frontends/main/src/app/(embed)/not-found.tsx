import React from "react"

export const metadata = {
  title: "Not Found",
}

const NotFound: React.FC = () => {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100vw",
        height: "100vh",
        backgroundColor: "#000",
        color: "#fff",
        fontFamily: "sans-serif",
        fontSize: "1rem",
      }}
    >
      Video not found
    </div>
  )
}

export default NotFound
