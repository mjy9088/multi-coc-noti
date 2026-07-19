export function upstreamFor(pathname: string, dashboard: string, collector: string): string {
  if (pathname === "/api/auth" || pathname.startsWith("/api/auth/")) return dashboard;
  if (pathname === "/health") return collector;
  return pathname === "/api" || pathname.startsWith("/api/") ? collector : dashboard;
}
