
import { CrSummary, ReqUser } from '../models/cr.models';

/** Policy-string helpers. Policies are `cr_{action}_{scope}` (see README). */
export function hasPolicy(user: ReqUser, policy: string): boolean {
	return !!user && user.policies.includes(policy);
}

/**
 * Checks approval against facts represented by the current model. User and workspace scopes are
 * denied until CR ownership and workspace identifiers are available for a meaningful comparison.
 */
export function canApproveChangeRequest(user: ReqUser, request: Pick<CrSummary, 'orgCode'>): boolean {
	return hasPolicy(user, 'cr_a_o') && user.orgCode === request.orgCode;
}
