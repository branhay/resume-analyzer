const mongoose = require('mongoose');

const checkSchema = new mongoose.Schema(
  { name: String, passed: Boolean, detail: String, weight: Number, earned: Number },
  { _id: false }
);

const analysisSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true },
    atsScore: { type: Number, required: true, min: 0, max: 100 },
    ruleScore: Number,
    llmScore: Number,
    llmUsed: Boolean,
    summary: String,
    checks: [checkSchema],
    strengths: [String],
    weaknesses: [String],
    suggestions: [{ _id: false, section: String, issue: String, fix: String }],
    matchedKeywords: [String],
    missingKeywords: [String],
    rewrittenBullets: [{ _id: false, original: String, improved: String }],
    jobDescription: String,
    wordCount: Number,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Analysis', analysisSchema);
