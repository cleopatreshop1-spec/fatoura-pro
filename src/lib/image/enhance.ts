export function enhanceInvoiceImage(canvas: HTMLCanvasElement): string {
  const ctx = canvas.getContext('2d')!
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data

  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    const contrast = 1.4
    const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255))
    const enhanced = factor * (gray - 128) + 128
    const clamped = Math.min(255, Math.max(0, enhanced))
    data[i]     = clamped
    data[i + 1] = clamped
    data[i + 2] = clamped
  }

  ctx.putImageData(imageData, 0, 0)
  return canvas.toDataURL('image/jpeg', 0.95)
}

export function imageFileToCanvas(file: File): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const maxDim = 2048
      let { width, height } = img
      if (width > maxDim || height > maxDim) {
        const scale = maxDim / Math.max(width, height)
        width  = Math.round(width  * scale)
        height = Math.round(height * scale)
      }
      const canvas = document.createElement('canvas')
      canvas.width  = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)
      URL.revokeObjectURL(url)
      resolve(canvas)
    }
    img.onerror = reject
    img.src = url
  })
}
