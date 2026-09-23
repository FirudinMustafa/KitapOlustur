import { APICallError } from "ai";

// "Gateway kredisini idareli kullanma" (2026-09-23): before this, any AI SDK/
// Gateway failure (rate limit, insufficient credit, bad API key, unknown
// model) was written into generationRuns.errorMessage verbatim (err.message)
// and shown to the user as-is in RunStatusView.tsx/PipelineStageTracker.tsx -
// often a raw provider error string that means nothing to a non-developer.
// `ai` exports APICallError (re-exported from @ai-sdk/provider) with a real
// `statusCode` and `isInstance()` type guard, so the common failure modes can
// be translated into a message someone can actually act on.
export function translateAiError(err: unknown): string {
  if (APICallError.isInstance(err)) {
    switch (err.statusCode) {
      case 402:
        return "AI Gateway kredisi tükenmiş görünüyor. Vercel hesabından (Account → AI Gateway → Usage) kredi eklemen gerekiyor.";
      case 429:
        return "AI sağlayıcısına çok fazla istek gönderildi (rate limit). Birazdan tekrar dene.";
      case 401:
      case 403:
        return "AI Gateway kimlik doğrulama hatası - API anahtarı/izin ayarlarını kontrol et.";
      default:
        return err.statusCode
          ? `AI sağlayıcı hatası (HTTP ${err.statusCode}): ${err.message}`
          : `AI sağlayıcı hatası: ${err.message}`;
    }
  }
  if (err instanceof Error) return err.message;
  return String(err);
}
