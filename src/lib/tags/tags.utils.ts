export function mapPopularTags(
  t: { id: number; name: string; postCount: number | bigint | string }[],
) {
  return t.map((r) => ({
    id: r.id,
    name: r.name,
    postCount: Number(r.postCount),
  }));
}
