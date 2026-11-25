interface FighterEntry {
  slug: string;
  name: string;
  version: string;
  manifestHash: string;
}

interface FighterPackage {
  entry: FighterEntry;
  manifest: Record<string, unknown>;
  view: Record<string, unknown>;
  effects: Record<string, unknown>;
  solid: unknown;
  fx: unknown;
  nodes: Map<string, unknown>;
  materials: Map<string, unknown>;
  dispose(): void;
}

interface LoadedFighterPackage extends FighterPackage {
  urls: string[];
  bytes: number;
}

interface FighterPackageOptions {
  read?: (slug: string, name: string, signal?: AbortSignal) => ArrayBuffer | Uint8Array | Promise<ArrayBuffer | Uint8Array>;
  makeAbort?: () => Pick<AbortController, 'signal' | 'abort'>;
  skipTextures?: boolean;
  allowTextureFallback?: boolean;
  pilotIds?: readonly string[];
  objectLoader?: { parseAsync(scene: object): Promise<unknown> };
  assetBase?: string | URL;
  assetBytes?: {
    createAssetBytesUrl(bytes: ArrayBuffer, mimeType: string): string;
    createVerifiedAssetBytesUrl?(bytes: ArrayBuffer, mimeType: string, sha256: string): string;
    revokeAssetBytesUrl(url: string): void;
  };
}

export const PILOT_FIGHTERS: Readonly<Record<string, string>>;
export const FIGHTER_CATALOG: readonly FighterEntry[];
export function fighterForPilot(pilotId: string): FighterEntry | undefined;
export function isFighterPackageReady(pilotId: string): boolean;
export function loadFighterPackages(options?: FighterPackageOptions): Promise<LoadedFighterPackage[]>;
export function createFighterPackageSelection(options: FighterPackageOptions): {
  load(pilotId: string, overrides?: Pick<FighterPackageOptions, 'allowTextureFallback'>): Promise<LoadedFighterPackage>;
  release(): void;
};
export function instantiateFighterPackage(pilotId: string): FighterPackage;
