import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Box } from "@chakra-ui/react";
import { NotFound } from "src/components/NotFound";
import { PostList } from "src/components/PostList";
import { User } from "src/components/User";
import { UserErrorComponent } from "src/components/UserError";
import { userQueryOptions } from "src/lib/users/users.queries";
import { PostsPageLayout } from "src/components/PostsPageLayout";
import { postSearchSchema } from "src/lib/posts/posts.schema";
import { useMemo } from "react";
import { filterAndSortPosts } from "src/lib/posts/posts.utils";

export const Route = createFileRoute("/users/$id")({
  validateSearch: postSearchSchema,
  loader: async ({ params: { id }, context }) => {
    await context.queryClient.ensureQueryData(userQueryOptions(id));
  },
  errorComponent: UserErrorComponent,
  component: UserComponent,
  notFoundComponent: () => {
    return <NotFound>User not found</NotFound>;
  },
});

function UserComponent() {
  const { id } = Route.useParams();
  const data = useSuspenseQuery(userQueryOptions(id));
  const { sortBy, dateRange } = Route.useSearch();

  const filteredPosts = useMemo(() => {
    return filterAndSortPosts(data.data.posts, {
      sortBy,
      dateRange,
    });
  }, [data.data.posts, sortBy, dateRange]);

  return (
    <Box p={4}>
      <PostsPageLayout
        searchQuery={undefined}
        popularTags={data.data.popularTags}
        sortBy={sortBy}
        dateRange={dateRange}
        fromRoute="/users/$id"
      >
        <User
          name={data.data.user.name}
          image={data.data.user.image}
          id={data.data.user.id}
        />

        <div className="flex flex-wrap gap-4">
          {filteredPosts.map((post) => (
            <div
              key={post.id}
              className="flex-1 min-w-[250px] max-w-sm border rounded-lg p-4 shadow hover:shadow-md transition"
            >
              <PostList post={post} q={undefined} pageSize={undefined} />
            </div>
          ))}
        </div>
      </PostsPageLayout>
    </Box>
  );
}
