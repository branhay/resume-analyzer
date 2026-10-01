const express = require('express');
const multer = require('multer');
const mongoose = require('mongoose');
const Analysis = require('../models/Analysis');
const { extractText } = require('../utils/parser');
const { analyzeResume } = require('../utils/analyzer');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/\.(pdf|docx)$/i.test(file.originalname)) return cb(null, true);
    const err = new Error('Use a PDF or DOCX file.');
    err.status = 400;
    cb(err);
  },
});

const validId = (req, res, next) =>
  mongoose.isValidObjectId(req.params.id)
    ? next()
    : res.status(400).json({ error: 'Invalid analysis id.' });

// POST /api/analyze  -> upload + analyze + save
router.post('/analyze', upload.single('resume'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Attach a resume file in the "resume" field.' });

    const text = await extractText(req.file);
    if (text.length < 100) {
      return res.status(422).json({
        error: 'Could not read enough text from this file. If it is a scanned PDF, export it as a text-based PDF and try again.',
      });
    }

    const jobDescription = (req.body.jobDescription || '').trim();
    const result = await analyzeResume(text, jobDescription);

    const doc = await Analysis.create({
      filename: req.file.originalname,
      jobDescription,
      ...result,
    });
    res.status(201).json(doc);
  } catch (err) {
    next(err);
  }
});

// GET /api/analyses -> history list
router.get('/analyses', async (req, res, next) => {
  try {
    const items = await Analysis.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .select('filename atsScore createdAt');
    res.json(items);
  } catch (err) {
    next(err);
  }
});

// GET /api/analyses/:id -> one analysis
router.get('/analyses/:id', validId, async (req, res, next) => {
  try {
    const doc = await Analysis.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Analysis not found.' });
    res.json(doc);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/analyses/:id
router.delete('/analyses/:id', validId, async (req, res, next) => {
  try {
    const doc = await Analysis.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Analysis not found.' });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
