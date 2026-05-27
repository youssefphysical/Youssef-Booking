/**
 * Canonical definition of service-card Advanced Settings SliderRow controls.
 *
 * Each entry maps a schema field (the camelCase suffix stored on the
 * `settings` row and in the mobile JSONB blob) to the UI SliderRow
 * parameters rendered in ServiceCardEditor.
 *
 * ──── Schema coupling contract ───────────────────────────────────────────────
 * Every `schemaKey` here MUST exist as:
 *   - A top-level column `{cardKey}Image{PascalKey}` on the `settings` table
 *     (e.g.  schemaKey "positionX"  → personalTrainingImagePositionX)
 *   - A key in the `{cardKey}MobileSettings` JSONB column
 *     (e.g.  schemaKey "positionX"  → mob.positionX)
 *
 * When a field is removed from `shared/schema.ts`, remove it here too.
 * The automated tests in `tests/media-panel-sliders.*` will fail until
 * both the canonical list and the schema are consistent again.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface ServiceCardSliderField {
  schemaKey: string;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
}

export const SERVICE_CARD_SLIDER_FIELDS: readonly ServiceCardSliderField[] = [
  { schemaKey: "positionX", label: "Position X",   min: 0,   max: 100, step: 1,    unit: "%" },
  { schemaKey: "positionY", label: "Position Y",   min: 0,   max: 100, step: 1,    unit: "%" },
  { schemaKey: "zoom",      label: "Zoom",         min: 0.5, max: 3,   step: 0.01, unit: ""  },
  { schemaKey: "radius",    label: "Corner radius",min: 0,   max: 50,  step: 1,    unit: "px"},
] as const;

/** The ordered slider labels, derived from the canonical field list above. */
export const SERVICE_CARD_SLIDER_LABELS: readonly string[] =
  SERVICE_CARD_SLIDER_FIELDS.map((f) => f.label);

/**
 * The schema column name suffix for a given slider schemaKey.
 * e.g. "positionX" → "PositionX" → column is `{prefix}Image${suffix}`
 */
export function toSchemaColumnSuffix(schemaKey: string): string {
  return schemaKey.charAt(0).toUpperCase() + schemaKey.slice(1);
}
