export default function AirportsLoading() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
      <div className="h-9 w-full max-w-md animate-pulse rounded-md bg-muted" />
      <div className="h-64 w-full animate-pulse rounded-md bg-muted" />
    </div>
  );
}
