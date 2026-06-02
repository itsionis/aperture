import { describe, expect, it } from 'vitest';
import { characterShipSchema, normalizeShipName } from '@/lib/esi/decoders/ship';

describe('normalizeShipName', () => {
  it('decodes the ESI Python-repr form back to real Unicode', () => {
    // The exact shape reported from the field: Thai digits + ASCII tail.
    expect(normalizeShipName("u'\\u0e53\\u0ed0\\u0e96 ScannaScanna'")).toBe(
      '๓໐ຖ ScannaScanna',
    );
  });

  it('handles double-quoted repr wrappers', () => {
    expect(normalizeShipName('u"\\u00e9clair"')).toBe('éclair');
  });

  it('decodes \\x byte and \\U code-point escapes', () => {
    expect(normalizeShipName("u'caf\\xe9'")).toBe('café');
    expect(normalizeShipName("u'\\U0001f680 launch'")).toBe('\u{1f680} launch');
  });

  it('decodes simple backslash escapes', () => {
    expect(normalizeShipName("u'a\\tb\\\\c\\'d'")).toBe("a\tb\\c'd");
  });

  it('passes well-formed ASCII names through untouched', () => {
    expect(normalizeShipName('Speedy Boi')).toBe('Speedy Boi');
  });

  it('does not treat an ordinary name starting with u as a repr', () => {
    expect(normalizeShipName('undocked')).toBe('undocked');
  });
});

describe('characterShipSchema', () => {
  it('normalizes ship_name during decode', () => {
    const parsed = characterShipSchema.parse({
      ship_type_id: 11176,
      ship_item_id: 1000000000001,
      ship_name: "u'\\u0e53\\u0ed0\\u0e96 ScannaScanna'",
    });
    expect(parsed.ship_name).toBe('๓໐ຖ ScannaScanna');
  });
});
