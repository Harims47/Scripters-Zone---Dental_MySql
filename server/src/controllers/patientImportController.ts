import { Request, Response, NextFunction } from 'express';
import {
  inspectFile,
  parseFileRows,
  validateRows,
  executeImport,
  ColumnMapping
} from '../services/patientImportService';

export const inspectImportFile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fileBase64, fileName, fileType } = req.body;

    if (!fileBase64 || !fileName || !fileType) {
      return res.status(400).json({ error: 'fileBase64, fileName, and fileType are required.' });
    }

    const cleanType = String(fileType).toLowerCase().replace(/^\./, '');
    if (cleanType !== 'xlsx' && cleanType !== 'csv') {
      return res.status(400).json({
        error: 'Unsupported file format. DentalCore v1 officially supports .xlsx and .csv files only.'
      });
    }

    const buffer = Buffer.from(fileBase64, 'base64');
    if (buffer.length > 20 * 1024 * 1024) {
      return res.status(400).json({ error: 'File size exceeds maximum 20MB limit.' });
    }

    const inspection = await inspectFile(buffer, fileName, cleanType as 'xlsx' | 'csv');
    return res.json(inspection);
  } catch (error: any) {
    console.error('Inspect error:', error);
    return res.status(400).json({ error: error.message || 'Failed to inspect file.' });
  }
};

export const validateImportFile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fileBase64, fileType, mappings } = req.body;

    if (!fileBase64 || !fileType || !mappings) {
      return res.status(400).json({ error: 'fileBase64, fileType, and mappings are required.' });
    }

    const cleanType = String(fileType).toLowerCase().replace(/^\./, '');
    if (cleanType !== 'xlsx' && cleanType !== 'csv') {
      return res.status(400).json({
        error: 'Unsupported file format. DentalCore v1 officially supports .xlsx and .csv files only.'
      });
    }

    const buffer = Buffer.from(fileBase64, 'base64');
    const { rows } = await parseFileRows(buffer, cleanType as 'xlsx' | 'csv');
    const summary = await validateRows(rows, mappings as ColumnMapping);

    return res.json(summary);
  } catch (error: any) {
    console.error('Validate error:', error);
    return res.status(400).json({ error: error.message || 'Failed to validate import file.' });
  }
};

export const executeImportFile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fileBase64, fileType, mappings } = req.body;

    if (!fileBase64 || !fileType || !mappings) {
      return res.status(400).json({ error: 'fileBase64, fileType, and mappings are required.' });
    }

    const cleanType = String(fileType).toLowerCase().replace(/^\./, '');
    if (cleanType !== 'xlsx' && cleanType !== 'csv') {
      return res.status(400).json({
        error: 'Unsupported file format. DentalCore v1 officially supports .xlsx and .csv files only.'
      });
    }

    const buffer = Buffer.from(fileBase64, 'base64');
    const result = await executeImport(buffer, cleanType as 'xlsx' | 'csv', mappings as ColumnMapping);

    return res.json(result);
  } catch (error: any) {
    console.error('Execute import error:', error);
    return res.status(500).json({ error: error.message || 'Failed to execute patient import.' });
  }
};
