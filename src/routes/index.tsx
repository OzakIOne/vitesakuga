import { Button, Heading, HStack, Input, Stack } from "@chakra-ui/react";
import { useForm } from "@tanstack/react-form";
import { useDebouncer } from "@tanstack/react-pacer/debouncer";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const navigate = useNavigate();

  const form = useForm({
    defaultValues: {
      search: "",
    },
    onSubmit: ({ value }) => {
      const val = value.search.trim();
      if (!val) return;
      navigate({
        to: "/posts",
        search: { q: val },
      });
    },
  });

  const setDebouncedQuery = useDebouncer(
    (value: string) => {
      if (!value.trim()) return;
      navigate({
        to: "/posts",
        search: { q: value },
      });
    },
    {
      wait: 500,
      enabled: () => form.state.values.search.length > 2,
    },
  );

  return (
    <Stack
      width={"full"}
      align={"center"}
      // TODO remove calc hack shit
      minH="calc(100vh - 64px)"
      justify={"center"}
    >
      <Heading className="text-2xl font-bold mb-4">ViteSakuga</Heading>
      <HStack align={"center"}>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setDebouncedQuery.flush();
            await form.handleSubmit();
          }}
          className="mb-4 flex gap-2"
        >
          <form.Field name="search">
            {(field) => (
              <Input
                className="input flex-1"
                type="text"
                placeholder="Search..."
                value={field.state.value}
                onChange={(e) => {
                  const val = e.target.value;
                  field.handleChange(val);
                  setDebouncedQuery.maybeExecute(val);
                }}
              />
            )}
          </form.Field>
          <Button type="submit" className="btn btn-primary">
            Search
          </Button>
        </form>
      </HStack>
    </Stack>
  );
}
