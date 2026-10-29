export const DEVELOPER_SKILLS_KEY: string;
export function developerSkillsEnabled(storage?: Pick<Storage, "getItem">): boolean;
export function setDeveloperSkillsEnabled(enabled: boolean, storage?: Pick<Storage, "setItem" | "getItem">): void;
