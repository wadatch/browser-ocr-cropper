import { useEffect, useState } from 'react';

export type Route = 'app' | 'help';

function parse(hash: string): Route {
  const cleaned = hash.replace(/^#\/?/, '');
  return cleaned === 'help' ? 'help' : 'app';
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash));
  useEffect(() => {
    const handler = () => setRoute(parse(window.location.hash));
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);
  return route;
}
