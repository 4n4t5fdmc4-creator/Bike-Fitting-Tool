/** Minimal CSV export - quote every field, escape embedded quotes. */
export function toCsv(headers: ReadonlyArray<string>, rows: ReadonlyArray<ReadonlyArray<string | number>>): string {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  return [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\r\n');
}

export function downloadCsv(filename: string, headers: ReadonlyArray<string>, rows: ReadonlyArray<ReadonlyArray<string | number>>): void {
  const blob = new Blob([toCsv(headers, rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
