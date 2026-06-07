import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/upload")({
  beforeLoad: ({ context, location }) => {
    if (!context.user) {
      throw redirect({
        search: { redirect: location.pathname },
        to: "/login",
      })
    }
    return { user: context.user }
  },
})
