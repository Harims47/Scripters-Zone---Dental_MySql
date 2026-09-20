/**
 * Centralized FDI World Dental Federation (ISO 3950) Tooth Metadata
 * 
 * Orientation:
 * Upper Arch (Maxillary): 18..11 (Patient Right / Doctor Left) | 21..28 (Patient Left / Doctor Right)
 * Lower Arch (Mandibular): 48..41 (Patient Right / Doctor Left) | 31..38 (Patient Left / Doctor Right)
 */

export interface ToothInfo {
  fdi: number;
  name: string;
  jaw: 'Upper' | 'Lower';
  quadrant: 'Upper Right' | 'Upper Left' | 'Lower Left' | 'Lower Right';
  position: number; // 1 to 8 (midline to third molar)
  type: 'Incisor' | 'Canine' | 'Premolar' | 'Molar';
  archSide: 'Right' | 'Left';
}

export const TOOTH_METADATA: Record<number, ToothInfo> = {
  // Quadrant 1: Upper Right (Patient Right / Doctor Left)
  18: { fdi: 18, name: "Upper Right Third Molar (Wisdom Tooth)", jaw: "Upper", quadrant: "Upper Right", position: 8, type: "Molar", archSide: "Right" },
  17: { fdi: 17, name: "Upper Right Second Molar", jaw: "Upper", quadrant: "Upper Right", position: 7, type: "Molar", archSide: "Right" },
  16: { fdi: 16, name: "Upper Right First Molar", jaw: "Upper", quadrant: "Upper Right", position: 6, type: "Molar", archSide: "Right" },
  15: { fdi: 15, name: "Upper Right Second Premolar", jaw: "Upper", quadrant: "Upper Right", position: 5, type: "Premolar", archSide: "Right" },
  14: { fdi: 14, name: "Upper Right First Premolar", jaw: "Upper", quadrant: "Upper Right", position: 4, type: "Premolar", archSide: "Right" },
  13: { fdi: 13, name: "Upper Right Canine", jaw: "Upper", quadrant: "Upper Right", position: 3, type: "Canine", archSide: "Right" },
  12: { fdi: 12, name: "Upper Right Lateral Incisor", jaw: "Upper", quadrant: "Upper Right", position: 2, type: "Incisor", archSide: "Right" },
  11: { fdi: 11, name: "Upper Right Central Incisor", jaw: "Upper", quadrant: "Upper Right", position: 1, type: "Incisor", archSide: "Right" },

  // Quadrant 2: Upper Left (Patient Left / Doctor Right)
  21: { fdi: 21, name: "Upper Left Central Incisor", jaw: "Upper", quadrant: "Upper Left", position: 1, type: "Incisor", archSide: "Left" },
  22: { fdi: 22, name: "Upper Left Lateral Incisor", jaw: "Upper", quadrant: "Upper Left", position: 2, type: "Incisor", archSide: "Left" },
  23: { fdi: 23, name: "Upper Left Canine", jaw: "Upper", quadrant: "Upper Left", position: 3, type: "Canine", archSide: "Left" },
  24: { fdi: 24, name: "Upper Left First Premolar", jaw: "Upper", quadrant: "Upper Left", position: 4, type: "Premolar", archSide: "Left" },
  25: { fdi: 25, name: "Upper Left Second Premolar", jaw: "Upper", quadrant: "Upper Left", position: 5, type: "Premolar", archSide: "Left" },
  26: { fdi: 26, name: "Upper Left First Molar", jaw: "Upper", quadrant: "Upper Left", position: 6, type: "Molar", archSide: "Left" },
  27: { fdi: 27, name: "Upper Left Second Molar", jaw: "Upper", quadrant: "Upper Left", position: 7, type: "Molar", archSide: "Left" },
  28: { fdi: 28, name: "Upper Left Third Molar (Wisdom Tooth)", jaw: "Upper", quadrant: "Upper Left", position: 8, type: "Molar", archSide: "Left" },

  // Quadrant 4: Lower Right (Patient Right / Doctor Left)
  48: { fdi: 48, name: "Lower Right Third Molar (Wisdom Tooth)", jaw: "Lower", quadrant: "Lower Right", position: 8, type: "Molar", archSide: "Right" },
  47: { fdi: 47, name: "Lower Right Second Molar", jaw: "Lower", quadrant: "Lower Right", position: 7, type: "Molar", archSide: "Right" },
  46: { fdi: 46, name: "Lower Right First Molar", jaw: "Lower", quadrant: "Lower Right", position: 6, type: "Molar", archSide: "Right" },
  45: { fdi: 45, name: "Lower Right Second Premolar", jaw: "Lower", quadrant: "Lower Right", position: 5, type: "Premolar", archSide: "Right" },
  44: { fdi: 44, name: "Lower Right First Premolar", jaw: "Lower", quadrant: "Lower Right", position: 4, type: "Premolar", archSide: "Right" },
  43: { fdi: 43, name: "Lower Right Canine", jaw: "Lower", quadrant: "Lower Right", position: 3, type: "Canine", archSide: "Right" },
  42: { fdi: 42, name: "Lower Right Lateral Incisor", jaw: "Lower", quadrant: "Lower Right", position: 2, type: "Incisor", archSide: "Right" },
  41: { fdi: 41, name: "Lower Right Central Incisor", jaw: "Lower", quadrant: "Lower Right", position: 1, type: "Incisor", archSide: "Right" },

  // Quadrant 3: Lower Left (Patient Left / Doctor Right)
  31: { fdi: 31, name: "Lower Left Central Incisor", jaw: "Lower", quadrant: "Lower Left", position: 1, type: "Incisor", archSide: "Left" },
  32: { fdi: 32, name: "Lower Left Lateral Incisor", jaw: "Lower", quadrant: "Lower Left", position: 2, type: "Incisor", archSide: "Left" },
  33: { fdi: 33, name: "Lower Left Canine", jaw: "Lower", quadrant: "Lower Left", position: 3, type: "Canine", archSide: "Left" },
  34: { fdi: 34, name: "Lower Left First Premolar", jaw: "Lower", quadrant: "Lower Left", position: 4, type: "Premolar", archSide: "Left" },
  35: { fdi: 35, name: "Lower Left Second Premolar", jaw: "Lower", quadrant: "Lower Left", position: 5, type: "Premolar", archSide: "Left" },
  36: { fdi: 36, name: "Lower Left First Molar", jaw: "Lower", quadrant: "Lower Left", position: 6, type: "Molar", archSide: "Left" },
  37: { fdi: 37, name: "Lower Left Second Molar", jaw: "Lower", quadrant: "Lower Left", position: 7, type: "Molar", archSide: "Left" },
  38: { fdi: 38, name: "Lower Left Third Molar (Wisdom Tooth)", jaw: "Lower", quadrant: "Lower Left", position: 8, type: "Molar", archSide: "Left" }
};

// Natural dental display order: from patient's right (doctor's left) across midline to patient's left (doctor's right)
export const UPPER_TEETH_ORDER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
export const LOWER_TEETH_ORDER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
export const ALL_FDI_TEETH = [...UPPER_TEETH_ORDER, ...LOWER_TEETH_ORDER];
export const VALID_FDI_NUMBERS = new Set(ALL_FDI_TEETH);

export function getToothInfo(fdi: number): ToothInfo | undefined {
  return TOOTH_METADATA[fdi];
}

export function isValidFdiTooth(fdi: number): boolean {
  return VALID_FDI_NUMBERS.has(fdi);
}
