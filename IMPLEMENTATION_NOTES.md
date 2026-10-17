# Implementation Notes

## 1. What I changed

- Fixed line-item change detection for quantity and description changes in addition to unit-price changes. Added tests for quantity-only and description-only changes.
- Completed the list status filter and added tests for filtering, loading, empty, loaded, and error/retry states.
- Sorted the detail timeline oldest-first without mutating the API's audit array.
- Gated approval and rejection on `PENDING_APPROVAL` status and the supported org-wide approval policy. Unauthorized users do not see action controls. Implemented both API actions, visible submitting/error state, and rejection-reason validation.
- Added before/after descriptions to the diff preview so description-only changes are understandable, and added a distinct no-results message when a selected filter matches no requests.
- Added a responsive single-column layout for narrow screens and contained wide tables in horizontally scrollable regions.
- Changed the mock API to update its in-memory request only after the simulated response succeeds. A simulated network failure therefore does not commit an action.
- Reload the detail when the selected CR changes, and refresh the list after a successful approve or reject so both panes reflect the updated status.

## 2. Component and state model

The app shell keeps the selected CR ID and current demo user, then passes the selected ID into the detail component. The list and detail components each expose an explicit `ViewState` for loading, loaded, empty, or error data and render those states in their templates. The list filters loaded summaries in `visibleRows` and reloads when the shell increments its refresh token after a successful action. The detail derives diff rows and chronological audit entries from the loaded CR and reloads when its selected ID changes; successful actions replace the loaded detail with the API response and emit a refresh event, while failures retain the current detail and set an action error. `submitting` blocks repeated actions while a request is in flight.

## 3. Invariants I keep

| Invariant | How / where |
|---|---|
| Only rows matching the selected status appear, except `ALL`. | `CrListComponent.visibleRows` |
| Timeline display is oldest-first and does not reorder source audit data. | `CrDetailComponent.timeline` sorts a copy |
| Actions require a pending request, `cr_a_o`, and a matching CR/user organization. | `canApprove` and `canReject`; action methods also guard before calling the API |
| Unsupported user/workspace scopes never grant approval implicitly. | `canApproveChangeRequest` denies them until ownership/workspace data exists |
| Blank or whitespace-only rejection reasons cannot be submitted. | Required and non-whitespace validators, with a guard in `reject()` |
| A failed mock response does not mutate the stored CR. | `CrApiService.transition()` commits after `settle()` succeeds |
| A slow action cannot be submitted twice through the component method. | `submitting` guard in both action methods |

## 4. Testing strategy

Component tests assert rendered list loading, empty, error/retry, filtered no-results and selected-status states; rendered diff added, removed, changed, and unchanged rows, descriptions, quantity/price comparisons, and totals/delta; timeline order; action visibility and supported/unsupported scope behavior; rendered disabled controls during pending calls; action status/error outcomes; validation; and duplicate-action prevention during simulated latency. App-level tests verify that successful approval and rejection refresh the rendered list status. Diff utility tests cover added, removed, quantity-changed, and description-changed rows. The mock API's `latencyMs` and `failNext` controls exercise asynchronous behavior locally.

## 5. Assumptions

- The brief defines scope labels (`u` = user, `w` = workspace, `o` = org), and explicitly says `cr_a_o` permits approval of any CR in the org. `ReqUser` has a user ID and org code, while `CrSummary` has an org code but no owner or workspace ID. Therefore the implementation enforces `cr_a_o` only when user and CR org codes match, and denies `cr_a_u` / `cr_a_w` rather than guessing their ownership rules. Those scopes need owner/workspace identifiers and clarified semantics before they can be supported.
- The brief has no separate reject policy, so Reject uses the same supported `cr_a_o` authorization as Approve.
- A description-only change is classified as `changed`; this matches the supplier-change fixture, whose price and quantity are unchanged but description differs.
- The mock API commits only when its simulated call succeeds. This makes its behavior consistent with the UI's error handling and makes failure scenarios testable without hidden state changes.
- A user outside the supported approval scope sees neither Approve nor Reject controls; the read-only viewer still sees request data.

## 6. Where I used AI

I used GitHub Copilot to inspect the scaffold and assessment instructions, make the focused component/service changes, add tests, and draft these notes. I reviewed the behavior against the fixtures and tests and can explain the changes.

## 7. What I'd improve with more time

- Upgrade the scaffold's Angular 15 dependencies after agreeing on a supported framework version; the current production dependency audit reports high-severity advisories, and the audit's automatic fix proposes a breaking major upgrade.

## 8. Verification and remaining limitations

- Verified locally after `npm ci`: `npm test -- --runInBand` (33 tests), `npm run build`, `npm run lint`, and `npm run typecheck` all pass.
- The environment used Node 24.13.0, while `package.json` requires Node 18.20.x; npm emitted an `EBADENGINE` warning. Repeat the clean install on Node 18.20.x for an environment-matched verification.
- `npm audit --omit=dev` reports two high-severity advisories in the pinned Angular 15 runtime dependencies. `npm audit fix --force` proposes Angular 21, a breaking major upgrade, so no automatic dependency change was applied.
- A 375px browser viewport check showed no page-level horizontal overflow; wide tables remain scrollable within their own regions.
- User-level and workspace-level approval cannot be implemented safely without CR owner and workspace identifiers. The brief does not define a separate reject policy.
- The required 5–8 minute walkthrough recording still needs to be recorded.

## 9. Walkthrough recording outline

- 0:00–0:45: Introduce the reviewer workflow and the Acting as switcher.
- 0:45–1:30: Filter the alpha-org list by Draft and Applied, then restore All and select CR-1.
- 1:30–2:30: Walk through the before/after diff, total delta, and oldest-first approval timeline.
- 2:30–3:15: Switch to viewer and show that request data remains visible while action controls are absent; switch back to approver.
- 3:15–4:00: Reject a pending request with a reason and show the updated detail and list status.
- 4:00–4:45: Show an action failure and explain that the original status is retained; `CrApiService.failNext` can be set in a debugger before clicking an action to simulate the failure.
- 4:45–6:00: Explain the non-trivial permission decision: org-wide approval is checked against the CR org, while user/workspace scopes are denied because owner/workspace identifiers are absent.
