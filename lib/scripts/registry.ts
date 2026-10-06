// Registre de tous les scripts. Pour en ajouter un : l'écrire dans un fichier
// de lot et l'ajouter ici.
import { STRUCTURE_SCRIPTS } from "./lot1-structure";
import { PERFORMANCE_SCRIPTS } from "./lot1-performance";
import { LOT2_SCRIPTS } from "./lot2";
import { LOT3_SCRIPTS } from "./lot3";
import type { ScriptDef } from "./types";

export const SCRIPTS: ScriptDef[] = [...STRUCTURE_SCRIPTS, ...PERFORMANCE_SCRIPTS, ...LOT2_SCRIPTS, ...LOT3_SCRIPTS];

export function getScript(id: string): ScriptDef | undefined {
  return SCRIPTS.find((s) => s.id === id);
}
