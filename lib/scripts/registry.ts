// Registre de tous les scripts. Pour en ajouter un : l'écrire dans un fichier
// de lot et l'ajouter ici.
import { STRUCTURE_SCRIPTS } from "./lot1-structure";
import { PERFORMANCE_SCRIPTS } from "./lot1-performance";
import type { ScriptDef } from "./types";

export const SCRIPTS: ScriptDef[] = [...STRUCTURE_SCRIPTS, ...PERFORMANCE_SCRIPTS];

export function getScript(id: string): ScriptDef | undefined {
  return SCRIPTS.find((s) => s.id === id);
}
