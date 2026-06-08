export interface Update {
  id: number
  date: string
  subject: string
  paragraphs: string[]
  draft?: boolean
  pdfFilename?: string
  pdfLabel?: string
}
