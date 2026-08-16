import {
  createFileRoute,
  Outlet,
  useRouterState,
} from "@tanstack/react-router";
import { NotFound } from "src/components/NotFound";
import { PostsPageLayout } from "src/components/PostsPageLayout";
import { Box } from "src/components/ui/layout";
import { User } from "src/components/User";
import { UserErrorComponent } from "src/components/UserError";
import { VirtualPostsGrid } from "src/components/VirtualPostsGrid";
import { toStandardSchemaV1Strict } from "src/lib/effect/schema.utils";
import { usePostsInfiniteScroll } from "src/lib/posts/posts.hooks";
import { searchPostsBaseSchema } from "src/lib/posts/posts.schema";
import { userPostsInfiniteQueryOptions } from "src/lib/users/users.queries";

export const Route = createFileRoute("/users/$id")({
  component: UserLayoutComponent,
  errorComponent: UserErrorComponent,
  notFoundComponent: () => <NotFound>User not found</NotFound>,
  validateSearch: toStandardSchemaV1Strict(searchPostsBaseSchema),
  ssr: "data-only",
});

function UserContent() {
  const { id } = Route.useParams();
  const searchParams = Route.useSearch();
  const { sortBy, dateRange, tags, q } = searchParams;

  const {
    allPosts,
    anchorPostIndex,
    anchorScrollKey,
    fetchNextPage,
    fetchPreviousPage,
    firstPage,
    hasNextPage,
    hasPreviousPage,
    isFetchingNextPage,
    isFetchingPreviousPage,
    pageParams,
    pageSize,
    popularTags,
    syncPageToUrl,
  } = usePostsInfiniteScroll(
    "/users/$id",
    userPostsInfiniteQueryOptions({
      page: searchParams.page,
      q,
      tags,
      userId: id,
    }),
  );

  return (
    <Box p={4}>
      <PostsPageLayout
        dateRange={dateRange}
        fromRoute="/users/$id"
        popularTags={popularTags}
        searchQuery={q}
        selectedTags={tags}
        sortBy={sortBy}
      >
        {firstPage?.user && (
          <User
            id={firstPage.user.id}
            image={firstPage.user.image}
            name={firstPage.user.name}
          />
        )}

        <VirtualPostsGrid
          allPosts={allPosts}
          anchorPostIndex={anchorPostIndex}
          anchorScrollKey={anchorScrollKey}
          fetchNextPage={fetchNextPage}
          fetchPreviousPage={fetchPreviousPage}
          hasNextPage={hasNextPage}
          hasPreviousPage={hasPreviousPage}
          isFetchingNextPage={isFetchingNextPage}
          isFetchingPreviousPage={isFetchingPreviousPage}
          pageParams={pageParams}
          pageSize={pageSize}
          searchParams={searchParams}
          syncPageToUrl={syncPageToUrl}
        />
      </PostsPageLayout>
    </Box>
  );
}

function UserLayoutComponent() {
  const hasChildRoute = useRouterState({
    select: (state) =>
      state.matches.some(
        (match) =>
          match.routeId !== Route.id &&
          match.routeId.startsWith(`${Route.id}/`),
      ),
  });

  if (hasChildRoute) {
    return <Outlet />;
  }

  return <UserContent />;
}
