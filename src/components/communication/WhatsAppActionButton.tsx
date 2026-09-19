import React, { useState } from 'react';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '../ui/dialog';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { toast } from 'react-hot-toast';
import { AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export function WhatsAppIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      className={cn('shrink-0', className)}
      aria-hidden="true"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.889-9.885 9.889m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.82 11.82 0 00-3.48-8.413Z" />
    </svg>
  );
}

export interface WhatsAppActionButtonProps {
  type: 'APPOINTMENT_CONFIRMATION' | 'APPOINTMENT_REMINDER' | 'PAYMENT_RECEIPT' | 'INVOICE' | 'PRESCRIPTION';
  entityType?: 'APPOINTMENT' | 'PAYMENT' | 'VISIT';
  entityId?: string;
  patientId?: string;
  recipientName: string;
  recipientPhone: string;
  recipientEmail?: string;
  purposeDescription?: string;
  paymentOwner?: string; // "DOCTOR" | "RECEPTION"
  preferredCommunicationChannel?: 'AUTO' | 'WHATSAPP' | 'SMS' | 'EMAIL';
  whatsappAvailable?: boolean | null;
  variables?: Record<string, any>;
  variant?: 'button' | 'icon' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  label?: string;
  disabled?: boolean;
}

/**
 * Normalizes an Indian phone number for clean, professional display.
 * E.g. "9876543210" -> "+91 98765 43210"
 */
function formatDisplayPhone(rawPhone?: string | null): string {
  if (!rawPhone) return 'Phone not provided';
  const clean = rawPhone.replace(/\D/g, '');
  if (clean.length === 10) {
    return `+91 ${clean.slice(0, 5)} ${clean.slice(5)}`;
  }
  if (clean.length === 12 && clean.startsWith('91')) {
    return `+91 ${clean.slice(2, 7)} ${clean.slice(7)}`;
  }
  return rawPhone;
}

/**
 * Derives human-readable purpose identification based on NotificationType.
 */
function getDefaultPurpose(type: WhatsAppActionButtonProps['type']): string {
  switch (type) {
    case 'APPOINTMENT_CONFIRMATION':
      return 'Appointment confirmation will be sent.';
    case 'APPOINTMENT_REMINDER':
      return 'Appointment reminder will be sent.';
    case 'PAYMENT_RECEIPT':
      return 'Receipt will be sent via WhatsApp.';
    case 'INVOICE':
      return 'Invoice will be sent via WhatsApp.';
    case 'PRESCRIPTION':
      return 'Prescription will be sent via WhatsApp.';
    default:
      return 'Message will be sent via WhatsApp.';
  }
}

export function WhatsAppActionButton({
  type,
  entityType,
  entityId,
  patientId,
  recipientName,
  recipientPhone,
  recipientEmail,
  purposeDescription,
  paymentOwner,
  preferredCommunicationChannel = 'AUTO',
  whatsappAvailable,
  variables,
  variant = 'button',
  size,
  className,
  label,
  disabled = false,
}: WhatsAppActionButtonProps) {
  const { currentUser } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Security Check: Receptionists are strictly forbidden from viewing or sending payment-sensitive
  // notifications for doctor-owned visits.
  const isReceptionist = currentUser?.role === 'Receptionist';
  const isPaymentSensitive = type === 'PAYMENT_RECEIPT' || type === 'INVOICE';
  if (isReceptionist && paymentOwner === 'DOCTOR' && isPaymentSensitive) {
    return null;
  }

  const formattedPhone = formatDisplayPhone(recipientPhone);
  const purpose = purposeDescription || getDefaultPurpose(type);
  const isOverride = preferredCommunicationChannel === 'SMS' || preferredCommunicationChannel === 'EMAIL';
  const isWhatsappUnavailable = whatsappAvailable === false;

  const handleOpenModal = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    if (!isSending) {
      setModalOpen(false);
    }
  };

  const handleConfirmSend = async () => {
    if (isSending) return; // Prevent double-clicks
    if (isWhatsappUnavailable) {
      toast.error('WhatsApp is unavailable for this patient.');
      return;
    }

    setIsSending(true);

    try {
      const response = await api.post<{ status: string; notification?: any }>('/api/notifications/send', {
        type,
        channel: 'WHATSAPP',
        patientId,
        entityType,
        entityId,
        paymentOwner,
        recipientPhone,
        recipientEmail,
        recipientName,
        variables,
      });

      // Semantic response feedback from backend
      if (response.status === 'QUEUED') {
        toast.success('WhatsApp message queued');
      } else if (response.status === 'ALREADY_EXISTS') {
        toast.success('WhatsApp message already queued');
      } else {
        toast.success('WhatsApp message queued');
      }

      setModalOpen(false);
    } catch (err: any) {
      console.error('Failed to send WhatsApp notification:', err);
      const errorMessage = err.data?.error || err.message || 'Failed to send WhatsApp notification';

      if (errorMessage.includes('Rate limit') || errorMessage.includes('wait') || errorMessage.includes('cooldown')) {
        toast.error(errorMessage);
      } else if (errorMessage.includes('Unauthorized') || errorMessage.includes('restricted')) {
        toast.error(errorMessage);
      } else if (errorMessage.includes('unavailable')) {
        toast.error('WhatsApp is unavailable for this patient.');
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setIsSending(false);
    }
  };

  // Render Button trigger based on variant
  const renderTrigger = () => {
    if (variant === 'icon') {
      return (
        <Button
          type="button"
          size={size || 'icon'}
          disabled={disabled}
          onClick={handleOpenModal}
          title={label || 'Send via WhatsApp'}
          aria-label={label || 'Send via WhatsApp'}
          className={cn(
            'h-8 w-8 rounded-lg shadow-xs transition-colors',
            'bg-emerald-600 hover:bg-emerald-700 text-white',
            'focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1',
            disabled && 'opacity-50 cursor-not-allowed',
            className
          )}
        >
          <WhatsAppIcon className="w-4 h-4 fill-current text-white" />
        </Button>
      );
    }

    if (variant === 'outline') {
      return (
        <Button
          type="button"
          variant="outline"
          size={size || 'sm'}
          disabled={disabled}
          onClick={handleOpenModal}
          className={cn(
            'border-emerald-600 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 font-medium shadow-xs transition-colors gap-1.5',
            disabled && 'opacity-50 cursor-not-allowed',
            className
          )}
        >
          <WhatsAppIcon className="w-4 h-4 fill-current text-emerald-600" />
          <span>{label || 'WhatsApp'}</span>
        </Button>
      );
    }

    if (variant === 'ghost') {
      return (
        <Button
          type="button"
          variant="ghost"
          size={size || 'sm'}
          disabled={disabled}
          onClick={handleOpenModal}
          className={cn(
            'text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 font-medium transition-colors gap-1.5',
            disabled && 'opacity-50 cursor-not-allowed',
            className
          )}
        >
          <WhatsAppIcon className="w-4 h-4 fill-current text-emerald-600" />
          <span>{label || 'WhatsApp'}</span>
        </Button>
      );
    }

    // Default 'button' variant
    return (
      <Button
        type="button"
        size={size || 'sm'}
        disabled={disabled}
        onClick={handleOpenModal}
        className={cn(
          'bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs rounded-lg transition-colors gap-1.5',
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
      >
        <WhatsAppIcon className="w-4 h-4 fill-current text-white" />
        <span>{label || 'WhatsApp'}</span>
      </Button>
    );
  };

  return (
    <>
      {renderTrigger()}

      <Dialog open={modalOpen} onOpenChange={open => !isSending && setModalOpen(open)}>
        <DialogContent className="sm:max-w-md bg-white rounded-2xl p-0 overflow-hidden shadow-2xl border border-slate-200">
          <DialogHeader className="px-6 pt-6 pb-2 text-left">
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                <WhatsAppIcon className="w-4 h-4 fill-current text-emerald-600" />
              </span>
              Send via WhatsApp?
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500 pt-1">
              This will send the selected document/message to:
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 py-3 space-y-4">
            {/* Recipient Card */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 text-sm space-y-1">
              <div className="font-semibold text-slate-900">{recipientName || 'Patient'}</div>
              <div className="text-slate-600 font-mono text-xs">{formattedPhone}</div>
            </div>

            {/* Purpose Identification */}
            <div className="text-xs text-slate-700 bg-emerald-50/60 border border-emerald-200/80 rounded-lg p-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="font-medium">{purpose}</span>
            </div>

            {/* Intentional Preference Override Notice */}
            {isOverride && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-1">
                <div className="font-semibold flex items-center gap-1.5 text-amber-800">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Channel Preference Override</span>
                </div>
                <p className="leading-relaxed">
                  Patient preference is set to <strong>{preferredCommunicationChannel}</strong>. Sending via WhatsApp will override this preference for this message only.
                </p>
              </div>
            )}

            {/* WhatsApp Unavailable Warning */}
            {isWhatsappUnavailable && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="font-medium">WhatsApp is unavailable for this patient.</span>
              </div>
            )}
          </div>

          <DialogFooter className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex sm:justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCloseModal}
              disabled={isSending}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmSend}
              disabled={isSending || isWhatsappUnavailable}
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-1.5"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <WhatsAppIcon className="w-4 h-4 fill-current text-white" />
                  <span>Yes, Send</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
