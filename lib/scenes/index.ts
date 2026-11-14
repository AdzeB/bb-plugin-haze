// The scenes Haze can draw behind the window. Add one by writing a
// SceneDefinition and its id to SCENES in lib/model.ts.
import type { SceneId } from "../model";
import { cloudDrift } from "./cloud-drift";
import type { SceneDefinition } from "./types";

export type { SceneDefinition, SceneInstance } from "./types";

export const SCENE_LIST: SceneDefinition[] = [cloudDrift];

export function sceneById(id: SceneId | null | undefined): SceneDefinition | null {
  return SCENE_LIST.find((scene) => scene.id === id) ?? null;
}
