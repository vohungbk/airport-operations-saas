import { StandalonePage } from "@/components/shared/standalone-page";

export default function Home() {
  return (
    <StandalonePage className="items-center justify-center gap-3 bg-background px-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Airport Operations SaaS
      </h1>
      <p className="text-sm text-muted-foreground">
        Project foundation initialized successfully.
      </p>
    </StandalonePage>
  );
}
