jest.mock('./posture.service', () => ({
    calculatePostureScore: jest.fn(),
}));

import { generateBadgeSvg } from './badge.service';
import { calculatePostureScore } from './posture.service';

const mockPosture = calculatePostureScore as jest.Mock;

describe('badge.service', () => {
    beforeEach(() => jest.clearAllMocks());

    it('generates SVG with green color for score >= 80', async () => {
        mockPosture.mockResolvedValue({ score: 95 });

        const svg = await generateBadgeSvg('repo-1');

        expect(svg).toContain('<svg');
        expect(svg).toContain('#2ecc71');
        expect(svg).toContain('95/100');
        expect(svg).toContain('excellent');
    });

    it('generates SVG with yellow color for score 60-79', async () => {
        mockPosture.mockResolvedValue({ score: 70 });

        const svg = await generateBadgeSvg('repo-1');

        expect(svg).toContain('#f1c40f');
        expect(svg).toContain('good');
    });

    it('generates SVG with orange color for score 40-59', async () => {
        mockPosture.mockResolvedValue({ score: 45 });

        const svg = await generateBadgeSvg('repo-1');

        expect(svg).toContain('#e67e22');
        expect(svg).toContain('fair');
    });

    it('generates SVG with red color for score < 40', async () => {
        mockPosture.mockResolvedValue({ score: 15 });

        const svg = await generateBadgeSvg('repo-1');

        expect(svg).toContain('#e74c3c');
        expect(svg).toContain('poor');
    });

    it('includes proper aria-label for accessibility', async () => {
        mockPosture.mockResolvedValue({ score: 80 });

        const svg = await generateBadgeSvg('repo-1');

        expect(svg).toContain('aria-label="security: 80/100 excellent"');
    });
});
