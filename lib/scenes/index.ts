// The scenes Haze can draw behind the window. Add one by writing a
// SceneDefinition and its id to SCENES in lib/model.ts.
import type { CustomScene, SceneId } from "../model";
import { cloudDrift } from "./cloud-drift";
import { themeExamples } from "./theme-examples";
import type { SceneDefinition } from "./types";

export type { SceneDefinition, SceneInstance } from "./types";

export const SCENE_LIST: SceneDefinition[] = [cloudDrift, ...themeExamples];

const customDefinitions = new Map<string, SceneDefinition>();

export function customSceneDefinition(scene: CustomScene): SceneDefinition {
  const cached = customDefinitions.get(scene.id);
  if (cached) return cached;
  const definition: SceneDefinition = {
    kind: "svg", id: scene.id, label: scene.name,
    description: { light: "Your custom backdrop.", dark: "Your custom backdrop." },
    base: { light: "#f5f5f5", dark: "#161616" },
    scheme: scene.scheme, twin: null,
    source: async () => {
      const response = await fetch(`/api/v1/plugins/haze/http/custom-scene?id=${encodeURIComponent(scene.id)}`);
      if (!response.ok) throw new Error("The custom backdrop could not be loaded.");
      return response.text();
    },
  };
  customDefinitions.set(scene.id, definition);
  return definition;
}

export function sceneById(id: SceneId | null | undefined, customScenes: readonly CustomScene[] = []): SceneDefinition | null {
  const builtIn = SCENE_LIST.find((scene) => scene.id === id);
  if (builtIn) return builtIn;
  const custom = customScenes.find((scene) => scene.id === id);
  return custom ? customSceneDefinition(custom) : null;
}
