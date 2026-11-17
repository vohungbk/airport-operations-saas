import { PartnerDetailBackLink } from "@/features/partners/components/partner-detail-back-link";

interface PartnerFormPageHeaderProps {
  title: string;
  description: string;
}

/** The back link, the title and the one-line description above the create and edit forms. */
export function PartnerFormPageHeader({
  title,
  description,
}: PartnerFormPageHeaderProps) {
  return (
    <>
      <PartnerDetailBackLink />
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </>
  );
}
