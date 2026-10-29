export interface ProjectInterfaceSprite {
  url: string;
}

/** Existing sprite metadata is preserved; presentation URLs may be replaced. */
export type ProjectInterfaceSprites<T extends Readonly<Record<string, ProjectInterfaceSprite>>> = {
  [K in keyof T]: Omit<T[K], 'url'> & ProjectInterfaceSprite;
} & Record<string, ProjectInterfaceSprite>;

export function projectBattleInterfaceIcon(key: string): string | null;
export function createProjectInterfaceSprites<T extends Readonly<Record<string, ProjectInterfaceSprite>>>(sprites: T): ProjectInterfaceSprites<T>;
