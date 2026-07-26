/**
 * M9 — the shared registration engine. schemaFromFields turns a field spec into validation;
 * the same spec drives the form, so they can't drift. Proves each entity's rules + that a
 * hypothetical 4th entity needs only a config entry (exit criterion).
 */
import { ENTITIES, type Field } from "@/features/registration/entities";
import { schemaFromFields } from "@/features/registration/schema";

const _same = schemaFromFields;

// entities.ts pulls the api chain (client → env); env throws without a URL in test.
jest.mock("@/lib/env", () => ({ env: { apiUrl: "https://api.test", appEnv: "test" } }));

describe("schemaFromFields", () => {
  test("required text rejects empty, trims, and accepts", () => {
    const s = schemaFromFields([{ key: "name", label: "Name", type: "text", required: true }]);
    expect(s.safeParse({ name: "" }).success).toBe(false);
    expect(s.safeParse({ name: "  Arjun " }).success).toBe(true);
  });

  test("number coerces strings and enforces min/max", () => {
    const s = schemaFromFields([{ key: "age", label: "Age", type: "number", required: true, min: 3, max: 18 }]);
    const ok = s.safeParse({ age: "10" });
    expect(ok.success && ok.data.age).toBe(10);
    expect(s.safeParse({ age: "2" }).success).toBe(false);
    expect(s.safeParse({ age: "40" }).success).toBe(false);
  });

  test("select only accepts its options", () => {
    const s = schemaFromFields([
      { key: "type", label: "Type", type: "select", required: true, options: ["Individual", "Team"] },
    ]);
    expect(s.safeParse({ type: "Team" }).success).toBe(true);
    expect(s.safeParse({ type: "Squad" }).success).toBe(false);
  });

  test("optional field may be omitted", () => {
    const s = schemaFromFields([{ key: "note", label: "Note", type: "text" }]);
    expect(s.safeParse({}).success).toBe(true);
  });
});

describe("entity registry", () => {
  const kinds = Object.keys(ENTITIES) as (keyof typeof ENTITIES)[];

  test("every entity's field spec builds a working schema", () => {
    for (const k of kinds) {
      const s = schemaFromFields(ENTITIES[k].fields as Field[]);
      expect(s.safeParse({}).success).toBe(false); // required fields present
    }
  });

  test("camp validates a complete child registration", () => {
    const s = schemaFromFields(ENTITIES.camp.fields as Field[]);
    const r = s.safeParse({ childName: "Kid", childAge: "9", phone: "9876543210" });
    expect(r.success).toBe(true);
  });

  test("adding a 4th entity is one config entry — same engine validates it", () => {
    const fourth: Field[] = [
      { key: "squadName", label: "Squad", type: "text", required: true },
      { key: "size", label: "Size", type: "number", required: true, min: 1, max: 11 },
    ];
    const s = _same(fourth); // no new engine code, just a new field list
    expect(s.safeParse({ squadName: "A", size: "5" }).success).toBe(true);
    expect(s.safeParse({ squadName: "", size: "5" }).success).toBe(false);
  });
});
