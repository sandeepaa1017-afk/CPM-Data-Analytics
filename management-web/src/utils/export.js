function csvCell(value) {
  const text = value == null ? "" : String(value);
  const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
}

export function downloadCsv(filename, columns, rows) {
  const header = columns.map(([, label]) => csvCell(label)).join(",");
  const body = rows
    .map((row) => columns.map(([key]) => csvCell(row[key])).join(","))
    .join("\r\n");
  const blob = new Blob([`\uFEFF${header}\r\n${body}`], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
