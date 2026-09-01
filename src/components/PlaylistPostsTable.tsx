import { Link } from "@tanstack/react-router";
import {
  columnSizingFeature,
  createColumnHelper,
  rowSelectionFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import type { OnChangeFn, RowSelectionState } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Spinner } from "src/components/ui/feedback";
import { Checkbox } from "src/components/ui/field";
import { HStack } from "src/components/ui/layout";
import { Image } from "src/components/ui/media";
import { Text } from "src/components/ui/typography";
import { assetUrl } from "src/lib/assets/url";
import { formatDateUtc } from "src/utils/date-format";

export type PlaylistPostTableRow = {
  postId: number;
  position: number;
  /** ISO timestamp strings — dates arrive as strings over the server-function transport. */
  addedAt: string;
  isOrphan: boolean;
  id: number | null;
  title: string | null;
  description: string | null;
  thumbnailKey: string | null;
  createdAt: string | null;
  userId: string | null;
  userName: string | null;
};

type PlaylistPostsTableProps = {
  rows: readonly PlaylistPostTableRow[];
  fetchNextPage: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onSelectionChange: (postIds: ReadonlySet<number>) => void;
  selectedPostIds: ReadonlySet<number>;
};

const ROW_ESTIMATE = 56;
const NEXT_BUFFER_ROWS = 10;

type TableColumnMeta = { grow?: boolean };

const features = tableFeatures({
  columnSizingFeature,
  // SAFETY: phantom type-only slot; the value is ignored at runtime, only the
  // declared type is used to type `columnDef.meta` for this table's columns.
  columnMeta: {} as TableColumnMeta,
  rowSelectionFeature,
});
type Features = typeof features;

const columnHelper = createColumnHelper<Features, PlaylistPostTableRow>();

// Keep static column config out of the render loop.
const columns = columnHelper.columns([
  columnHelper.display({
    id: "select",
    size: 44,
    header: ({ table }) => (
      <Checkbox.Root
        aria-label="Select all rows"
        checked={
          table.getIsAllPageRowsSelected()
            ? true
            : table.getIsSomePageRowsSelected()
              ? "indeterminate"
              : false
        }
        onCheckedChange={({ checked }) => {
          table.toggleAllPageRowsSelected(
            checked === "indeterminate" ? false : checked,
          );
        }}
      >
        <Checkbox.HiddenInput />
        <Checkbox.Control />
        <Checkbox.Indicator />
      </Checkbox.Root>
    ),
    cell: ({ row }) => {
      if (row.original.isOrphan) {
        return <span aria-hidden="true" />;
      }
      return (
        <Checkbox.Root
          aria-label={`Select row ${row.original.postId}`}
          checked={row.getIsSelected()}
          onCheckedChange={() => row.toggleSelected()}
        >
          <Checkbox.HiddenInput />
          <Checkbox.Control />
          <Checkbox.Indicator />
        </Checkbox.Root>
      );
    },
  }),
  columnHelper.accessor("title", {
    header: "Title",
    size: 340,
    cell: ({ row }) => {
      const item = row.original;
      if (item.isOrphan) {
        return (
          <Text color="gray.500" fontSize="sm">
            Post deleted
          </Text>
        );
      }
      return (
        <HStack gap={3} minW={0}>
          {item.thumbnailKey && (
            <Image
              alt=""
              className="h-12 w-20 shrink-0 rounded border border-gray-200 object-contain dark:border-gray-700"
              src={assetUrl(item.thumbnailKey)}
            />
          )}
          <Link
            className="min-w-0"
            params={{ postId: item.postId }}
            to="/posts/$postId"
          >
            <Text fontWeight="medium" lineClamp={2}>
              {item.title}
            </Text>
          </Link>
        </HStack>
      );
    },
  }),
  columnHelper.accessor("description", {
    header: "Description",
    meta: { grow: true },
    minSize: 240,
    size: 360,
    cell: ({ getValue }) => {
      const description = getValue();
      if (!description) return <Text color="gray.400">—</Text>;
      return (
        <Text color="gray.600" fontSize="sm" lineClamp={2}>
          {description}
        </Text>
      );
    },
  }),
  columnHelper.accessor("userName", {
    header: "Author",
    size: 160,
    cell: ({ row }) => {
      const item = row.original;
      if (item.isOrphan || !item.userName || !item.userId) {
        return <Text color="gray.400">—</Text>;
      }
      return (
        <Link className="min-w-0" params={{ id: item.userId }} to="/users/$id">
          <Text fontSize="sm" lineClamp={1}>
            {item.userName}
          </Text>
        </Link>
      );
    },
  }),
  columnHelper.accessor("addedAt", {
    header: "Date added",
    size: 150,
    cell: ({ getValue }) => (
      <Text color="gray.600" fontSize="sm">
        {formatDateUtc(getValue())}
      </Text>
    ),
  }),
]);

export function PlaylistPostsTable({
  rows,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  onSelectionChange,
  selectedPostIds,
}: PlaylistPostsTableProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // SAFETY: each entry pairs a stringified post id with the literal `true`,
  // so every value in the produced record is exactly `true` — the
  // RowSelectionState (Record<string, true>) shape.
  const rowSelection = useMemo<RowSelectionState>(
    () =>
      Object.fromEntries(
        [...selectedPostIds].map((id) => [String(id), true]),
      ) as RowSelectionState,
    [selectedPostIds],
  );
  const rowSelectionRef = useRef(rowSelection);
  rowSelectionRef.current = rowSelection;

  const handleRowSelectionChange: OnChangeFn<RowSelectionState> = useCallback(
    (updater) => {
      const next =
        updater instanceof Function
          ? updater(rowSelectionRef.current)
          : updater;
      onSelectionChange(new Set(Object.keys(next).map(Number)));
    },
    [onSelectionChange],
  );

  const table = useTable({
    columns,
    data: rows,
    features,
    getRowId: (row) => String(row.postId),
    onRowSelectionChange: handleRowSelectionChange,
    state: { rowSelection },
  });
  const { FlexRender } = table;

  const tableRows = table.getRowModel().rows;
  const virtualizer = useVirtualizer({
    count: tableRows.length,
    estimateSize: () => ROW_ESTIMATE,
    getItemKey: (index) => tableRows[index]?.id ?? index,
    getScrollElement: () => scrollRef.current,
    overscan: 6,
  });
  const virtualItems = virtualizer.getVirtualItems();

  useEffect(() => {
    const lastItem = virtualItems[virtualItems.length - 1];
    if (
      lastItem &&
      lastItem.index >= tableRows.length - NEXT_BUFFER_ROWS &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      fetchNextPage();
    }
  }, [
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    tableRows.length,
    virtualItems,
  ]);

  return (
    <div
      ref={scrollRef}
      className="h-full overflow-auto rounded-lg border border-gray-200 dark:border-gray-700"
    >
      {/* display:grid strips native table semantics; explicit roles restore them */}
      <table
        className="w-full text-sm"
        
        style={{ display: "grid" }}
      >
        <thead
          className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800"
          
          style={{ display: "grid" }}
        >
          {table.getHeaderGroups().map((group) => (
            <tr className="flex w-full" key={group.id} >
              {group.headers.map((header) => {
                const grow = header.column.columnDef.meta?.grow ?? false;
                return (
                  <th
                    className="flex items-center overflow-hidden border-b border-gray-200 px-3 py-2.5 text-left font-medium text-gray-700 dark:border-gray-700 dark:text-gray-200"
                    key={header.id}
                    
                    style={{
                      flex: grow ? "1 1 0%" : "0 0 auto",
                      minWidth: grow ? 0 : header.column.getSize(),
                      width: grow ? "auto" : header.column.getSize(),
                    }}
                  >
                    <span className="min-w-0 truncate">
                      {header.isPlaceholder ? null : (
                        <FlexRender header={header} />
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody
          className="relative"
          
          style={{
            display: "grid",
            height: `${virtualizer.getTotalSize()}px`,
          }}
        >
          {virtualItems.map((virtualRow) => {
            const row = tableRows[virtualRow.index];
            if (!row) return null;
            return (
              <tr
                className="absolute top-0 left-0 w-full border-b border-gray-100 transition-colors last:border-0 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/60"
                data-index={virtualRow.index}
                key={row.id}
                ref={virtualizer.measureElement}
                
                style={{
                  display: "flex",
                  position: "absolute",
                  transform: `translateY(${virtualRow.start}px)`,
                  width: "100%",
                }}
              >
                {row.getAllCells().map((cell) => {
                  const grow = cell.column.columnDef.meta?.grow ?? false;
                  return (
                    <td
                      className="flex min-w-0 items-center overflow-hidden px-3 py-2"
                      key={cell.id}
                      
                      style={{
                        flex: grow ? "1 1 0%" : "0 0 auto",
                        minWidth: grow ? 0 : cell.column.getSize(),
                        width: grow ? "auto" : cell.column.getSize(),
                      }}
                    >
                      <FlexRender cell={cell} />
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      {isFetchingNextPage && (
        <div className="flex items-center justify-center py-3">
          <Spinner size="sm" />
        </div>
      )}
      {!hasNextPage && tableRows.length > 0 && (
        <div className="py-3 text-center">
          <Text color="gray.500" fontSize="sm">
            End of playlist
          </Text>
        </div>
      )}
    </div>
  );
}
