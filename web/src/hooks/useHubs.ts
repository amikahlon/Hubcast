import type { Hub } from '@hubcast/shared';
import { useEffect, useState } from 'react';
import { fetchHubs } from '../api.js';

/** Hubs by ID, for readable names. Stays empty if the list cannot be loaded. */
export function useHubs(): ReadonlyMap<string, Hub> {
  const [hubs, setHubs] = useState<ReadonlyMap<string, Hub>>(new Map());

  useEffect(() => {
    const controller = new AbortController();
    fetchHubs(controller.signal)
      .then((list) => setHubs(new Map(list.map((hub) => [hub.id, hub]))))
      .catch(() => undefined); // Chips fall back to the hub ID.
    return () => controller.abort();
  }, []);

  return hubs;
}
