const { ruleChecks, jdSkills } = require('../utils/analyzer');

// A resume that should pass every rule check
const STRONG_RESUME = `
Brandon Simon
Email: brandon@example.com | Phone: +91 98765 43210 | github.com/brandon

Education
B.E. Computer Science, NHCE Bengaluru, 2027

Skills
Python, React, Node.js, MongoDB, Docker

Experience
Intern at Startup, 2025
- Built a REST API serving 5000 users with Node.js
- Developed a dashboard that reduced reporting time by 40%
- Optimized database queries, cutting response time by 30%
- Led a team of 3 students on a capstone project
- Automated data imports saving 10 hours per week

Projects
- Designed a RAG document platform using Python and LangChain
- Created an AI resume analyzer with React and Express
`;

describe('ruleChecks: section and contact detection', () => {
  test('a complete resume passes the contact and section checks', () => {
    const r = ruleChecks(STRONG_RESUME, '');
    const byName = Object.fromEntries(r.checks.map((c) => [c.name, c.passed]));
    expect(byName['Email address']).toBe(true);
    expect(byName['Phone number']).toBe(true);
    expect(byName['LinkedIn or GitHub link']).toBe(true);
    expect(byName['Experience section']).toBe(true);
    expect(byName['Education section']).toBe(true);
    expect(byName['Skills section']).toBe(true);
    expect(byName['Projects section']).toBe(true);
  });

  test('email check fails when there is no email address', () => {
    const r = ruleChecks('Brandon Simon, no contact info here', '');
    expect(r.checks.find((c) => c.name === 'Email address').passed).toBe(false);
  });

  test('phone check ignores a year range like "2021 - 2024" (should fail)', () => {
    // Known risk: the phone regex accepts any run of 10+ digits, spaces and dashes.
    const text = 'Intern, 2021 - 2024. No phone number given.';
    const r = ruleChecks(text, '');
    expect(r.checks.find((c) => c.name === 'Phone number').passed).toBe(false);
  });

  test('GitHub or LinkedIn link is detected case-insensitively', () => {
    const r = ruleChecks('Profile: LinkedIn.com/in/brandon', '');
    expect(r.checks.find((c) => c.name === 'LinkedIn or GitHub link').passed).toBe(true);
  });
});

describe('ruleChecks: length, bullets, metrics', () => {
  test('length check passes between 300 and 900 words', () => {
    const text = Array(400).fill('word').join(' ');
    const r = ruleChecks(text, '');
    expect(r.wordCount).toBe(400);
    expect(r.checks.find((c) => c.name === 'Length').passed).toBe(true);
  });

  test('length check fails for a 50-word resume', () => {
    const r = ruleChecks(Array(50).fill('word').join(' '), '');
    expect(r.checks.find((c) => c.name === 'Length').passed).toBe(false);
  });

  test('bullets: counts lines that start with an action verb after a bullet symbol', () => {
    const text = [
      '• Built a chatbot',
      '- Developed APIs',
      '* Designed the schema',
      '● Led the team',
      '▪ Optimized queries',
      'Responsible for things',
    ].join('\n');
    const r = ruleChecks(text, '');
    const bullets = r.checks.find((c) => c.name === 'Bullets start with action verbs');
    expect(bullets.passed).toBe(true);
    expect(bullets.detail).toMatch(/^5 found/);
  });

  test('bullets: a verb with no trailing space (e.g. "built.") does not count', () => {
    const r = ruleChecks('built.\nled,\ndesigned:', '');
    expect(r.checks.find((c) => c.name === 'Bullets start with action verbs').detail).toMatch(/^0 found/);
  });

  test('quantified results: percentages, money and user counts are counted', () => {
    const text = 'Cut costs by 40% and served 5000 users. Saved ₹ 20 per order and 3x faster.';
    const r = ruleChecks(text, '');
    const q = r.checks.find((c) => c.name === 'Quantified results');
    expect(q.passed).toBe(true);
    expect(q.detail).toMatch(/^4 found/);
  });

  test('score is between 0 and 100 and equals the weighted sum of passed checks', () => {
    const r = ruleChecks(STRONG_RESUME, '');
    expect(r.ruleScore).toBeGreaterThanOrEqual(0);
    expect(r.ruleScore).toBeLessThanOrEqual(100);
    const total = r.checks.reduce((s, c) => s + c.weight, 0);
    const earned = r.checks.reduce((s, c) => s + c.earned, 0);
    expect(r.ruleScore).toBe(Math.round((earned / total) * 100));
  });

  test('empty text gives a score of 0 without throwing', () => {
    const r = ruleChecks('', '');
    expect(r.ruleScore).toBe(0);
    expect(r.wordCount).toBe(0);
  });
});

describe('ruleChecks: job description keyword match', () => {
  test('no keyword check is added when no job description is given', () => {
    const r = ruleChecks(STRONG_RESUME, '');
    expect(r.checks.some((c) => c.name === 'Job description keyword match')).toBe(false);
    expect(r.matchedKeywords).toEqual([]);
    expect(r.missingKeywords).toEqual([]);
  });

  test('matched and missing keywords partition the job description skills', () => {
    const jd = 'Need Python, React, Kubernetes and MongoDB experience.';
    const r = ruleChecks(STRONG_RESUME, jd);
    const all = [...r.matchedKeywords, ...r.missingKeywords].sort();
    expect(all).toEqual(jdSkills(jd).sort());
    expect(r.missingKeywords).toContain('kubernetes');
    expect(r.matchedKeywords).toContain('python');
  });

  test('keyword check passes at 60% or more and fails below', () => {
    const jd = 'python react node mongodb docker kubernetes aws terraform';
    // resume has python, react, node, mongodb, docker = 5/8 = 62.5%
    const pass = ruleChecks(STRONG_RESUME, jd).checks.find((c) => c.name === 'Job description keyword match');
    expect(pass.passed).toBe(true);
    const fail = ruleChecks('nothing relevant here', jd).checks.find((c) => c.name === 'Job description keyword match');
    expect(fail.passed).toBe(false);
  });
});

describe('jdSkills', () => {
  test('finds real skills in the job description', () => {
    expect(jdSkills('We use Python and React daily')).toEqual(['python', 'react']);
  });

  test('ignores generic words that are not skills', () => {
    expect(jdSkills('Fresher role at a company in Bengaluru, apply now')).toEqual([]);
  });

  test('keeps only the longer name when both "node" and "node.js" appear', () => {
    expect(jdSkills('Experience with Node.js required')).toEqual(['node.js']);
  });

  test('matches symbol-based skills such as C++ and C#', () => {
    expect(jdSkills('Strong C++ and C# background')).toEqual(expect.arrayContaining(['c++', 'c#']));
  });

  test('does not match a skill inside a longer word (java in javascript, sql in mysql)', () => {
    expect(jdSkills('Knows javascript and mysql')).toEqual(['javascript', 'mysql']);
  });

  test('matches a plural of a skill ("rest apis" for "rest api")', () => {
    expect(jdSkills('Design rest apis')).toEqual(['rest api']);
  });

  test('is case-insensitive', () => {
    expect(jdSkills('PYTHON and DOCKER')).toEqual(['python', 'docker']);
  });
});
