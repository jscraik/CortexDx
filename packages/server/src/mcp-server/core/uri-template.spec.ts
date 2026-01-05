/**
 * URI Template validation and matching tests
 */

import { describe, it, expect } from 'vitest';
import {
  validateUriTemplate,
  extractTemplateParameters,
  matchUriTemplate,
  matchesAnyTemplate,
  buildUriFromTemplate,
} from './uri-template.js';

describe('validateUriTemplate', () => {
  it('should accept valid simple templates', () => {
    const result = validateUriTemplate('config://{section}/{key}');
    expect(result.valid).toBe(true);
    expect(result.parameters).toEqual(['section', 'key']);
  });

  it('should accept valid file templates', () => {
    const result = validateUriTemplate('file://path/{path}');
    expect(result.valid).toBe(true);
    expect(result.parameters).toEqual(['path']);
  });

  it('should accept valid http templates', () => {
    const result = validateUriTemplate('https://api.example.com/{resource}/{id}');
    expect(result.valid).toBe(true);
    expect(result.parameters).toEqual(['resource', 'id']);
  });

  it('should accept valid cortexdx scheme', () => {
    const result = validateUriTemplate('cortexdx://diagnostic/{id}');
    expect(result.valid).toBe(true);
    expect(result.parameters).toEqual(['id']);
  });

  it('should reject invalid scheme', () => {
    const result = validateUriTemplate('invalid://{param}');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('not supported');
  });

  it('should reject missing scheme', () => {
    const result = validateUriTemplate('{param}/value');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('must include a valid scheme');
  });

  it('should reject empty template', () => {
    const result = validateUriTemplate('');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('non-empty string');
  });

  it('should reject duplicate parameters', () => {
    const result = validateUriTemplate('config://{section}/{section}');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Duplicate');
  });

  it('should reject unmatched braces', () => {
    const result = validateUriTemplate('config://{section/{key}');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Unmatched');
  });

  it('should reject invalid parameter names', () => {
    const result = validateUriTemplate('config://{sec@tion}/{key}');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid parameter name');
  });
});

describe('extractTemplateParameters', () => {
  it('should extract simple parameters', () => {
    const params = extractTemplateParameters('config://{section}/{key}');
    expect(params).toEqual(['section', 'key']);
  });

  it('should handle path expansion', () => {
    const params = extractTemplateParameters('resource:///path/{/var}');
    expect(params).toContain('var');
  });

  it('should handle query expansion', () => {
    const params = extractTemplateParameters('https://api.example.com{?query}');
    expect(params).toContain('query');
  });

  it('should deduplicate parameters', () => {
    const params = extractTemplateParameters('{var}/{var}');
    expect(params).toEqual(['var']);
  });
});

describe('matchUriTemplate', () => {
  it('should match simple URI patterns', () => {
    const result = matchUriTemplate('config://{section}/{key}', 'config://database/host');
    expect(result.matches).toBe(true);
    expect(result.parameters).toEqual({
      name_section: 'database',
      name_key: 'host',
    });
  });

  it('should not match non-matching URIs', () => {
    const result = matchUriTemplate('config://{section}/{key}', 'https://example.com');
    expect(result.matches).toBe(false);
  });

  it('should match file templates', () => {
    const result = matchUriTemplate('file://path/{path}', 'file://path/to/file.txt');
    expect(result.matches).toBe(true);
    expect(result.parameters).toEqual({
      name_path: 'to/file.txt',
    });
  });

  it('should match http templates', () => {
    const result = matchUriTemplate(
      'https://api.example.com/{resource}/{id}',
      'https://api.example.com/users/123'
    );
    expect(result.matches).toBe(true);
    expect(result.parameters).toEqual({
      name_resource: 'users',
      name_id: '123',
    });
  });
});

describe('matchesAnyTemplate', () => {
  it('should match against first valid template', () => {
    const templates = ['config://{section}/{key}', 'file://{path}', 'data://{id}'];
    const result = matchesAnyTemplate('config://database/host', templates);

    expect(result.matches).toBe(true);
    expect(result.template).toBe('config://{section}/{key}');
  });

  it('should match against later templates', () => {
    const templates = ['config://{section}/{key}', 'file://{path}', 'data://{id}'];
    const result = matchesAnyTemplate('data://user123', templates);

    expect(result.matches).toBe(true);
    expect(result.template).toBe('data://{id}');
  });

  it('should not match when no templates match', () => {
    const templates = ['config://{section}/{key}', 'file://{path}'];
    const result = matchesAnyTemplate('https://example.com', templates);

    expect(result.matches).toBe(false);
    expect(result.template).toBeUndefined();
  });
});

describe('buildUriFromTemplate', () => {
  it('should build URI from simple template', () => {
    const uri = buildUriFromTemplate('config://{section}/{key}', {
      section: 'database',
      key: 'host',
    });
    expect(uri).toBe('config://database/host');
  });

  it('should build URI with path expansion', () => {
    const uri = buildUriFromTemplate('resource://{path}', {
      path: 'to/resource',
    });
    expect(uri).toBe('resource://to/resource');
  });

  it('should handle missing parameters gracefully', () => {
    const uri = buildUriFromTemplate('config://{section}/{key}', {
      section: 'database',
    });
    expect(uri).toBe('config://database/');
  });

  it('should build URI with query expansion', () => {
    const uri = buildUriFromTemplate('https://api.example.com{?query}', {
      query: 'search term',
    });
    expect(uri).toBe('https://api.example.com?query=search%20term');
  });
});
