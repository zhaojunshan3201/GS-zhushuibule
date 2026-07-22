export function isAetheraLandingLocation(pathname: string, search: string) {
  return (pathname === '/' || pathname === '/aethera') && !new URLSearchParams(search).has('page');
}
