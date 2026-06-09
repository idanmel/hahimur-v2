export interface Update {
  id: number
  date: string
  subject: string
  text: string
  draft?: boolean
  pdfFilename?: string
  pdfLabel?: string
}
