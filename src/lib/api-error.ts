// Turns a failed fetch Response into a user-facing Turkish message. Every API
// route here answers errors as `{ error: string }`; anything else (HTML error
// page, empty body) falls back to the status code.
export async function responseErrorMessage(res: Response, fallback = "İşlem başarısız oldu"): Promise<string> {
  const body = await res.json().catch(() => null);
  const message = body && typeof body.error === "string" ? body.error : null;
  return message ?? `${fallback} (HTTP ${res.status})`;
}

export function networkErrorMessage(err: unknown): string {
  return err instanceof Error && err.message ? `Bağlantı hatası: ${err.message}` : "Bağlantı hatası, tekrar dene.";
}
