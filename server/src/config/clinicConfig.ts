/**
 * Authoritative Backend Clinic Configuration
 * 
 * Provides configuration values for clinic branding, address, and contact details.
 * Prioritizes environment variables and falls back to the canonical clinic settings.
 * Does NOT invent missing fields (e.g. taglines, websites, degrees, or registration numbers).
 */

export interface ClinicConfig {
  name: string;
  address?: string;
  city?: string;
  pin?: string;
  phone?: string;
  email?: string;
}

export const getCanonicalClinicConfig = (): ClinicConfig => {
  return {
    name: process.env.CLINIC_NAME || 'Rafi Dental Clinic',
    address: process.env.CLINIC_ADDRESS || '37, Dr.Venkatraman St, Gopichettipalayam, Tamil Nadu 638452',
    city: process.env.CLINIC_CITY || 'Gobichettipalayam',
    pin: process.env.CLINIC_PIN || '638452',
    phone: process.env.CLINIC_PHONE || '094430 23648',
    email: process.env.CLINIC_EMAIL || 'clinic@rafidental.com'
  };
};
