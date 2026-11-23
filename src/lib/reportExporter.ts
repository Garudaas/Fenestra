import { formatISTDateTime } from '@/lib/formatters'

function escapeCsvCell(val: string | number | null | undefined): string {
  const str = val === null || val === undefined ? '' : String(val)
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function exportRowsToCSV(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>
): void {
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map(row => row.map(escapeCsvCell).join(',')),
  ]
  const csvContent = '\uFEFF' + lines.join('\r\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function escapeHtml(val: string | number | null | undefined): string {
  const str = val === null || val === undefined ? '' : String(val)
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function openPrintableReport(
  title: string,
  subtitle: string,
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>
): void {
  const generatedIst = formatISTDateTime(new Date())
  const headerHtml = headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')
  const rowsHtml = rows
    .map(
      row =>
        `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`
    )
    .join('')

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)} - Fenestrians</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111; margin: 24px; }
    h1 { font-size: 20px; margin: 0 0 4px 0; color: #1a1a1a; }
    .sub { font-size: 12px; color: #555; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { border: 1px solid #ccc; padding: 7px 8px; text-align: left; vertical-align: top; }
    th { background: #f3f4f6; font-weight: bold; }
    tr:nth-child(even) { background: #fafafa; }
    @media print {
      body { margin: 12px; }
    }
  </style>
</head>
<body>
  <h1>Fenestrians — ${escapeHtml(title)}</h1>
  <div class="sub">${escapeHtml(subtitle)} • Generated: ${escapeHtml(generatedIst)}</div>
  <table>
    <thead><tr>${headerHtml}</tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <script>
    window.onload = function() { window.print(); };
  </script>
</body>
</html>`

  const printWindow = window.open('', '_blank', 'width=960,height=720')
  if (printWindow) {
    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
  }
}
