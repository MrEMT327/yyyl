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
  read?: (slug: string, name: string) => ArrayBuffer | Uint8Array | Promise<ArrayBuffer | Uint8Array>;
  skipTextures?: boolean;
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
export function instantiateFighterPackage(pilotId: string): FighterPackage;
