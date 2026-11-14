import Link from "next/link";

interface PhotoViewerHeaderProps {
  /** The ways back: `← Back to record`, `Back to seat history`. Only the ones the user may use. */
  links?: readonly { label: string; href: string }[];
  /** The line under the title: what the photos belong to. */
  subtitle?: string;
  /** The small line under it: the photo count, or `Loading photos...`. */
  note?: string;
}

/** The top of every state of the Photo viewer: the links back, the title and what the photos belong to. */
export function PhotoViewerHeader({ links = [], subtitle, note }: PhotoViewerHeaderProps) {
  return (
    <div className="flex flex-col gap-2">
      {links.length > 0 && (
        <nav aria-label="Back" className="flex flex-wrap gap-x-8 gap-y-1 text-xs text-primary">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="hover:underline">
              {link.label}
            </Link>
          ))}
        </nav>
      )}
      <h1 className="text-2xl leading-8 font-semibold break-words text-primary-subtle-foreground">Photos</h1>
      {subtitle && <p className="text-sm text-text-muted">{subtitle}</p>}
      {note && <p className="text-xs text-text-muted">{note}</p>}
    </div>
  );
}
