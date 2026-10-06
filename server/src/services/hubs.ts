import type { Hub, Region, StateCode } from '@hubcast/shared';

export interface HubFilter {
  region?: Region | undefined;
  state?: StateCode | undefined;
}

export function createHubsService(hubs: readonly Hub[]) {
  return {
    /** Hubs matching every given filter, in catalog order. */
    listHubs(filter: HubFilter = {}): Hub[] {
      return hubs.filter(
        (hub) =>
          (filter.region === undefined || hub.region === filter.region) &&
          (filter.state === undefined || hub.state === filter.state),
      );
    },

    getHubIds(): string[] {
      return hubs.map((hub) => hub.id);
    },
  };
}

export type HubsService = ReturnType<typeof createHubsService>;
