const { GoogleGenAI } = require('@google/genai');

const client = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;
// Flash models are on Gemini's free tier. If one is busy (503) or rate-limited (429),
// the next model in this list is tried automatically.
const MODELS = [...new Set([
  process.env.LLM_MODEL || 'gemini-3.5-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-flash-latest',
])];
const RETRYABLE = new Set([429, 500, 503]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function errorCode(err) {
  if (err.status) return Number(err.status);
  const m = String(err.message || '').match(/"code"\s*:\s*(\d+)/);
  return m ? Number(m[1]) : 0;
}

// Tries each model up to 2 times; moves on when the error is temporary
async function generateWithRetry(request) {
  let lastErr;
  for (const model of MODELS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await client.models.generateContent({ ...request, model });
        console.log(`AI review done with ${model}`);
        return res;
      } catch (err) {
        lastErr = err;
        const code = errorCode(err);
        console.warn(`${model} attempt ${attempt} failed (${code || 'error'})`);
        if (code === 404) break;                 // model name not available: try next model
        if (!RETRYABLE.has(code)) throw err;     // bad key etc.: no point retrying
        if (attempt === 1) await sleep(2000);
      }
    }
  }
  throw lastErr;
}

const ACTION_VERBS = [
  'built', 'developed', 'designed', 'led', 'implemented', 'created', 'managed', 'improved',
  'optimized', 'reduced', 'increased', 'launched', 'automated', 'deployed', 'engineered',
  'analyzed', 'delivered', 'architected', 'migrated', 'integrated', 'trained', 'achieved',
  'coordinated', 'established', 'streamlined', 'resolved', 'collaborated', 'mentored', 'won',
];

// Keywords are only taken from the job description if they are real skills/tools.
// This stops generic words (company, fresher, bengaluru, applications...) being flagged.
const SKILLS = [
  // languages
  'python', 'java', 'javascript', 'typescript', 'c++', 'c#', 'golang', 'rust', 'kotlin', 'swift', 'php', 'ruby',
  'scala', 'sql', 'bash', 'html', 'css', 'sass', 'dart',
  // frontend
  'react', 'react.js', 'next.js', 'vue', 'vue.js', 'angular', 'svelte', 'redux', 'tailwind', 'bootstrap', 'jquery',
  'vite', 'webpack', 'react native', 'flutter',
  // backend
  'node', 'node.js', 'express', 'express.js', 'nestjs', 'django', 'flask', 'fastapi', 'spring', 'spring boot',
  'laravel', '.net', 'graphql', 'rest api', 'restful', 'microservices', 'websockets', 'grpc',
  // data stores
  'mongodb', 'mysql', 'postgresql', 'postgres', 'sqlite', 'redis', 'elasticsearch', 'cassandra', 'dynamodb',
  'firebase', 'supabase', 'oracle', 'mongoose', 'prisma',
  // cloud / devops
  'aws', 'azure', 'gcp', 'google cloud', 'docker', 'kubernetes', 'terraform', 'jenkins', 'ci/cd', 'github actions',
  'linux', 'nginx', 'git', 'github', 'gitlab', 'vercel', 'netlify', 'heroku', 'serverless', 'lambda',
  // AI / data
  'machine learning', 'deep learning', 'nlp', 'computer vision', 'llm', 'rag', 'generative ai', 'langchain',
  'llamaindex', 'openai', 'tensorflow', 'pytorch', 'keras', 'scikit-learn', 'pandas', 'numpy', 'opencv',
  'hugging face', 'transformers', 'vector database', 'pinecone', 'faiss', 'chromadb', 'prompt engineering',
  'power bi', 'tableau', 'ms excel', 'spark', 'hadoop', 'airflow', 'data analysis', 'data structures', 'algorithms',
  // practices / tools
  'agile', 'scrum', 'jira', 'testing', 'unit testing', 'jest', 'cypress', 'selenium', 'oop', 'system design',
  'jwt', 'oauth', 'authentication', 'figma', 'postman', 'blockchain', 'solidity', 'networking',
];

// ---------- Rule-based ATS checks ----------
function ruleChecks(text, jobDescription) {
  const lower = text.toLowerCase();
  const words = text.split(/\s+/).filter(Boolean);
  const lines = text.split('\n').map((l) => l.replace(/^[\s•\-–*●▪◦]+/, '').trim().toLowerCase());

  const actionLines = lines.filter((l) => ACTION_VERBS.some((v) => l.startsWith(v + ' '))).length;
  const metrics = (text.match(/\d+(\.\d+)?\s?%|[$₹]\s?\d|\b\d+[kKmM]?\+?\s?(users|clients|customers|projects|people|members|students|requests|hours|ms|seconds|x)\b/g) || []).length;

  const checks = [
    { name: 'Email address', weight: 10, passed: /[\w.+-]+@[\w-]+\.[\w.]+/.test(text) },
    { name: 'Phone number', weight: 5, passed: /(\+?\d[\d\s-]{8,}\d)/.test(text) },
    { name: 'LinkedIn or GitHub link', weight: 5, passed: /linkedin\.com|github\.com/i.test(text) },
    { name: 'Experience section', weight: 15, passed: /\b(experience|employment|internships?|work history)\b/.test(lower) },
    { name: 'Education section', weight: 10, passed: /\beducation\b|\bacademic/.test(lower) },
    { name: 'Skills section', weight: 10, passed: /\b(skills|technologies|tech stack|tools)\b/.test(lower) },
    { name: 'Projects section', weight: 5, passed: /\bprojects?\b/.test(lower) },
    {
      name: 'Length',
      weight: 10,
      passed: words.length >= 300 && words.length <= 900,
      detail: `${words.length} words. Aim for 300 to 900 (one page for students, two at most).`,
    },
    {
      name: 'Bullets start with action verbs',
      weight: 15,
      passed: actionLines >= 5,
      detail: `${actionLines} found. Aim for at least 5 lines starting with verbs like built, led, optimized.`,
    },
    {
      name: 'Quantified results',
      weight: 15,
      passed: metrics >= 3,
      detail: `${metrics} found. Add numbers: percentages, users, time saved.`,
    },
  ];

  let matchedKeywords = [];
  let missingKeywords = [];
  const keywords = jobDescription ? jdSkills(jobDescription) : [];
  if (keywords.length) {
    matchedKeywords = keywords.filter((k) => hasTerm(lower, k));
    missingKeywords = keywords.filter((k) => !hasTerm(lower, k));
    const rate = keywords.length ? matchedKeywords.length / keywords.length : 0;
    checks.push({
      name: 'Job description keyword match',
      weight: 20,
      passed: rate >= 0.6,
      partial: rate,
      detail: `${matchedKeywords.length} of ${keywords.length} key terms found (${Math.round(rate * 100)}%). Aim for 60% or more.`,
    });
  }

  let total = 0;
  let earned = 0;
  for (const c of checks) {
    total += c.weight;
    c.earned = c.partial !== undefined ? Math.round(c.weight * c.partial) : c.passed ? c.weight : 0;
    earned += c.earned;
    delete c.partial;
  }

  return {
    ruleScore: Math.round((earned / total) * 100),
    checks,
    matchedKeywords,
    missingKeywords,
    wordCount: words.length,
  };
}

// Whole-word match; also accepts "node" for "node.js", and plurals ("rest apis" for "rest api")
function hasTerm(text, term) {
  const base = term.replace(/\.js$/, '');
  const variants = [term, base, term + 's'];
  return variants.some((v) => {
    const esc = v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`).test(text);
  });
}

// Skills from the dictionary that appear in the job description
function jdSkills(jd) {
  const lower = jd.toLowerCase();
  const found = SKILLS.filter((k) => hasTerm(lower, k));
  // drop duplicates like "node" when "node.js" is also present, or "rest" when "rest api" is
  return found.filter((k) => !found.some((o) => o !== k && o.startsWith(k) && hasTerm(o, k)));
}

// ---------- LLM review ----------
const SYSTEM_PROMPT = `You are an expert technical recruiter and ATS (Applicant Tracking System) reviewer.
Review the resume and respond with ONLY a JSON object, no markdown, no extra text, in exactly this shape:
{
  "score": <integer 0-100, overall ATS readiness and content quality>,
  "summary": "<2-3 sentence overall assessment>",
  "strengths": ["<specific strength>", "..."],
  "weaknesses": ["<specific weakness>", "..."],
  "suggestions": [{"section": "<resume section>", "issue": "<what is wrong>", "fix": "<exact, actionable fix>"}],
  "missing_keywords": ["<important keyword or skill absent from the resume>"],
  "rewritten_bullets": [{"original": "<weak bullet copied from the resume>", "improved": "<stronger rewrite with action verb and metric placeholder if needed>"}]
}
Rules: 3-5 strengths, 3-5 weaknesses, 4-8 suggestions, up to 10 missing_keywords, 2-4 rewritten_bullets.
If a job description is given, score against it and take missing_keywords from it. Otherwise judge against the role the resume targets.
Be specific to this resume. Never invent experience the candidate does not have.`;

async function llmReview(text, jobDescription) {
  if (!client) return null;

  const userMsg =
    `RESUME:\n${text.slice(0, 12000)}\n\n` +
    (jobDescription ? `JOB DESCRIPTION:\n${jobDescription.slice(0, 4000)}` : 'No job description provided.');

  const response = await generateWithRetry({
    contents: userMsg,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: 'application/json', // forces a pure JSON reply
      temperature: 0.3,
      maxOutputTokens: 4000,
    },
  });

  const raw = response.text || '';
  const json = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));

  const arr = (v) => (Array.isArray(v) ? v : []);
  return {
    llmScore: Math.max(0, Math.min(100, Math.round(Number(json.score) || 0))),
    summary: String(json.summary || ''),
    strengths: arr(json.strengths).map(String),
    weaknesses: arr(json.weaknesses).map(String),
    suggestions: arr(json.suggestions).filter((s) => s && s.fix),
    missingKeywords: arr(json.missing_keywords).map((k) => String(k).toLowerCase()),
    rewrittenBullets: arr(json.rewritten_bullets).filter((b) => b && b.improved),
  };
}

// ---------- Combine ----------
async function analyzeResume(text, jobDescription = '') {
  const rules = ruleChecks(text, jobDescription);

  let llm = null;
  try {
    llm = await llmReview(text, jobDescription);
  } catch (err) {
    console.error('LLM review failed, using rule score only:', err.message);
  }

  const atsScore = llm ? Math.round(0.4 * rules.ruleScore + 0.6 * llm.llmScore) : rules.ruleScore;
  const missing = [...new Set([...(llm?.missingKeywords || []), ...rules.missingKeywords])].slice(0, 15);

  return {
    atsScore,
    ruleScore: rules.ruleScore,
    llmScore: llm ? llm.llmScore : null,
    llmUsed: Boolean(llm),
    summary: llm?.summary || '',
    checks: rules.checks,
    strengths: llm?.strengths || [],
    weaknesses: llm?.weaknesses || [],
    suggestions: llm?.suggestions || [],
    matchedKeywords: rules.matchedKeywords,
    missingKeywords: missing,
    rewrittenBullets: llm?.rewrittenBullets || [],
    wordCount: rules.wordCount,
  };
}

module.exports = { analyzeResume, ruleChecks, jdSkills };
