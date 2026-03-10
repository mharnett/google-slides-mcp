import { describe, it, expect } from 'vitest';
import { tools } from './tools.js';

const EXPECTED_TOOL_NAMES = [
  'create_presentation',
  'get_presentation',
  'batch_update_presentation',
  'get_page',
  'summarize_presentation',
];

describe('tools contract', () => {
  it('exports exactly the expected tool names', () => {
    const names = tools.map((t) => t.name);
    expect(names).toEqual(EXPECTED_TOOL_NAMES);
  });

  it('every tool has a description', () => {
    for (const tool of tools) {
      expect(tool.description, `${tool.name} missing description`).toBeTruthy();
    }
  });

  it('every tool inputSchema.type is "object" with properties', () => {
    for (const tool of tools) {
      expect(tool.inputSchema.type, `${tool.name} inputSchema.type`).toBe('object');
      expect(tool.inputSchema.properties, `${tool.name} missing properties`).toBeDefined();
      expect(
        Object.keys(tool.inputSchema.properties as Record<string, unknown>).length,
        `${tool.name} has no properties`,
      ).toBeGreaterThan(0);
    }
  });

  it('all required fields exist in properties', () => {
    for (const tool of tools) {
      const properties = tool.inputSchema.properties as Record<string, unknown>;
      const required = (tool.inputSchema as { required?: string[] }).required ?? [];
      for (const field of required) {
        expect(properties[field], `${tool.name} required field "${field}" not in properties`).toBeDefined();
      }
    }
  });
});
