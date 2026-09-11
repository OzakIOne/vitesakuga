import { useSuspenseQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  Link,
  Outlet,
  useRouterState,
} from "@tanstack/react-router";
import { Schema } from "effect";
import { ContributorProfile } from "src/components/ContributorProfile";
import { NotFound } from "src/components/NotFound";
import { PostsPageLayout } from "src/components/PostsPageLayout";
import { Box } from "src/components/ui/layout";
import {
  TABS_LIST_BASE,
  TABS_TRIGGER_BASE,
  TABS_TRIGGER_SELECTED,
} from "src/components/ui/tabs";
import { cn } from "src/components/ui/ui-utils";
import { UserErrorComponent } from "src/components/UserError";
import { VirtualPostsGrid } from "src/components/VirtualPostsGrid";
import { usePostsInfiniteScroll } from "src/lib/posts/posts.hooks";
import { searchPostsBaseSchema } from "src/lib/posts/posts.schema";
import { rethrowRouteDataError } from "src/lib/router/not-found";
import {
  contributorProfileQueryOptions,
  userPostsInfiniteQueryOptions,
} from "src/lib/users/users.queries";
import { seo } from "src/utils/seo";

export const Route = createFileRoute("/users/$id")({
  component: UserLayoutComponent,
  errorComponent: UserErrorComponent,
  validateSearch: Schema.toStandardSchemaV1(searchPostsBaseSchema),
  notFoundComponent: () => <NotFound>User not found</NotFound>,
  loader: async ({ context, params }) => {
    try {
      return await context.queryClient.query({
        ...contributorProfileQueryOptions(params.id),
        staleTime: "static",
      });
    } catch (error) {
      rethrowRouteDataError(error);
    }
  },
  head: ({ loaderData }) => ({
    meta: seo({
      description: loaderData
        ? `Browse posts, playlists, and contributions from ${loaderData.name} on ViteSakuga.`
        : "Public contributor profile on ViteSakuga.",
      title: loaderData
        ? `${loaderData.name} (@${loaderData.username}) · ViteSakuga`
        : "Contributor · ViteSakuga",
    }),
  }),
});

function UserContent() {
  const { id } = Route.useParams();
  const searchParams = Route.useSearch();
  const { sortBy, dateRange, tags, q } = searchParams;
  const chronologicalSearchParams = {
    ...searchParams,
    randomSeed: 0,
    view: "chronological" as const,
  };

  const {
    allPosts,
    anchorPostIndex,
    anchorScrollKey,
    fetchNextPage,
    fetchPreviousPage,
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
        discoveryView="chronological"
        fromRoute="/users/$id"
        popularTags={popularTags}
        searchQuery={q}
        selectedTags={tags}
        showDiscoveryViews={false}
        sortBy={sortBy}
      >
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
          searchParams={chronologicalSearchParams}
          syncPageToUrl={syncPageToUrl}
        />
      </PostsPageLayout>
    </Box>
  );
}

function UserLayoutComponent() {
  const { id } = Route.useParams();
  const { data: profile } = useSuspenseQuery(
    contributorProfileQueryOptions(id),
  );
  const hasChildRoute = useRouterState({
    select: (state) =>
      state.matches.some(
        (match) =>
          match.routeId !== Route.id &&
          match.routeId.startsWith(`${Route.id}/`),
      ),
  });

  return (
    <>
      <Box p={4} pb={0}>
        <ContributorProfile profile={profile} />
        <nav aria-label="Profile sections">
          <div className={TABS_LIST_BASE}>
            <Link
              activeOptions={{ exact: true }}
              activeProps={{
                className: cn(TABS_TRIGGER_BASE, TABS_TRIGGER_SELECTED),
              }}
              className={TABS_TRIGGER_BASE}
              params={{ id }}
              resetScroll={false}
              to="/users/$id"
            >
              Posts
            </Link>
            <Link
              activeProps={{
                className: cn(TABS_TRIGGER_BASE, TABS_TRIGGER_SELECTED),
              }}
              className={TABS_TRIGGER_BASE}
              params={{ id }}
              resetScroll={false}
              to="/users/$id/playlists"
            >
              Playlists
            </Link>
          </div>
        </nav>
      </Box>

      {hasChildRoute ? <Outlet /> : <UserContent />}
    </>
  );
}
