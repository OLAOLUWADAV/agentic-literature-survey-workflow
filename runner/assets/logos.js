/**
 * School logos as embedded data URLs.
 * SQI College of ICT (LOGO1) · Caleb University (LOGO2)
 *
 * Uses SVG data URLs — always valid, no external request, renders in every browser
 * and in standalone offline HTML reports.  When the user supplies real JPEG/PNG
 * photographs, replace the SVG strings below with:
 *   const LOGO1 = 'data:image/jpeg;base64,' + fs.readFileSync('path/to/sqi.jpg').toString('base64');
 */

const SQI_SVG = `<svg viewBox="0 0 46 54" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M23 2L3 11v18c0 12 9 21 20 23 11-2 20-11 20-23V11z" fill="#0d1f3d" stroke="#c8900a" stroke-width="1.8"/>
  <path d="M23 7L8 14.5v14.5c0 9.5 6.5 16.5 15 18.5 8.5-2 15-9 15-18.5V14.5z" fill="none" stroke="#c8900a" stroke-width="0.6" opacity="0.5" stroke-dasharray="2.5 2"/>
  <text x="23" y="31" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="14" fill="#e8b430" letter-spacing="0.5">SQI</text>
  <text x="23" y="40" text-anchor="middle" font-family="Arial,sans-serif" font-size="5.5" fill="rgba(232,180,48,.65)" letter-spacing="2.5">ICT</text>
  <circle cx="11" cy="26" r="1.8" fill="#c8900a" opacity="0.75"/>
  <circle cx="35" cy="26" r="1.8" fill="#c8900a" opacity="0.75"/>
  <line x1="12.8" y1="26" x2="17" y2="26" stroke="#c8900a" stroke-width="0.9" opacity="0.55"/>
  <line x1="29" y1="26" x2="33.2" y2="26" stroke="#c8900a" stroke-width="0.9" opacity="0.55"/>
  <circle cx="17" cy="26" r="1.2" fill="none" stroke="#c8900a" stroke-width="0.7" opacity="0.55"/>
  <circle cx="29" cy="26" r="1.2" fill="none" stroke="#c8900a" stroke-width="0.7" opacity="0.55"/>
</svg>`;

const CU_SVG = `<svg viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="26" cy="26" r="24" fill="#0d1f3d" stroke="#c8900a" stroke-width="1.8"/>
  <circle cx="26" cy="26" r="20" fill="none" stroke="#c8900a" stroke-width="0.6" stroke-dasharray="2.2 1.8"/>
  <text x="26" y="12.5" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="5" fill="#e8b430" letter-spacing="1.8">CALEB</text>
  <text x="26" y="17.5" text-anchor="middle" font-family="Arial,sans-serif" font-size="3.5" fill="rgba(232,180,48,.7)" letter-spacing="1">UNIVERSITY</text>
  <rect x="14" y="21" width="10" height="13" rx="1.2" fill="#c8900a" opacity="0.9"/>
  <rect x="28" y="21" width="10" height="13" rx="1.2" fill="#c8900a" opacity="0.9"/>
  <rect x="23.5" y="20" width="5" height="15" rx="1" fill="#c8900a"/>
  <line x1="16" y1="25" x2="22" y2="25" stroke="#0d1f3d" stroke-width="0.9"/>
  <line x1="16" y1="28" x2="22" y2="28" stroke="#0d1f3d" stroke-width="0.9"/>
  <line x1="16" y1="31" x2="22" y2="31" stroke="#0d1f3d" stroke-width="0.9"/>
  <line x1="30" y1="25" x2="36" y2="25" stroke="#0d1f3d" stroke-width="0.9"/>
  <line x1="30" y1="28" x2="36" y2="28" stroke="#0d1f3d" stroke-width="0.9"/>
  <line x1="30" y1="31" x2="36" y2="31" stroke="#0d1f3d" stroke-width="0.9"/>
  <text x="26" y="45" text-anchor="middle" font-family="Arial,sans-serif" font-size="3.5" fill="rgba(232,180,48,.55)" letter-spacing="0.8">IMOTA · LAGOS</text>
  <line x1="10" y1="41" x2="16" y2="41" stroke="#c8900a" stroke-width="0.5" opacity="0.4"/>
  <line x1="36" y1="41" x2="42" y2="41" stroke="#c8900a" stroke-width="0.5" opacity="0.4"/>
</svg>`;

const LOGO1 = 'data:image/svg+xml;base64,' + Buffer.from(SQI_SVG).toString('base64');
const LOGO2 = 'data:image/svg+xml;base64,' + Buffer.from(CU_SVG).toString('base64');

module.exports = { LOGO1, LOGO2 };
