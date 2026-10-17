import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CrDetailComponent } from './cr-detail.component';
import { SessionService } from '../../session/session.service';
import { CrApiService } from '../../api/cr-api.service';
import { users } from '../../api/fixtures';
import { ReqUser } from '../../models/cr.models';

const flush = () => new Promise((r) => setTimeout(r, 0));

async function render(user: ReqUser, id: string): Promise<ComponentFixture<CrDetailComponent>> {
	TestBed.configureTestingModule({
		imports: [CrDetailComponent],
		providers: [{ provide: SessionService, useValue: { user } }],
	});
	await TestBed.compileComponents();
	const fixture = TestBed.createComponent(CrDetailComponent);
	fixture.componentRef.setInput('id', id);
	fixture.detectChanges(); // ngOnInit -> load()
	await flush(); // let the mock API resolve
	fixture.detectChanges(); // render the loaded state
	return fixture;
}

describe('CrDetailComponent', () => {
	it('loads and renders the change request title', async () => {
		const fixture = await render(users.approver, 'CR-1');
		expect(fixture.nativeElement.querySelector('.cr-detail__header h2').textContent).toContain('Add 1 unit of SKU-A');
	});

	it('loads the newly selected request when its id input changes', async () => {
		const fixture = await render(users.approver, 'CR-1');
		fixture.componentRef.setInput('id', 'CR-2');
		fixture.detectChanges();
		await flush();
		fixture.detectChanges();

		expect(fixture.nativeElement.querySelector('.cr-detail__header h2').textContent).toContain('Replace SKU-B supplier');
		expect(fixture.nativeElement.querySelector('.cr-status').textContent).toContain('APPLIED');
	});

	it('renders quantity and unit price before and after values', async () => {
		const fixture = await render(users.approver, 'CR-1');
		const changedRow: HTMLElement = fixture.nativeElement.querySelector('.cr-diff__row[data-kind="changed"]');

		expect(fixture.nativeElement.querySelector('.cr-detail__totals').textContent).toContain('USD 8,000.00');
		expect(fixture.nativeElement.querySelector('.cr-detail__totals').textContent).toContain('USD 8,500.00');
		expect(fixture.nativeElement.querySelector('.cr-detail__delta').textContent).toContain('USD 500.00');
		expect(changedRow.textContent).toContain('10 × USD 500.00');
		expect(changedRow.textContent).toContain('11 × USD 500.00');
		expect(changedRow.textContent).toContain('Widget A');
	});

	it('renders both descriptions for a description-only change', async () => {
		const fixture = await render(users.approver, 'CR-2');
		const changedRow: HTMLElement = fixture.nativeElement.querySelector('.cr-diff__row[data-kind="changed"]');

		expect(changedRow.textContent).toContain('Widget B');
		expect(changedRow.textContent).toContain('Widget B (new supplier)');
		expect(changedRow.textContent).toContain('30 × USD 100.00');
	});

	it('renders added and removed line items with the missing side marked', async () => {
		const fixture = await render(users.approver, 'CR-1');
		const component = fixture.componentInstance;
		const detail = component.detail;
		if (!detail) throw new Error('Expected the CR detail to be loaded');
		component.state = {
			status: 'loaded',
			data: {
				...detail,
				proposedLineItems: [
					detail.proposedLineItems[0],
					{ sku: 'SKU-C', description: 'Service C', quantity: 2, unitPrice: 75 },
				],
			},
		};
		fixture.detectChanges();

		const addedRow: HTMLElement = fixture.nativeElement.querySelector('.cr-diff__row[data-kind="added"]');
		const removedRow: HTMLElement = fixture.nativeElement.querySelector('.cr-diff__row[data-kind="removed"]');
		expect(addedRow.textContent).toContain('SKU-C');
		expect(addedRow.textContent).toContain('Service C');
		expect(addedRow.textContent).toContain('—');
		expect(removedRow.textContent).toContain('SKU-B');
		expect(removedRow.textContent).toContain('Widget B');
		expect(removedRow.textContent).toContain('—');
	});

	it('renders a unit-price-only change in the before and after values', async () => {
		const fixture = await render(users.approver, 'CR-1');
		const component = fixture.componentInstance;
		const detail = component.detail;
		if (!detail) throw new Error('Expected the CR detail to be loaded');
		component.state = {
			status: 'loaded',
			data: {
				...detail,
				proposedLineItems: detail.proposedLineItems.map((item) =>
					item.sku === 'SKU-A' ? { ...item, unitPrice: 600 } : item,
				),
			},
		};
		fixture.detectChanges();
		const changedRow: HTMLElement = fixture.nativeElement.querySelector('.cr-diff__row[data-kind="changed"]');

		expect(changedRow.textContent).toContain('10 × USD 500.00');
		expect(changedRow.textContent).toContain('11 × USD 600.00');
	});

	it('hides all actions for a read-only viewer on a pending CR', async () => {
		const fixture = await render(users.viewer, 'CR-1'); // viewer: cr_r_o only; CR-1 is PENDING_APPROVAL
		expect(fixture.nativeElement.querySelector('.cr-actions__approve')).toBeNull();
		expect(fixture.nativeElement.querySelector('.cr-actions__reject-btn')).toBeNull();
		expect(fixture.nativeElement.querySelector('.cr-actions')).toBeNull();
	});

	it('shows both actions to an org-wide approver for a CR in their org', async () => {
		const fixture = await render(users.otherOrg, 'CR-9');

		expect(fixture.nativeElement.querySelector('.cr-actions__approve')).not.toBeNull();
		expect(fixture.nativeElement.querySelector('.cr-actions__reject-btn')).not.toBeNull();
	});

	it.each(['cr_a_u', 'cr_a_w'])('does not grant unsupported %s scope without ownership metadata', async (policy) => {
		const user = { ...users.approver, policies: ['cr_r_o', policy] };
		const fixture = await render(user, 'CR-1');

		expect(fixture.nativeElement.querySelector('.cr-actions__approve')).toBeNull();
		expect(fixture.nativeElement.querySelector('.cr-actions__reject-btn')).toBeNull();
	});

	it('hides actions when an org approver cannot load another org request', async () => {
		const fixture = await render(users.otherOrg, 'CR-1');

		expect(fixture.nativeElement.querySelector('.cr-detail__error')).not.toBeNull();
		expect(fixture.nativeElement.querySelector('.cr-actions__approve')).toBeNull();
		expect(fixture.nativeElement.querySelector('.cr-actions__reject-btn')).toBeNull();
	});

	it('renders the approval timeline chronologically', async () => {
		const fixture = await render(users.approver, 'CR-1');
		const entries: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('.cr-timeline__entry');
		expect(entries[0].textContent).toContain('2026-03-02T09:00:00.000Z');
		expect(entries[1].textContent).toContain('2026-03-02T09:30:00.000Z');
		expect(entries[2].textContent).toContain('2026-03-02T10:00:00.000Z');
	});

	it('approves a pending request and updates the rendered status', async () => {
		const fixture = await render(users.approver, 'CR-1');
		await fixture.componentInstance.approve();
		fixture.detectChanges();

		expect(fixture.componentInstance.detail?.status).toBe('APPROVED');
		expect(fixture.nativeElement.querySelector('.cr-status').textContent).toContain('APPROVED');
	});

	it('keeps the request pending and shows an error when approval fails', async () => {
		const fixture = await render(users.approver, 'CR-1');
		const api = TestBed.inject(CrApiService);
		api.failNext = true;

		await fixture.componentInstance.approve();
		fixture.detectChanges();

		expect(fixture.componentInstance.detail?.status).toBe('PENDING_APPROVAL');
		expect(fixture.componentInstance.actionError).toBe('Network error');
		expect(fixture.nativeElement.querySelector('.cr-actions__error').textContent).toContain('Network error');
		expect(fixture.nativeElement.querySelector('.cr-status').textContent).toContain('PENDING_APPROVAL');
		expect((await api.getChangeRequest(users.approver, 'CR-1')).status).toBe('PENDING_APPROVAL');
	});

	it('blocks rejection until the reason contains non-whitespace text', async () => {
		const fixture = await render(users.approver, 'CR-1');
		const component = fixture.componentInstance;
		component.rejectControl.setValue('   ');
		fixture.detectChanges();

		expect((fixture.nativeElement.querySelector('.cr-actions__reject-btn') as HTMLButtonElement).disabled).toBe(true);

		await component.reject();
		fixture.detectChanges();

		expect(component.rejectControl.invalid).toBe(true);
		expect(fixture.nativeElement.querySelector('.cr-actions__reason-error').textContent).toContain('Please enter a reason');
		expect(component.detail?.status).toBe('PENDING_APPROVAL');
	});

	it('prevents a second approval while the first request is pending', async () => {
		const fixture = await render(users.approver, 'CR-1');
		const component = fixture.componentInstance;
		const api = TestBed.inject(CrApiService);
		api.latencyMs = 15;

		const first = component.approve();
		expect(component.submitting).toBe(true);
		await component.approve();
		await first;

		expect(component.detail?.audit.filter((entry) => entry.action === 'APPROVE')).toHaveLength(1);
		expect(component.submitting).toBe(false);
	});

	it('disables rendered action buttons while approval is pending', async () => {
		const fixture = await render(users.approver, 'CR-1');
		const component = fixture.componentInstance;
		const api = TestBed.inject(CrApiService);
		api.latencyMs = 30;

		const approval = component.approve();
		fixture.detectChanges();
		expect((fixture.nativeElement.querySelector('.cr-actions__approve') as HTMLButtonElement).disabled).toBe(true);
		expect((fixture.nativeElement.querySelector('.cr-actions__reject-btn') as HTMLButtonElement).disabled).toBe(true);
		await approval;
	});

	it('disables the rendered Reject button while rejection is pending', async () => {
		const fixture = await render(users.approver, 'CR-1');
		const component = fixture.componentInstance;
		TestBed.inject(CrApiService).latencyMs = 30;
		component.rejectControl.setValue('Not approved');
		fixture.detectChanges();

		const rejection = component.reject();
		fixture.detectChanges();
		expect((fixture.nativeElement.querySelector('.cr-actions__reject-btn') as HTMLButtonElement).disabled).toBe(true);
		await rejection;
	});

	it('shows an error and retains the request when rejection fails', async () => {
		const fixture = await render(users.approver, 'CR-1');
		const component = fixture.componentInstance;
		TestBed.inject(CrApiService).failNext = true;
		component.rejectControl.setValue('Not approved');

		await component.reject();
		fixture.detectChanges();

		expect(component.detail?.status).toBe('PENDING_APPROVAL');
		expect(component.actionError).toBe('Network error');
		expect(fixture.nativeElement.querySelector('.cr-actions__error').textContent).toContain('Network error');
		expect(fixture.nativeElement.querySelector('.cr-status').textContent).toContain('PENDING_APPROVAL');
		expect((await TestBed.inject(CrApiService).getChangeRequest(users.approver, 'CR-1')).status).toBe('PENDING_APPROVAL');
	});

	it('rejects a pending request with its trimmed reason', async () => {
		const fixture = await render(users.approver, 'CR-1');
		const component = fixture.componentInstance;
		component.rejectControl.setValue('  Budget change not approved  ');

		await component.reject();

		expect(component.detail?.status).toBe('REJECTED');
		expect(component.detail?.audit[component.detail.audit.length - 1].note).toBe('Budget change not approved');
	});
});
