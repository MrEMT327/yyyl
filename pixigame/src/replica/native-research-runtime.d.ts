import type research from './native-research-runtime.json';

export interface NativeResearchRuntimeInput {
  skillRows?: Readonly<Record<string, unknown>>;
  triggers?: Readonly<Record<string, unknown>>;
}

/** Research rows replace matching IDs; every other runtime field is retained. */
export type NativeResearchRuntime<T extends NativeResearchRuntimeInput> =
  Omit<T, 'skillRows' | 'triggers'> & {
    skillRows: Omit<NonNullable<T['skillRows']>, keyof typeof research.skillRows> & typeof research.skillRows;
    triggers: Omit<NonNullable<T['triggers']>, keyof typeof research.triggers> & typeof research.triggers;
  };

export function withNativeResearchRuntime<T extends NativeResearchRuntimeInput>(runtime: T): NativeResearchRuntime<T>;
