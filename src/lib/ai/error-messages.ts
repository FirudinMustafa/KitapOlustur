import { APICallError } from "ai";

// "Gateway kredisini idareli kullanma" (2026-09-23): before this, any AI SDK/
// Gateway failure (rate limit, insufficient credit, bad API key, unknown
// model) was written into generationRuns.errorMessage verbatim (err.message)
// and shown to the user as-is in RunStatusView.tsx/PipelineStageTracker.tsx -
// often a raw provider error string that means nothing to a non-developer.
// `ai` exports APICallError (re-exported from @ai-sdk/provider) with a real
// `statusCode` and `isInstance()` type guard, so the common failure modes can
// be translated into a message someone can actually act on.
// Confirmed live (2026-09-23, first-ever real pipeline run on this account):
// this exact message came back from the Gateway - NOT as an APICallError
// instance (it fell through to the plain err.message branch below,
// unhandled, before this check existed), for a model that's simply not
// reachable on this Vercel account's current plan/credit tier. It's the
// single most important failure mode for this app in practice (every real
// generation attempt hits it until real credit is added), so it's checked
// by message content up front rather than relying on a statusCode that this
// particular error doesn't carry.
const FREE_TIER_MARKER = "Free tier users do not have access";

export function translateAiError(err: unknown): string {
  const rawMessage = err instanceof Error ? err.message : typeof err === "string" ? err : null;
  if (rawMessage?.includes(FREE_TIER_MARKER)) {
    return "Vercel AI Gateway hesabın şu an ücretsiz (free tier) planda ve bu model için erişim vermiyor. Devam edebilmek için Vercel hesabından AI Gateway'e gerçek kredi/ödeme yöntemi eklemen gerekiyor: https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%3Fmodal%3Dtop-up";
  }

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
