import {
  createFileRoute,
  Link,
  Outlet,
  useRouterState,
} from "@tanstack/react-router";
import { NotFound } from "src/components/NotFound";
import { PostsPageLayout } from "src/components/PostsPageLayout";
import { Box } from "src/components/ui/layout";
import { Tabs } from "src/components/ui/tabs";
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
  const { id } = Route.useParams();
  const { activeTab, hasChildRoute } = useRouterState({
    select: (state) => ({
      activeTab: state.matches.some(
        (match) => match.routeId.startsWith(`${Route.id}/playlists`),
      )
        ? "playlists"
        : "posts",
      hasChildRoute: state.matches.some(
        (match) =>
          match.routeId !== Route.id &&
          match.routeId.startsWith(`${Route.id}/`),
      ),
    }),
  });

  return (
    <>
      <Box p={4} pb={0}>
        <Tabs.Root
          // The triggers are TanStack Router Links that already perform SPA
          // navigation. Ark's default `navigate` re-dispatches a
          // non-cancelable click on the anchor, which makes the browser
          // follow the href and reload the page. Disable it so tab switches
          // stay client-side.
          navigate={() => {}}
          value={activeTab}
        >
          <Tabs.List>
            <Tabs.Trigger asChild value="posts">
              <Link params={{ id }} resetScroll={false} to="/users/$id">
                Posts
              </Link>
            </Tabs.Trigger>
            <Tabs.Trigger asChild value="playlists">
              <Link
                params={{ id }}
                resetScroll={false}
                to="/users/$id/playlists"
              >
                Playlists
              </Link>
            </Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
      </Box>

      {hasChildRoute ? <Outlet /> : <UserContent />}
    </>
  );
}
