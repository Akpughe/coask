import express, { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { ragPipeline } from '../rag/custom-rag-pipeline';
import { logger } from '../utils/logger';

const router: Router = express.Router();

// Configure multer for file uploads
const upload = multer({
  dest: '/tmp/uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Accept PDFs, images, and text files
    const allowedTypes = /pdf|png|jpg|jpeg|gif|webp|txt|md/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, images, and text files are allowed'));
    }
  },
});

/**
 * POST /knowledge/ingest/file
 * Ingest a document from uploaded file
 */
router.post('/ingest/file', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'No file uploaded',
      });
    }

    const { category, chunkSize, chunkOverlap, strategy } = req.body;

    logger.info('POST /knowledge/ingest/file', {
      fileName: req.file.originalname,
      fileSize: req.file.size,
      category,
    });

    // Ingest the document
    const result = await ragPipeline.ingestFromFile(req.file.path, {
      source: req.file.originalname,
      category,
      metadata: {
        uploadedAt: new Date().toISOString(),
        mimeType: req.file.mimetype,
      },
      chunkerOptions: {
        chunkSize: chunkSize ? parseInt(chunkSize) : undefined,
        chunkOverlap: chunkOverlap ? parseInt(chunkOverlap) : undefined,
        strategy: strategy || 'recursive',
      },
    });

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error('Error ingesting file', error);

    // Clean up file if it exists
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to ingest document',
    });
  }
});

/**
 * POST /knowledge/ingest/url
 * Ingest a document from URL
 */
router.post('/ingest/url', async (req: Request, res: Response) => {
  try {
    const { url, category, chunkSize, chunkOverlap, strategy } = req.body;

    if (!url) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'url is required',
      });
    }

    logger.info('POST /knowledge/ingest/url', { url, category });

    const result = await ragPipeline.ingestFromUrl(url, {
      source: url,
      category,
      chunkerOptions: {
        chunkSize: chunkSize ? parseInt(chunkSize) : undefined,
        chunkOverlap: chunkOverlap ? parseInt(chunkOverlap) : undefined,
        strategy: strategy || 'recursive',
      },
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error('Error ingesting from URL', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to ingest document from URL',
    });
  }
});

/**
 * POST /knowledge/ingest/text
 * Ingest plain text directly
 */
router.post('/ingest/text', async (req: Request, res: Response) => {
  try {
    const { text, fileName, category, chunkSize, chunkOverlap, strategy } = req.body;

    if (!text) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'text is required',
      });
    }

    logger.info('POST /knowledge/ingest/text', {
      textLength: text.length,
      fileName,
      category,
    });

    const result = await ragPipeline.ingestFromText(text, {
      source: fileName || 'text-input',
      fileName,
      category,
      chunkerOptions: {
        chunkSize: chunkSize ? parseInt(chunkSize) : undefined,
        chunkOverlap: chunkOverlap ? parseInt(chunkOverlap) : undefined,
        strategy: strategy || 'recursive',
      },
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error('Error ingesting text', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to ingest text',
    });
  }
});

/**
 * POST /knowledge/query
 * Query the knowledge base
 */
router.post('/query', async (req: Request, res: Response) => {
  try {
    const { question, topK, category, minScore, includeScores, useHybrid } = req.body;

    if (!question) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'question is required',
      });
    }

    logger.info('POST /knowledge/query', {
      question: question.substring(0, 100),
      topK,
      category,
      useHybrid,
    });

    // Build filter if category is specified
    const filter = category ? { category } : undefined;

    // Use hybrid or semantic search
    const result = useHybrid
      ? await ragPipeline.hybridQuery(question, {
          topK: topK ? parseInt(topK) : 5,
          filter,
          minScore: minScore ? parseFloat(minScore) : 0.0,
          includeScores: includeScores !== false,
        })
      : await ragPipeline.query(question, {
          topK: topK ? parseInt(topK) : 5,
          filter,
          minScore: minScore ? parseFloat(minScore) : 0.0,
          includeScores: includeScores !== false,
        });

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error('Error querying knowledge base', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to query knowledge base',
    });
  }
});

/**
 * DELETE /knowledge/document/:docId
 * Delete a document from the knowledge base
 */
router.delete('/document/:docId', async (req: Request, res: Response) => {
  try {
    const { docId } = req.params;

    if (!docId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'docId is required',
      });
    }

    logger.info('DELETE /knowledge/document', { docId });

    await ragPipeline.deleteDocument(docId);

    res.json({
      success: true,
      message: 'Document deleted successfully',
    });
  } catch (error: any) {
    logger.error('Error deleting document', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to delete document',
    });
  }
});

/**
 * GET /knowledge/stats
 * Get knowledge base statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    logger.info('GET /knowledge/stats');

    const stats = await ragPipeline.getStats();

    res.json({
      success: true,
      data: {
        ...stats,
        isReady: ragPipeline.isReady(),
      },
    });
  } catch (error: any) {
    logger.error('Error getting stats', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to get stats',
    });
  }
});

/**
 * GET /knowledge/health
 * Check if knowledge base is operational
 */
router.get('/health', (req: Request, res: Response) => {
  try {
    const isReady = ragPipeline.isReady();

    res.status(isReady ? 200 : 503).json({
      success: isReady,
      status: isReady ? 'ready' : 'not_ready',
      message: isReady
        ? 'Knowledge base is operational'
        : 'Knowledge base not ready - check API keys',
    });
  } catch (error: any) {
    logger.error('Error checking health', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to check health',
    });
  }
});

export default router;
