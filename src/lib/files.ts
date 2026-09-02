/**
 * Getting data out of and back into the browser.
 *
 * Exports are pretty-printed rather than minified: a fitter emailing a client
 * record should be able to open it and see exactly what personal data is in
 * there before sending it.
 */

export function downloadJson(data: unknown, basename: string): void {
  const stamp = new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${basename}-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function readJsonFile(file: File): Promise<unknown> {
  try {
    return JSON.parse(await file.text());
  } catch {
    return null;
  }
}
