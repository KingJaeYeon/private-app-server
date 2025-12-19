export const toArray = (value: unknown): string[] | undefined => {
  if (!value) return undefined;
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string') {
    const arr = value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    return arr.length ? arr : undefined;
  }
  return undefined;
};
