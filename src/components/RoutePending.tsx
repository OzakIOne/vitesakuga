import { CardGridSkeleton } from "./LoadingSkeletons";

export function RoutePending() {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-8">
      <CardGridSkeleton count={6} />
    </section>
  );
}
