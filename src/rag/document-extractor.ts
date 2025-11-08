import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import { config } from '../core/config';
import { logger } from '../utils/logger';

export interface ExtractedDocument {
  text: string;
  pageCount?: number;
  metadata?: {
    fileName: string;
    fileType: string;
    fileSize: number;
    extractedAt: Date;
  };
}

/**
 * Document Extractor using Mistral OCR API
 * Supports: PDF, images (PNG, JPG, etc.), and plain text files
 */
export class DocumentExtractor {
  private readonly mistralApiKey: string;
  private readonly mistralApiUrl = 'https://api.mistral.ai/v1/chat/completions';

  constructor() {
    this.mistralApiKey = config.mistralApiKey;
    if (!this.mistralApiKey) {
      logger.warn('⚠️  Mistral API key not found - document extraction will be limited');
    } else {
      logger.info('✅ Document Extractor initialized with Mistral OCR');
    }
  }

  /**
   * Extract text from a file (PDF, image, or text)
   */
  async extractFromFile(filePath: string): Promise<ExtractedDocument> {
    const fileStats = fs.statSync(filePath);
    const fileName = filePath.split('/').pop() || 'unknown';
    const fileType = this.getFileType(fileName);

    logger.info('Extracting text from file', { fileName, fileType, fileSize: fileStats.size });

    let text: string;

    // Handle different file types
    if (fileType === 'txt' || fileType === 'md') {
      // Plain text files - read directly
      text = await this.extractFromTextFile(filePath);
    } else if (this.isSupportedImageOrPDF(fileType)) {
      // Use Mistral OCR for PDFs and images
      if (!this.mistralApiKey) {
        throw new Error('Mistral API key required for PDF/image extraction');
      }
      text = await this.extractWithMistralOCR(filePath, fileType);
    } else {
      throw new Error(`Unsupported file type: ${fileType}`);
    }

    logger.info('Text extraction complete', {
      fileName,
      textLength: text.length,
      wordCount: text.split(/\s+/).length,
    });

    return {
      text,
      metadata: {
        fileName,
        fileType,
        fileSize: fileStats.size,
        extractedAt: new Date(),
      },
    };
  }

  /**
   * Extract text from plain text file
   */
  private async extractFromTextFile(filePath: string): Promise<string> {
    return fs.readFileSync(filePath, 'utf-8');
  }

  /**
   * Extract text using Mistral OCR API
   * Mistral's vision models can extract text from images and PDFs
   */
  private async extractWithMistralOCR(filePath: string, fileType: string): Promise<string> {
    try {
      // Read file as base64
      const fileBuffer = fs.readFileSync(filePath);
      const base64Data = fileBuffer.toString('base64');
      const mimeType = this.getMimeType(fileType);

      logger.debug('Calling Mistral OCR API', { fileType, mimeType });

      // Use Mistral Pixtral model for OCR
      const response = await axios.post(
        this.mistralApiUrl,
        {
          model: 'pixtral-12b-2409', // Mistral's vision model
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Extract all text from this document. Return only the extracted text without any additional commentary or formatting. If the document has multiple pages, extract text from all pages in order.',
                },
                {
                  type: 'image_url',
                  image_url: `data:${mimeType};base64,${base64Data}`,
                },
              ],
            },
          ],
          max_tokens: 4000,
          temperature: 0.0, // Deterministic for OCR
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.mistralApiKey}`,
          },
          timeout: 60000, // 60 second timeout for OCR
        }
      );

      const extractedText = response.data.choices[0]?.message?.content || '';

      if (!extractedText) {
        throw new Error('No text extracted from document');
      }

      logger.debug('Mistral OCR complete', {
        extractedLength: extractedText.length,
        tokensUsed: response.data.usage?.total_tokens,
      });

      return extractedText;
    } catch (error: any) {
      logger.error('Mistral OCR extraction failed', error);
      throw new Error(`Document extraction failed: ${error.message}`);
    }
  }

  /**
   * Extract text from URL-hosted document
   */
  async extractFromUrl(url: string): Promise<ExtractedDocument> {
    logger.info('Extracting text from URL', { url });

    try {
      // Download the file
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 30000,
      });

      // Determine file type from URL or content-type
      const contentType = response.headers['content-type'];
      const fileName = url.split('/').pop() || 'download';
      const fileType = this.getFileTypeFromMimeType(contentType) || this.getFileType(fileName);

      // Save temporarily
      const tempPath = `/tmp/temp_${Date.now()}_${fileName}`;
      fs.writeFileSync(tempPath, Buffer.from(response.data));

      try {
        // Extract text
        const result = await this.extractFromFile(tempPath);
        return result;
      } finally {
        // Clean up temp file
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      }
    } catch (error: any) {
      logger.error('URL extraction failed', error);
      throw new Error(`Failed to extract from URL: ${error.message}`);
    }
  }

  /**
   * Extract text directly from string (useful for API responses, etc.)
   */
  extractFromText(text: string, metadata?: Partial<ExtractedDocument['metadata']>): ExtractedDocument {
    return {
      text,
      metadata: {
        fileName: metadata?.fileName || 'text-input',
        fileType: metadata?.fileType || 'txt',
        fileSize: Buffer.byteLength(text, 'utf-8'),
        extractedAt: new Date(),
      },
    };
  }

  /**
   * Get file extension from filename
   */
  private getFileType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();
    return ext || 'unknown';
  }

  /**
   * Get MIME type from file extension
   */
  private getMimeType(fileType: string): string {
    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
      txt: 'text/plain',
      md: 'text/markdown',
    };
    return mimeTypes[fileType] || 'application/octet-stream';
  }

  /**
   * Get file type from MIME type
   */
  private getFileTypeFromMimeType(mimeType: string): string | null {
    const typeMap: Record<string, string> = {
      'application/pdf': 'pdf',
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'text/plain': 'txt',
      'text/markdown': 'md',
    };
    return typeMap[mimeType] || null;
  }

  /**
   * Check if file type is supported for OCR
   */
  private isSupportedImageOrPDF(fileType: string): boolean {
    return ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp'].includes(fileType);
  }

  /**
   * Get list of supported file types
   */
  getSupportedFileTypes(): string[] {
    return ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'txt', 'md'];
  }
}

// Export singleton instance
export const documentExtractor = new DocumentExtractor();
