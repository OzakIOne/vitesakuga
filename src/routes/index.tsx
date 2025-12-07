import { Heading, Stack } from "@chakra-ui/react";
import { createFileRoute } from "@tanstack/react-router";
import { SearchBox } from "src/components/SearchBox";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <Stack
      width={"full"}
      align={"center"}
      // TODO remove calc hack shit
      minH="calc(100vh - 64px)"
      justify={"center"}
    >
      <Heading className="text-2xl font-bold mb-4">ViteSakuga</Heading>
      <SearchBox showTitle={false} placeholder="One piece..." />
    </Stack>
  );
}
