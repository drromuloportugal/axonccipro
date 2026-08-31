const EMOJI_PATTERN = /[\p{Extended_Pictographic}\p{Regional_Indicator}\uFE0E\uFE0F\u200D]/gu;

export function stripEmoji(value: string): string {
  return value.replace(EMOJI_PATTERN, "").replace(/\s{2,}/g, " ").trim();
}

export function stripEmojiDeep<T>(value: T): T {
  if (typeof value === "string") return stripEmoji(value) as T;
  if (Array.isArray(value)) return value.map(stripEmojiDeep) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, stripEmojiDeep(item)]),
    ) as T;
  }
  return value;
}