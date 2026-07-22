const landingPageIds = ["home", "dynamic-analysis", "well-history", "water-cut"] as const;

export type LandingSystemPage = (typeof landingPageIds)[number];

export function getPageFromSearch(search: string): LandingSystemPage {
  const page = new URLSearchParams(search).get("page");
  return landingPageIds.includes(page as LandingSystemPage) ? page as LandingSystemPage : "home";
}
