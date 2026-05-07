import { Request, Response, NextFunction } from 'express';
import { listAnalyzerRules, suggestRule, listRuleSuggestions, approveRuleSuggestion, rejectRuleSuggestion } from '../services/rules.service';
import { recordAuditEvent } from '../services/audit.service';

export async function listRulesHandler(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const rules = listAnalyzerRules();
        res.status(200).json({ rules });
    } catch (error) {
        next(error);
    }
}

export async function suggestRuleHandler(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const userId = req.userId!;
        const { title, description, category, pattern, severity } = req.body;

        if (!title || !description || !category || !pattern || !severity) {
            res.status(400).json({ error: 'title, description, category, pattern, and severity are required.' });
            return;
        }

        const validSeverities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
        if (!validSeverities.includes(severity)) {
            res.status(400).json({ error: `severity must be one of: ${validSeverities.join(', ')}` });
            return;
        }

        const suggestion = await suggestRule(userId, title, description, category, pattern, severity);

        await recordAuditEvent({
            userId,
            action: 'rule.suggested',
            entity: 'RuleSuggestion',
            entityId: suggestion.id,
            metadata: { title, category },
        });

        res.status(201).json({ suggestion });
    } catch (error) {
        next(error);
    }
}

export async function listSuggestionsHandler(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const status = req.query.status as string | undefined;
        const suggestions = await listRuleSuggestions(status);
        res.status(200).json({ suggestions });
    } catch (error) {
        next(error);
    }
}

export async function approveSuggestionHandler(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const userId = req.userId!;
        const { id } = req.params;
        const { reviewNote } = req.body;

        const updated = await approveRuleSuggestion(id, reviewNote);

        await recordAuditEvent({
            userId,
            action: 'rule.approved',
            entity: 'RuleSuggestion',
            entityId: id,
        });

        res.status(200).json({ suggestion: updated });
    } catch (error) {
        next(error);
    }
}

export async function rejectSuggestionHandler(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const userId = req.userId!;
        const { id } = req.params;
        const { reviewNote } = req.body;

        const updated = await rejectRuleSuggestion(id, reviewNote);

        await recordAuditEvent({
            userId,
            action: 'rule.rejected',
            entity: 'RuleSuggestion',
            entityId: id,
        });

        res.status(200).json({ suggestion: updated });
    } catch (error) {
        next(error);
    }
}
