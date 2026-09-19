import { prisma } from '../db';
import { logger } from './logger';

export interface SafeAuditParams {
  action: string;
  entityType: string;
  entityId: string;
  actorId?: string;
  actorRole?: string;
  ipAddress?: string;
  metadata?: Record<string, any>;
}

// Keys strictly forbidden in AuditLog metadata
const FORBIDDEN_AUDIT_KEYS = /^(password|passwordHash|token|jwt|secret|cookie|authorization|creditCard|cvv|medicalHistory|allergies|notes)$/i;

export const recordAuditEvent = async (params: SafeAuditParams): Promise<void> => {
  try {
    // Sanitize metadata defensively
    let sanitizedMetadata: Record<string, any> | undefined = undefined;
    if (params.metadata && typeof params.metadata === 'object') {
      sanitizedMetadata = {};
      for (const [key, value] of Object.entries(params.metadata)) {
        if (!FORBIDDEN_AUDIT_KEYS.test(key)) {
          sanitizedMetadata[key] = value;
        }
      }
    }

    await prisma.auditLog.create({
      data: {
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        actorId: params.actorId || null,
        actorRole: params.actorRole || null,
        ipAddress: params.ipAddress || null,
        metadata: sanitizedMetadata ?? undefined,
      },
    });

    // Also log to rotating technical log at info level
    logger.info(`[AUDIT] ${params.action} on ${params.entityType}:${params.entityId}`, {
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      actorId: params.actorId,
      actorRole: params.actorRole,
    });
  } catch (error: any) {
    logger.error('Failed to write business AuditLog entry', {
      error: error.message,
      action: params.action,
      entityId: params.entityId,
    });
  }
};
