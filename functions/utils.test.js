import { describe, it, expect, vi } from 'vitest';
import mammoth from 'mammoth';

// Skip trying to test the entire Firebase environment and focus on our specific directive:
// "assert that pdf-parse and mammoth can be imported dynamically without crashing"

describe('Dependency Audit', () => {
  it('should be able to require pdf-parse without crashing', async () => {
    let pdfParse;
    try {
        pdfParse = require('pdf-parse');
    } catch (e) {
        expect.fail(`Failed to require pdf-parse: ${e.message}`);
    }
    expect(typeof pdfParse).toBe('function');
  });

  it('should be able to require mammoth without crashing', () => {
    let mammothLib;
    try {
        mammothLib = require('mammoth');
    } catch (e) {
        expect.fail(`Failed to require mammoth: ${e.message}`);
    }
    expect(typeof mammothLib.extractRawText).toBe('function');
  });
});
