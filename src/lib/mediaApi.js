/* Photos and videos for the website chat (Property Cards): uploaded to the server, which keeps them and gives back a public
   link. The link is what the flow stores, so the flow itself stays small. See backend/src/media. */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

export const MEDIA_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm'
export const MAX_IMAGE_MB = 8
export const MAX_VIDEO_MB = 40
const IMAGE = /^image\/(jpeg|png|webp|gif)$/, VIDEO = /^video\/(mp4|webm)$/

/** '' when the file is worth sending; otherwise why not (the server checks again from the file's own bytes). */
export function checkFile(file) {
  const isImage = IMAGE.test(file.type), isVideo = VIDEO.test(file.type)
  if (!isImage && !isVideo) return `“${file.name}” is not supported. Use a JPG, PNG, WebP or GIF photo, or an MP4 or WebM video.`
  const limit = (isImage ? MAX_IMAGE_MB : MAX_VIDEO_MB) * 1048576
  return file.size > limit ? `“${file.name}” is too large. Photos can be up to ${MAX_IMAGE_MB} MB and videos up to ${MAX_VIDEO_MB} MB.` : ''
}

/** Uploads one file; resolves to its public link. onProgress gets 0–100. */
export function uploadMedia(botId, file, onProgress) {
  return new Promise((resolve, reject) => {
    const bad = checkFile(file)
    if (bad) return reject(new Error(bad))
    if (!botId) return reject(new Error('The bot is still loading. Try again in a moment.'))
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_BASE_URL}/webchat-media?bot=${encodeURIComponent(botId)}`)
    xhr.setRequestHeader('Content-Type', file.type)
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100)) }
    xhr.onerror = () => reject(new Error('Could not reach the server. Check the connection and try again.'))
    xhr.onload = () => {
      let json = {}
      try { json = JSON.parse(xhr.responseText || '{}') } catch { /* handled below */ }
      if (xhr.status >= 200 && xhr.status < 300 && json.url) {
        // the widget runs on other sites, so the stored link must carry the server's address
        const origin = /^https?:\/\//.test(API_BASE_URL) ? new URL(API_BASE_URL).origin : window.location.origin
        resolve(origin + json.url)
      } else reject(new Error(json.message || `Upload failed (${xhr.status}).`))
    }
    xhr.send(file)
  })
}
