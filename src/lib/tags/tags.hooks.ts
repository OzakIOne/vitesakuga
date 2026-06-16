import "src/lib/polyfills";
import { createListCollection } from "@chakra-ui/react";
import { useLiveQuery } from "@tanstack/react-db";
import { useMemo } from "react";
import { tagsCollection } from "src/lib/db/collections";
import type { Tag } from "src/lib/posts/posts.schema";

export function useTagCollection(options: {
  search: string;
  exclude?: string[];
}) {
  const { search, exclude = [] } = options;

  const { data: allTags = [] } = useLiveQuery((q) =>
    q.from({ t: tagsCollection }).orderBy(({ t }) => t.name, "asc"),
  );

  const typedTags = allTags as Tag[];

  const excludeSet = useMemo(() => new Set(exclude), [exclude]);

  const filteredTags = useMemo(
    () =>
      typedTags.filter(
        (tag) =>
          !excludeSet.has(tag.name) &&
          tag.name.toLowerCase().includes(search.toLowerCase()),
      ),
    [typedTags, search, excludeSet],
  );

  const collection = useMemo(
    () => createListCollection({ items: filteredTags.map((tag) => tag.name) }),
    [filteredTags],
  );

  return { allTags: typedTags, filteredTags, collection };
}
