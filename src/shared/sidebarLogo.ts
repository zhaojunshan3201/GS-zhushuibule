export type SidebarLogoState = {
  url: string;
  version: number;
};

export const applySidebarLogoUpdate = (state: SidebarLogoState, url: string): SidebarLogoState => ({
  url,
  version: state.version + 1,
});

export const applySidebarLogoLoad = (state: SidebarLogoState, requestVersion: number, url: string): SidebarLogoState => (
  state.version === requestVersion ? { ...state, url } : state
);

export const isCurrentSidebarLogoUpload = (requestId: number, latestRequestId: number) => requestId === latestRequestId;
