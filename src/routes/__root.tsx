import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { YEET_SITE, YEET_VERSION } from "@/lib/yeet/version";
import appCss from "../styles.css?url";

const TITLE = "YEET - Timeline Stress Reliever";
const DESC =
  "Yeet your worries in a 2D physics playground. Soft mode, chaos mode, daily challenges. Built for the Timeline.";

const JSON_LD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "YEET",
  url: YEET_SITE,
  applicationCategory: "GameApplication",
  operatingSystem: "Web",
  softwareVersion: YEET_VERSION,
  description: DESC,
});

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover",
      },
      { name: "description", content: DESC },
      { name: "theme-color", content: "#07080a" },
      { name: "application-name", content: "YEET" },
      { name: "generator", content: `YEET ${YEET_VERSION}` },
      { title: TITLE },
      { property: "og:type", content: "website" },
      { property: "og:url", content: YEET_SITE },
      { property: "og:site_name", content: "yeet.grok.me" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESC },
      { name: "twitter:url", content: YEET_SITE },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "canonical", href: YEET_SITE },
    ],
  }),
  component: RootDocument,
});

function RootDocument() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON_LD }} />
      </head>
      <body>
        <Outlet />
        <Scripts />
      </body>
    </html>
  );
}
