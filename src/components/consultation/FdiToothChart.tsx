import { useState, Fragment } from 'react';
import {
  TOOTH_METADATA,
  getToothInfo
} from '../../lib/toothMetadata';

export interface FdiToothChartProps {
  selectedTeeth: number[];
  onToggleTooth: (fdi: number) => void;
  plannedTeeth?: number[];
  completedTeeth?: number[];
  readOnly?: boolean;
}

interface ToothLayout {
  fdi: number;
  x: number;
  y: number;
  rot: number;
  lx: number;
  ly: number;
}

// Compact, zero-scroll coordinates for Upper Jaw (Maxillary Arch)
// Teeth occupy the primary visual space. Left = Patient Right (18..11), Right = Patient Left (21..28)
const UPPER_TEETH_LAYOUT: ToothLayout[] = [
  { fdi: 18, x: 74,  y: 198, rot: -88, lx: 40,  ly: 198 },
  { fdi: 17, x: 78,  y: 168, rot: -85, lx: 44,  ly: 168 },
  { fdi: 16, x: 84,  y: 138, rot: -78, lx: 50,  ly: 138 },
  { fdi: 15, x: 96,  y: 108, rot: -64, lx: 64,  ly: 100 },
  { fdi: 14, x: 114, y: 82,  rot: -46, lx: 86,  ly: 68  },
  { fdi: 13, x: 140, y: 64,  rot: -28, lx: 118, ly: 44  },
  { fdi: 12, x: 168, y: 52,  rot: -16, lx: 156, ly: 28  },
  { fdi: 11, x: 196, y: 46,  rot: -6,  lx: 192, ly: 20  },

  { fdi: 21, x: 224, y: 46,  rot: 6,   lx: 228, ly: 20  },
  { fdi: 22, x: 252, y: 52,  rot: 16,  lx: 264, ly: 28  },
  { fdi: 23, x: 280, y: 64,  rot: 28,  lx: 302, ly: 44  },
  { fdi: 24, x: 306, y: 82,  rot: 46,  lx: 334, ly: 68  },
  { fdi: 25, x: 324, y: 108, rot: 64,  lx: 356, ly: 100 },
  { fdi: 26, x: 336, y: 138, rot: 78,  lx: 370, ly: 138 },
  { fdi: 27, x: 342, y: 168, rot: 85,  lx: 376, ly: 168 },
  { fdi: 28, x: 346, y: 198, rot: 88,  lx: 380, ly: 198 },
];

// Compact, zero-scroll coordinates for Lower Jaw (Mandibular Arch)
// Left = Patient Right (48..41), Right = Patient Left (31..38)
const LOWER_TEETH_LAYOUT: ToothLayout[] = [
  { fdi: 48, x: 76,  y: 226, rot: -92,  lx: 42,  ly: 226 },
  { fdi: 47, x: 80,  y: 256, rot: -96,  lx: 46,  ly: 256 },
  { fdi: 46, x: 86,  y: 286, rot: -102, lx: 52,  ly: 286 },
  { fdi: 45, x: 98,  y: 316, rot: -116, lx: 66,  ly: 324 },
  { fdi: 44, x: 116, y: 342, rot: -134, lx: 88,  ly: 358 },
  { fdi: 43, x: 142, y: 360, rot: -152, lx: 120, ly: 382 },
  { fdi: 42, x: 170, y: 372, rot: -166, lx: 158, ly: 396 },
  { fdi: 41, x: 196, y: 378, rot: -176, lx: 192, ly: 404 },

  { fdi: 31, x: 224, y: 378, rot: 176,  lx: 228, ly: 404 },
  { fdi: 32, x: 250, y: 372, rot: 166,  lx: 262, ly: 396 },
  { fdi: 33, x: 278, y: 360, rot: 152,  lx: 300, ly: 382 },
  { fdi: 34, x: 304, y: 342, rot: 134,  lx: 332, ly: 358 },
  { fdi: 35, x: 322, y: 316, rot: 116,  lx: 354, ly: 324 },
  { fdi: 36, x: 334, y: 286, rot: 102,  lx: 368, ly: 286 },
  { fdi: 37, x: 340, y: 256, rot: 96,   lx: 374, ly: 256 },
  { fdi: 38, x: 344, y: 226, rot: 92,   lx: 378, ly: 226 },
];

/**
 * Anatomical Occlusal Crown Silhouette Renderer:
 * - 25% larger proportions for immediate clinical recognition
 * - Smooth 3D enamel highlights, cusp elevations & occlusal fissures
 * - Stable non-moving hover states to prevent any cursor flicker/blinking
 */
function AnatomicalCrown({
  pos,
  isSelected,
  isHovered
}: {
  pos: number;
  isSelected: boolean;
  isHovered: boolean;
}) {
  if (pos <= 2) {
    // Incisors
    const isCentral = pos === 1;
    const w = isCentral ? 14 : 12;
    const h = isCentral ? 7.5 : 6.5;

    return (
      <g>
        <rect x={-w - 4} y={-h - 4} width={(w + 4) * 2} height={(h + 4) * 2} fill="transparent" />
        <path
          d={`M ${-w},0 C ${-w},${-h} ${-w * 0.5},${-h * 1.1} 0,${-h * 1.1} C ${w * 0.5},${-h * 1.1} ${w},${-h} ${w},0 C ${w},${h} ${w * 0.5},${h * 1.1} 0,${h * 1.1} C ${-w * 0.5},${h * 1.1} ${-w},${h} ${-w},0 Z`}
          fill="url(#enamelBaseGrad)"
          stroke={isSelected ? '#0284c7' : isHovered ? '#0ea5e9' : '#baa894'}
          strokeWidth={isSelected ? '2.5' : isHovered ? '2' : '1.2'}
          filter="url(#toothShadow)"
        />
        <path
          d={`M ${-w * 0.75},-0.5 Q 0,-1.2 ${w * 0.75},-0.5`}
          stroke="#ffffff"
          strokeWidth="1.4"
          strokeLinecap="round"
          opacity="0.9"
        />
        <path
          d={`M ${-w * 0.6},${h * 0.45} Q 0,${h * 0.75} ${w * 0.6},${h * 0.45}`}
          stroke="#bdaea0"
          strokeWidth="0.8"
          fill="none"
          opacity="0.65"
        />
      </g>
    );
  }

  if (pos === 3) {
    // Canines
    const w = 15;
    const h = 13.5;

    return (
      <g>
        <rect x={-w - 4} y={-h - 4} width={(w + 4) * 2} height={(h + 4) * 2} fill="transparent" />
        <path
          d="M -13,0 C -13,-8 -6,-11.5 0,-12 C 6,-11.5 13,-8 13,0 C 13,8.5 6,11.5 0,12 C -6,11.5 -13,8.5 -13,0 Z"
          fill="url(#enamelBaseGrad)"
          stroke={isSelected ? '#0284c7' : isHovered ? '#0ea5e9' : '#baa894'}
          strokeWidth={isSelected ? '2.5' : isHovered ? '2' : '1.2'}
          filter="url(#toothShadow)"
        />
        <ellipse cx="0" cy="0" rx="4.5" ry="3.8" fill="url(#cuspHighlightGrad)" />
        <path
          d="M 0,-10 L 0,10 M -10,0 L 10,0"
          stroke="#b8a794"
          strokeWidth="0.9"
          strokeLinecap="round"
          opacity="0.65"
        />
        <circle cx="0.5" cy="-1" r="1.5" fill="#ffffff" opacity="0.9" />
      </g>
    );
  }

  if (pos <= 5) {
    // Premolars
    const isFirst = pos === 4;
    const w = isFirst ? 16 : 15.5;
    const h = isFirst ? 14 : 13.5;

    return (
      <g>
        <rect x={-w - 4} y={-h - 4} width={(w + 4) * 2} height={(h + 4) * 2} fill="transparent" />
        <path
          d={`M ${-w},-1 C ${-w},${-h} ${-w * 0.5},${-h * 1.05} 0,${-h * 1.05} C ${w * 0.5},${-h * 1.05} ${w},${-h} ${w},-1 C ${w},${h * 0.95} ${w * 0.5},${h * 1.05} 0,${h * 1.05} C ${-w * 0.5},${h * 1.05} ${-w},${h * 0.95} ${-w},-1 Z`}
          fill="url(#enamelBaseGrad)"
          stroke={isSelected ? '#0284c7' : isHovered ? '#0ea5e9' : '#baa894'}
          strokeWidth={isSelected ? '2.5' : isHovered ? '2' : '1.2'}
          filter="url(#toothShadow)"
        />
        <ellipse cx="0" cy={-h * 0.45} rx="6" ry="4.5" fill="url(#cuspHighlightGrad)" />
        <ellipse cx="0" cy={h * 0.45} rx="5.5" ry="4" fill="url(#cuspHighlightGrad)" />
        <path
          d={`M ${-w * 0.58},0 Q 0,-0.4 ${w * 0.58},0 M ${-w * 0.58},0 L ${-w * 0.78},${-h * 0.3} M ${-w * 0.58},0 L ${-w * 0.78},${h * 0.3} M ${w * 0.58},0 L ${w * 0.78},${-h * 0.3} M ${w * 0.58},0 L ${w * 0.78},${h * 0.3}`}
          stroke="#998774"
          strokeWidth="0.95"
          strokeLinecap="round"
          opacity="0.8"
        />
        <circle cx="-1.5" cy={-h * 0.5} r="1.5" fill="#ffffff" opacity="0.85" />
        <circle cx="-1" cy={h * 0.4} r="1.3" fill="#ffffff" opacity="0.75" />
      </g>
    );
  }

  // Molars
  const scale = pos === 6 ? 1.25 : pos === 7 ? 1.15 : 1.05;
  const w = 15 * scale;
  const h = 13.5 * scale;

  return (
    <g>
      <rect x={-w - 4} y={-h - 4} width={(w + 4) * 2} height={(h + 4) * 2} fill="transparent" />
      <path
        d={`M ${-w},-4 C ${-w},${-h} ${-w * 0.5},${-h * 1.08} 0,${-h * 1.08} C ${w * 0.5},${-h * 1.08} ${w},${-h} ${w},-2 C ${w},${h * 0.8} ${w * 0.55},${h * 1.08} 0,${h * 1.08} C ${-w * 0.55},${h * 1.08} ${-w},${h * 0.8} ${-w},-4 Z`}
        fill="url(#enamelBaseGrad)"
        stroke={isSelected ? '#0284c7' : isHovered ? '#0ea5e9' : '#baa894'}
        strokeWidth={isSelected ? '2.5' : isHovered ? '2' : '1.2'}
        filter="url(#toothShadow)"
      />
      <ellipse cx={-w * 0.42} cy={-h * 0.45} rx={w * 0.38} ry={h * 0.38} fill="url(#cuspHighlightGrad)" />
      <ellipse cx={w * 0.42} cy={-h * 0.45} rx={w * 0.38} ry={h * 0.38} fill="url(#cuspHighlightGrad)" />
      <ellipse cx={-w * 0.42} cy={h * 0.45} rx={w * 0.4} ry={h * 0.4} fill="url(#cuspHighlightGrad)" />
      <ellipse cx={w * 0.42} cy={h * 0.45} rx={w * 0.38} ry={h * 0.38} fill="url(#cuspHighlightGrad)" />
      <path
        d={`M ${-w * 0.58},0 Q 0,0 ${w * 0.58},0 M 0,${-h * 0.85} L 0,${h * 0.85} M ${-w * 0.58},0 L ${-w * 0.78},${-h * 0.3} M ${-w * 0.58},0 L ${-w * 0.78},${h * 0.3} M ${w * 0.58},0 L ${w * 0.78},${-h * 0.3} M ${w * 0.58},0 L ${w * 0.78},${h * 0.3}`}
        stroke="#94826f"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.85"
      />
      <circle cx="0" cy="0" r="1.4" fill="#756450" opacity="0.9" />
      <circle cx={-w * 0.45} cy={-h * 0.5} r="1.5" fill="#ffffff" opacity="0.85" />
      <circle cx={w * 0.45} cy={-h * 0.5} r="1.5" fill="#ffffff" opacity="0.85" />
      <circle cx={-w * 0.45} cy={h * 0.45} r="1.3" fill="#ffffff" opacity="0.75" />
      <circle cx={w * 0.45} cy={h * 0.45} r="1.3" fill="#ffffff" opacity="0.75" />
    </g>
  );
}

export function FdiToothChart({
  selectedTeeth,
  onToggleTooth,
  plannedTeeth: _plannedTeeth = [],
  completedTeeth = [],
  readOnly = false
}: FdiToothChartProps) {
  const [hoveredTooth, setHoveredTooth] = useState<number | null>(null);
  const hoveredInfo = hoveredTooth ? getToothInfo(hoveredTooth) : null;

  return (
    <div className="bg-gradient-to-b from-slate-50/60 to-white rounded-2xl border border-slate-200/80 p-2.5 sm:p-3 shadow-xs flex flex-col space-y-1.5 select-none w-full">
      {/* Header & Orientation Notice */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 pb-1.5 border-b border-slate-100">
        <div>
          <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-teal-500 shadow-xs"></span>
            FDI Dental Chart
          </h3>
          <p className="text-[10px] text-slate-500">
            Interactive anatomical tooth chart (ISO 3950)
          </p>
        </div>

        {/* Orientation labels */}
        <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-100/80 px-2 py-0.5 rounded-md">
          <span>Patient Right (Dr. Left)</span>
          <span className="text-slate-300">|</span>
          <span>Patient Left (Dr. Right)</span>
        </div>
      </div>

      {/* Main Dental Arch SVG Visualization */}
      <div className="relative w-full flex justify-center items-center py-0.5">
        <svg
          viewBox="0 0 420 440"
          className="w-full h-auto max-h-[360px] sm:max-h-[380px] drop-shadow-xs"
          role="img"
          aria-label="Interactive FDI Dental Arch Diagram"
        >
          <defs>
            <filter id="toothShadow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="1.4" stdDeviation="1.2" floodColor="#541b21" floodOpacity="0.25" />
            </filter>

            <filter id="selectedGlow" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="0" stdDeviation="3.5" floodColor="#0ea5e9" floodOpacity="0.75" />
            </filter>

            <linearGradient id="enamelBaseGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="25%" stopColor="#fdfcf9" />
              <stop offset="70%" stopColor="#f4ece0" />
              <stop offset="100%" stopColor="#e5d9c5" />
            </linearGradient>

            <radialGradient id="cuspHighlightGrad" cx="40%" cy="40%" r="60%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="50%" stopColor="#ffffff" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>

            <radialGradient id="softUpperGum" cx="50%" cy="40%" r="58%">
              <stop offset="0%" stopColor="#fce7ea" />
              <stop offset="50%" stopColor="#f9d5da" />
              <stop offset="85%" stopColor="#f0b6bd" />
              <stop offset="100%" stopColor="#e39aa3" />
            </radialGradient>

            <radialGradient id="softLowerGum" cx="50%" cy="60%" r="58%">
              <stop offset="0%" stopColor="#fce7ea" />
              <stop offset="50%" stopColor="#f9d5da" />
              <stop offset="85%" stopColor="#f0b6bd" />
              <stop offset="100%" stopColor="#e39aa3" />
            </radialGradient>
          </defs>

          {/* Upper Jaw Background */}
          <g className="upper-jaw-bg select-none pointer-events-none">
            <path
              d="M 58,206 C 48,138 62,56 126,28 C 165,12 255,12 294,28 C 358,56 372,138 362,206 C 334,210 310,206 288,200 C 275,116 250,68 210,64 C 170,68 145,116 132,200 C 110,206 86,210 58,206 Z"
              fill="url(#softUpperGum)"
              stroke="#eab3b9"
              strokeWidth="1"
              opacity="0.85"
            />
            <path
              d="M 134,198 C 146,118 170,72 210,68 C 250,72 274,118 286,198 Z"
              fill="#fff7f8"
              opacity="0.5"
            />
            <line
              x1="210"
              y1="46"
              x2="210"
              y2="190"
              stroke="#d48c94"
              strokeWidth="1"
              strokeDasharray="3 3"
              opacity="0.4"
            />
          </g>

          {/* Upper Jaw Badge */}
          <g className="select-none pointer-events-none">
            <rect x="12" y="6" width="92" height="18" rx="4" fill="#eff6ff" stroke="#bfdbfe" strokeWidth="1" />
            <text x="58" y="18.5" textAnchor="middle" fill="#1d4ed8" fontSize="9" fontWeight="700">
              Upper Jaw (FDI 1)
            </text>
          </g>

          {/* Lower Jaw Background */}
          <g className="lower-jaw-bg select-none pointer-events-none">
            <path
              d="M 60,218 C 50,286 64,368 128,396 C 166,412 254,412 292,396 C 356,368 370,286 360,218 C 332,214 310,218 288,224 C 275,308 250,356 210,360 C 170,356 145,308 132,224 C 110,218 88,214 60,218 Z"
              fill="url(#softLowerGum)"
              stroke="#eab3b9"
              strokeWidth="1"
              opacity="0.85"
            />
            <ellipse
              cx="210"
              cy="288"
              rx="64"
              ry="46"
              fill="#fff7f8"
              stroke="#eab3b9"
              strokeWidth="0.8"
              opacity="0.6"
            />
          </g>

          {/* Lower Jaw Badge */}
          <g className="select-none pointer-events-none">
            <rect x="12" y="416" width="92" height="18" rx="4" fill="#eff6ff" stroke="#bfdbfe" strokeWidth="1" />
            <text x="58" y="428.5" textAnchor="middle" fill="#1d4ed8" fontSize="9" fontWeight="700">
              Lower Jaw (FDI 4)
            </text>
          </g>

          {/* Midline Divider Ticks */}
          <g className="select-none pointer-events-none opacity-40">
            <line x1="210" y1="12" x2="210" y2="34" stroke="#64748b" strokeWidth="1.2" strokeDasharray="3 2" />
            <line x1="210" y1="206" x2="210" y2="218" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="3 2" />
            <circle cx="210" cy="212" r="2" fill="#64748b" />
            <line x1="210" y1="392" x2="210" y2="414" stroke="#64748b" strokeWidth="1.2" strokeDasharray="3 2" />
          </g>

          {/* 32 Teeth & Labels */}
          {[...UPPER_TEETH_LAYOUT, ...LOWER_TEETH_LAYOUT].map((item) => {
            const { fdi, x, y, rot, lx, ly } = item;
            const info = TOOTH_METADATA[fdi];
            const isSelected = selectedTeeth.includes(fdi);
            const hasCompleted = completedTeeth.includes(fdi);
            const isHovered = hoveredTooth === fdi;

            return (
              <Fragment key={fdi}>
                <g
                  role="button"
                  tabIndex={0}
                  aria-label={`Tooth ${fdi}: ${info.name}`}
                  transform={`translate(${x}, ${y}) rotate(${rot})`}
                  onClick={() => !readOnly && onToggleTooth(fdi)}
                  onKeyDown={(e) => {
                    if (!readOnly && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      onToggleTooth(fdi);
                    }
                  }}
                  onMouseEnter={() => setHoveredTooth(fdi)}
                  onMouseLeave={() => setHoveredTooth(null)}
                  className={readOnly ? 'cursor-default' : 'cursor-pointer'}
                >
                  <AnatomicalCrown
                    pos={info.position}
                    isSelected={isSelected}
                    isHovered={isHovered}
                  />

                  {isSelected && (
                    <g filter="url(#selectedGlow)">
                      <ellipse
                        cx="0"
                        cy="0"
                        rx={info.position >= 6 ? 19 : info.position >= 4 ? 16 : 14}
                        ry={info.position >= 6 ? 17 : info.position >= 4 ? 14 : 9}
                        fill="#38bdf8"
                        fillOpacity="0.45"
                        stroke="#0284c7"
                        strokeWidth="2.4"
                      />
                    </g>
                  )}

                  {hasCompleted && (
                    <circle
                      cx="0"
                      cy="0"
                      r="3.5"
                      fill="#10b981"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                  )}
                </g>

                <g
                  onClick={() => !readOnly && onToggleTooth(fdi)}
                  onMouseEnter={() => setHoveredTooth(fdi)}
                  onMouseLeave={() => setHoveredTooth(null)}
                  className={readOnly ? 'cursor-default' : 'cursor-pointer'}
                >
                  <text
                    x={lx}
                    y={ly + 4}
                    textAnchor="middle"
                    fill={
                      isSelected
                        ? '#0284c7'
                        : isHovered
                        ? '#0ea5e9'
                        : hasCompleted
                        ? '#047857'
                        : '#334155'
                    }
                    fontSize="10.5"
                    fontWeight={isSelected ? '800' : hasCompleted ? '700' : '600'}
                    className="select-none pointer-events-none font-sans"
                  >
                    {fdi}
                  </text>
                </g>
              </Fragment>
            );
          })}
        </svg>
      </div>

      {/* Tooltip & Status Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5 pt-1.5 border-t border-slate-100 text-xs min-h-[22px]">
        {hoveredInfo ? (
          <div className="flex items-center gap-1.5 text-slate-700 animate-fadeIn">
            <span className="font-bold text-teal-800 bg-teal-100 px-1.5 py-0.2 rounded text-[10px]">
              FDI {hoveredInfo.fdi}
            </span>
            <span className="font-semibold text-slate-900 text-[11px]">{hoveredInfo.name}</span>
            <span className="text-slate-400">•</span>
            <span className="text-slate-500 text-[10px]">{hoveredInfo.jaw} Jaw ({hoveredInfo.type})</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-slate-500 text-[10px]">
            <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-teal-100 text-teal-700 font-bold text-[9px]">
              i
            </span>
            <span>Click tooth to select • FDI standard (11–48)</span>
          </div>
        )}

        <div className="flex items-center gap-2.5 text-[9.5px] text-slate-500 shrink-0">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-teal-600"></span> Selected
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Completed
          </span>
        </div>
      </div>
    </div>
  );
}
