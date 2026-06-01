export async function exportPDF(content: string, filename: string) {
  return { path: `${filename}.pdf`, content };
}

export async function exportDOCX(content: string, filename: string) {
  return { path: `${filename}.docx`, content };
}
