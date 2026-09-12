import { z } from "zod";

type JsonObject = Record<string, unknown>;

/**
 * Converts a zod schema into the JSON Schema dialect OpenAI accepts for strict
 * Structured Outputs (`response_format: { type: "json_schema", strict: true }`).
 *
 * Strict mode rejects a few keywords zod emits, so this pass:
 * - drops minLength/maxLength/minItems/maxItems, keeping them as a description
 *   hint so the model still knows the intended size (zod re-checks them after
 *   parsing);
 * - rewrites `const` to a single-value `enum` and `oneOf` to `anyOf`;
 * - forces every object to list all of its properties as required with
 *   `additionalProperties: false`.
 */
export function toOpenAiStrictSchema(schema: z.ZodType): JsonObject {
  const raw = z.toJSONSchema(schema, { target: "draft-7", unrepresentable: "any" }) as JsonObject;
  return strictify(raw) as JsonObject;
}

const HINTS: Record<string, string> = {
  minLength: "min %s characters",
  maxLength: "max %s characters",
  minItems: "min %s items",
  maxItems: "max %s items",
};

function strictify(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(strictify);
  if (!node || typeof node !== "object") return node;
  const out: JsonObject = {};
  const hints: string[] = [];
  for (const [key, value] of Object.entries(node as JsonObject)) {
    if (key in HINTS) {
      hints.push(HINTS[key].replace("%s", String(value)));
      continue;
    }
    if (key === "const") {
      out.enum = [value];
      continue;
    }
    if (key === "oneOf") {
      out.anyOf = strictify(value);
      continue;
    }
    if (key === "$schema" || key === "default" || key === "examples") continue;
    out[key] = strictify(value);
  }
  if (out.type === "object" && out.properties && typeof out.properties === "object") {
    out.required = Object.keys(out.properties as JsonObject);
    out.additionalProperties = false;
  }
  if (hints.length) {
    const existing = typeof out.description === "string" ? out.description : "";
    out.description = existing ? `${existing} (${hints.join(", ")})` : hints.join(", ");
  }
  return out;
}
