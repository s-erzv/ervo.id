import imageCompression from 'browser-image-compression'
import { supabase } from './supabase'

export const compressAndUpload = async (
  file: File,
  folderPath: string
): Promise<string | null> => {
  if (!file) return null

  let fileToUpload: File = file

  if (file.type.startsWith('image/')) {
    const compressedBlob = await imageCompression(file, {
      maxSizeMB: 0.8,
      maxWidthOrHeight: 1280,
      useWebWorker: true,
    })

    fileToUpload = new File([compressedBlob], file.name, {
      type: compressedBlob.type || file.type,
      lastModified: Date.now(),
    })
  }

  const ext = file.name.split('.').pop()
  const fileName = `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.${ext}`

  const cleanPath = folderPath.replace(/^\/|\/$/g, '')
  const fullPath = `${cleanPath}/${fileName}`

  const { error } = await supabase.storage
    .from('proofs')
    .upload(fullPath, fileToUpload, {
      contentType: fileToUpload.type,
    })

  if (error) throw error

  const { data } = supabase.storage
    .from('proofs')
    .getPublicUrl(fullPath)

  return data.publicUrl
}
