// Tests for analyzeResume: the rule score, the LLM merge, retries and fallbacks.
// The Gemini SDK is mocked so no real API calls are made.

const mockGenerate = jest.fn();

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: { generateContent: mockGenerate },
  })),
}));

const RESUME = `
Brandon Simon
brandon@example.com | github.com/brandon
Education: B.E. Computer Science
Skills: Python, React, Node.js
Experience
- Built a REST API serving 5000 users
- Developed a dashboard that reduced time by 40%
- Optimized queries cutting latency by 30%
- Led a team of 3 students
- Automated imports saving 10 hours per week
Projects
- Created a RAG platform with Python
`.repeat(3);

const llmJson = (overrides = {}) =>
  JSON.stringify({
    score: 70,
    summary: 'Solid student resume.',
    strengths: ['Clear projects'],
    weaknesses: ['Few metrics'],
    suggestions: [{ section: 'Experience', issue: 'Vague', fix: 'Add numbers' }],
    missing_keywords: ['Docker'],
    rewritten_bullets: [{ original: 'Did stuff', improved: 'Built stuff' }],
    ...overrides,
  });

// Loads a fresh copy of the analyzer so the GEMINI_API_KEY setting takes effect
function loadAnalyzer(withKey) {
  jest.resetModules();
  if (withKey) process.env.GEMINI_API_KEY = 'test-key';
  else delete process.env.GEMINI_API_KEY;
  delete process.env.LLM_MODEL;
  return require('../utils/analyzer');
}

beforeEach(() => {
  mockGenerate.mockReset();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('analyzeResume without an API key', () => {
  test('uses the rule score only and reports llmUsed false', async () => {
    const { analyzeResume, ruleChecks } = loadAnalyzer(false);
    const result = await analyzeResume(RESUME, '');
    expect(result.llmUsed).toBe(false);
    expect(result.llmScore).toBeNull();
    expect(result.atsScore).toBe(ruleChecks(RESUME, '').ruleScore);
    expect(mockGenerate).not.toHaveBeenCalled();
  });
});

describe('analyzeResume with a working LLM', () => {
  test('atsScore is 40% rule score plus 60% LLM score, rounded', async () => {
    const { analyzeResume, ruleChecks } = loadAnalyzer(true);
    mockGenerate.mockResolvedValue({ text: llmJson({ score: 70 }) });

    const result = await analyzeResume(RESUME, '');
    const ruleScore = ruleChecks(RESUME, '').ruleScore;
    expect(result.llmUsed).toBe(true);
    expect(result.llmScore).toBe(70);
    expect(result.atsScore).toBe(Math.round(0.4 * ruleScore + 0.6 * 70));
  });

  test('LLM score is clamped to 0-100', async () => {
    const { analyzeResume } = loadAnalyzer(true);
    mockGenerate.mockResolvedValue({ text: llmJson({ score: 250 }) });
    const result = await analyzeResume(RESUME, '');
    expect(result.llmScore).toBe(100);
  });

  test('non-numeric LLM score becomes 0', async () => {
    const { analyzeResume } = loadAnalyzer(true);
    mockGenerate.mockResolvedValue({ text: llmJson({ score: 'high' }) });
    const result = await analyzeResume(RESUME, '');
    expect(result.llmScore).toBe(0);
  });

  test('parses JSON wrapped in extra text (e.g. stray markdown fences)', async () => {
    const { analyzeResume } = loadAnalyzer(true);
    mockGenerate.mockResolvedValue({ text: 'Here you go:\n```json\n' + llmJson({ score: 55 }) + '\n```' });
    const result = await analyzeResume(RESUME, '');
    expect(result.llmScore).toBe(55);
  });

  test('suggestions without a fix are dropped; missing keywords are lowercased', async () => {
    const { analyzeResume } = loadAnalyzer(true);
    mockGenerate.mockResolvedValue({
      text: llmJson({
        suggestions: [
          { section: 'A', issue: 'x', fix: 'Do this' },
          { section: 'B', issue: 'y' },
        ],
        missing_keywords: ['Docker', 'AWS'],
      }),
    });
    const result = await analyzeResume(RESUME, '');
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0].fix).toBe('Do this');
    expect(result.missingKeywords).toEqual(expect.arrayContaining(['docker', 'aws']));
  });

  test('missing keywords from the LLM and the rules are merged without duplicates, max 15', async () => {
    const { analyzeResume } = loadAnalyzer(true);
    const llmKeywords = Array.from({ length: 12 }, (_, i) => `skill${i}`);
    mockGenerate.mockResolvedValue({ text: llmJson({ missing_keywords: [...llmKeywords, 'docker'] }) });
    const jd = 'Need kubernetes, terraform, docker and aws';
    const result = await analyzeResume(RESUME, jd);
    expect(result.missingKeywords.length).toBeLessThanOrEqual(15);
    expect(new Set(result.missingKeywords).size).toBe(result.missingKeywords.length);
  });

  test('sends the job description in the prompt when one is given', async () => {
    const { analyzeResume } = loadAnalyzer(true);
    mockGenerate.mockResolvedValue({ text: llmJson() });
    await analyzeResume(RESUME, 'Need Kubernetes experience');
    const sent = mockGenerate.mock.calls[0][0].contents;
    expect(sent).toContain('JOB DESCRIPTION:');
    expect(sent).toContain('Need Kubernetes experience');
  });

  test('truncates a very long resume to 12000 characters in the prompt', async () => {
    const { analyzeResume } = loadAnalyzer(true);
    mockGenerate.mockResolvedValue({ text: llmJson() });
    await analyzeResume('x'.repeat(20000), '');
    const sent = mockGenerate.mock.calls[0][0].contents;
    expect(sent.length).toBeLessThan(12000 + 200);
  });
});

describe('analyzeResume: LLM failures fall back to rule score', () => {
  test('malformed JSON from the LLM falls back to the rule score', async () => {
    const { analyzeResume, ruleChecks } = loadAnalyzer(true);
    mockGenerate.mockResolvedValue({ text: 'sorry, I cannot help with that' });
    const result = await analyzeResume(RESUME, '');
    expect(result.llmUsed).toBe(false);
    expect(result.atsScore).toBe(ruleChecks(RESUME, '').ruleScore);
  });

  test('a non-retryable error (e.g. 401 bad key) is not retried and falls back', async () => {
    const { analyzeResume } = loadAnalyzer(true);
    mockGenerate.mockRejectedValue(Object.assign(new Error('API key invalid'), { status: 401 }));
    const result = await analyzeResume(RESUME, '');
    expect(result.llmUsed).toBe(false);
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });

  test('a 404 moves to the next model immediately without a second attempt on the same model', async () => {
    const { analyzeResume } = loadAnalyzer(true);
    mockGenerate
      .mockRejectedValueOnce(Object.assign(new Error('not found'), { status: 404 }))
      .mockResolvedValueOnce({ text: llmJson() });
    const result = await analyzeResume(RESUME, '');
    expect(result.llmUsed).toBe(true);
    expect(mockGenerate).toHaveBeenCalledTimes(2);
    expect(mockGenerate.mock.calls[0][0].model).not.toBe(mockGenerate.mock.calls[1][0].model);
  });

  test('a 503 is retried on the same model after a delay', async () => {
    const { analyzeResume } = loadAnalyzer(true);
    mockGenerate
      .mockRejectedValueOnce(Object.assign(new Error('busy'), { status: 503 }))
      .mockResolvedValueOnce({ text: llmJson() });
    const result = await analyzeResume(RESUME, '');
    expect(result.llmUsed).toBe(true);
    expect(mockGenerate).toHaveBeenCalledTimes(2);
    expect(mockGenerate.mock.calls[0][0].model).toBe(mockGenerate.mock.calls[1][0].model);
  }, 10000);

  test('error code is read from the message when there is no status field', async () => {
    const { analyzeResume } = loadAnalyzer(true);
    mockGenerate
      .mockRejectedValueOnce(new Error('{"error":{"code": 429, "message": "rate limited"}}'))
      .mockResolvedValueOnce({ text: llmJson() });
    const result = await analyzeResume(RESUME, '');
    expect(result.llmUsed).toBe(true);
  }, 10000);
});
