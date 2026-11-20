export function pushJumpPosition(
  positions: string[],
  messageId: string,
  cap = 50,
): string[] {
  const safeCap = Math.max(0, Math.floor(cap));
  if (safeCap === 0) return [];
  return [...positions, messageId].slice(-safeCap);
}

export function popJumpPosition(positions: string[]): {
  messageId: string | null;
  remaining: string[];
} {
  if (positions.length === 0) return { messageId: null, remaining: [] };
  return {
    messageId: positions[positions.length - 1] ?? null,
    remaining: positions.slice(0, -1),
  };
}

export function clearJumpLists(_lists: Record<string, string[]>): Record<string, string[]> {
  return {};
}
