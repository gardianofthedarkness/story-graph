// What a program built on story-graph runs after a cast review saves the cast (merges made, people kept apart): a world
// engine settles its 3D figures there, for one. Each hook's failure is its own; the review goes on.
import type { CastFile, CastScope } from "./cast.js";

export type AfterCastSaved = (scope: Pick<CastScope, "root" | "universeId">, cast: CastFile) => Promise<unknown>;
export const castHooks: { afterCastSaved: AfterCastSaved[] } = { afterCastSaved: [] };
