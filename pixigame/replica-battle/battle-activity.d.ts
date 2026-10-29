export function createBattleActivity(options: {
  page?: Document;
  host?: Window;
  allowParentFocus?: boolean;
  suspend: () => void;
  refresh?: () => void;
  blocked?: () => boolean;
  signal?: AbortSignal;
}): {enforce: () => boolean; frameDelta: (milliseconds: number) => number; destroy: () => void};
