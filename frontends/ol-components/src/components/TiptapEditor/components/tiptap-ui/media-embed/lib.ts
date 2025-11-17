function convertToEmbedUrl(url: string) {
  // YouTube
  console.log("Converting URL:", url)
  if (url.includes("watch?v=")) {
    return url.replace("watch?v=", "embed/")
  }
  if (url.includes("youtu.be")) {
    return url.replace("youtu.be/", "youtube.com/embed/")
  }
  // Vimeo
  if (url.includes("vimeo.com")) {
    return url.replace("vimeo.com/", "player.vimeo.com/video/")
  }
  console.log("No conversion applied for URL:", url)
  return url
}

export { convertToEmbedUrl }
