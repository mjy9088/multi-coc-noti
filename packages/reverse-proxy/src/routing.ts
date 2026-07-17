export function upstreamFor(pathname: string, dashboard: string, collector: string): string {
  return pathname === "/api" || pathname.startsWith("/api/") ? collector : dashboard;
}
