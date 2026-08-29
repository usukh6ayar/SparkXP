import { llmCostMicroUsd } from './llm-pricing';

describe('llmCostMicroUsd', () => {
  it('prices a Gemini Flash turn from its own rate, not Claude\'s', () => {
    // 1000 in @ $0.30/M + 500 out @ $2.50/M = 300 + 1250 microUSD
    expect(llmCostMicroUsd('gemini-2.5-flash', 1000, 500)).toBe(1550);
  });

  it('matches the longest model prefix, not the first plausible one', () => {
    // -lite is cheaper than plain flash; a naive startsWith order gets this wrong
    expect(llmCostMicroUsd('gemini-2.5-flash-lite', 1000, 1000)).toBe(500);
  });

  it('handles dated model ids', () => {
    expect(llmCostMicroUsd('claude-haiku-4-5-20251001', 1000, 1000)).toBe(6000);
  });

  it('charges an unknown model a non-zero rate', () => {
    // A model that looks free would silently disable every cost/limit warning.
    expect(llmCostMicroUsd('some-new-model', 1000, 1000)).toBeGreaterThan(0);
  });
});
