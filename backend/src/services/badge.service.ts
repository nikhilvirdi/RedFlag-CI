import { calculatePostureScore } from './posture.service';

function getColor(score: number): string {
    if (score >= 80) return '#2ecc71';
    if (score >= 60) return '#f1c40f';
    if (score >= 40) return '#e67e22';
    return '#e74c3c';
}

function getLabel(score: number): string {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'fair';
    return 'poor';
}

export async function generateBadgeSvg(repositoryId: string): Promise<string> {
    const posture = await calculatePostureScore(repositoryId);
    const score = posture.score;
    const color = getColor(score);
    const label = getLabel(score);
    const labelText = 'security';
    const valueText = `${score}/100 ${label}`;

    const labelWidth = 60;
    const valueWidth = 100;
    const totalWidth = labelWidth + valueWidth;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="${labelText}: ${valueText}">
  <title>${labelText}: ${valueText}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${totalWidth}" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="20" fill="#555"/>
    <rect x="${labelWidth}" width="${valueWidth}" height="20" fill="${color}"/>
    <rect width="${totalWidth}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="11">
    <text aria-hidden="true" x="${labelWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${labelText}</text>
    <text x="${labelWidth / 2}" y="14">${labelText}</text>
    <text aria-hidden="true" x="${labelWidth + valueWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${valueText}</text>
    <text x="${labelWidth + valueWidth / 2}" y="14">${valueText}</text>
  </g>
</svg>`;
}
