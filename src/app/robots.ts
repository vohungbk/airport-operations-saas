import type { MetadataRoute } from "next";

/**
 * The whole app is a private workspace behind sign-in, so crawlers are asked to stay out of every
 * path. The root layout also sets `noindex`, which covers a crawler that ignores this file.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
