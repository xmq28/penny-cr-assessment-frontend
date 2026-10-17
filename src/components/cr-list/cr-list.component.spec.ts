import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CrListComponent } from './cr-list.component';
import { SessionService } from '../../session/session.service';
import { CrApiService } from '../../api/cr-api.service';
import { users } from '../../api/fixtures';
import { ReqUser } from '../../models/cr.models';

const flush = () => new Promise((r) => setTimeout(r, 0));

async function render(user: ReqUser, setupApi?: (api: CrApiService) => void): Promise<ComponentFixture<CrListComponent>> {
	TestBed.configureTestingModule({
		imports: [CrListComponent],
		providers: [{ provide: SessionService, useValue: { user } }],
	});
	await TestBed.compileComponents();
	if (setupApi) setupApi(TestBed.inject(CrApiService));
	const fixture = TestBed.createComponent(CrListComponent);
	fixture.detectChanges(); // ngOnInit -> load()
	await flush(); // let the mock API resolve
	fixture.detectChanges(); // render the loaded/empty state
	return fixture;
}

describe('CrListComponent', () => {
	it('renders a row per change request in the user org', async () => {
		const fixture = await render(users.approver);
		expect(fixture.nativeElement.querySelectorAll('.cr-list__row').length).toBe(3); // org-alpha: CR-1, CR-2, CR-3
		expect(fixture.nativeElement.querySelector('.cr-status[data-status="PENDING_APPROVAL"]').textContent.trim()).toBe('Pending Approval');
	});

	it('filters rendered rows by the selected status', async () => {
		const fixture = await render(users.approver);
		const filter: HTMLSelectElement = fixture.nativeElement.querySelector('.cr-list__filter');
		filter.value = 'DRAFT';
		filter.dispatchEvent(new Event('change'));
		fixture.detectChanges();

		const rows: NodeListOf<HTMLTableRowElement> = fixture.nativeElement.querySelectorAll('.cr-list__row');
		expect(rows.length).toBe(1);
		expect(rows[0].textContent).toContain('CR-3');
	});

	it('searches requests by identifier and title', async () => {
		const fixture = await render(users.approver);
		const search: HTMLInputElement = fixture.nativeElement.querySelector('.cr-list__search');
		search.value = 'supplier';
		search.dispatchEvent(new Event('input'));
		fixture.detectChanges();

		const rows: NodeListOf<HTMLTableRowElement> = fixture.nativeElement.querySelectorAll('.cr-list__row');
		expect(rows).toHaveLength(1);
		expect(rows[0].textContent).toContain('CR-2');
	});

	it('clears both search and status filters', async () => {
		const fixture = await render(users.approver);
		const component = fixture.componentInstance;
		component.statusFilter = 'DRAFT';
		component.searchTerm = 'not a match';
		fixture.detectChanges();
		component.clearFilters();
		fixture.detectChanges();

		expect(component.statusFilter).toBe('ALL');
		expect(component.searchTerm).toBe('');
		expect(fixture.nativeElement.querySelectorAll('.cr-list__row')).toHaveLength(3);
	});

	it('selects a request when its row is activated from the keyboard', async () => {
		const fixture = await render(users.approver);
		const component = fixture.componentInstance;
		const selected = jest.fn();
		component.select.subscribe(selected);
		const row: HTMLTableRowElement = fixture.nativeElement.querySelector('.cr-list__row');

		expect(row.getAttribute('tabindex')).toBe('0');
		row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

		expect(selected).toHaveBeenCalledWith('CR-1');
	});

	it('shows a filtered no-results message without replacing the loaded organization state', async () => {
		const fixture = await render(users.approver);
		const filter: HTMLSelectElement = fixture.nativeElement.querySelector('.cr-list__filter');
		filter.value = 'CANCELLED';
		filter.dispatchEvent(new Event('change'));
		fixture.detectChanges();

		expect(fixture.nativeElement.querySelector('.cr-list__no-results').textContent).toContain('No change requests match');
		expect(fixture.nativeElement.querySelector('.cr-list__empty')).toBeNull();
		expect(fixture.nativeElement.querySelector('.cr-list__table')).toBeNull();
	});

	it('shows loading while the API request is delayed', async () => {
		const fixture = await render(users.approver, (api) => (api.latencyMs = 20));
		expect(fixture.nativeElement.querySelector('.cr-list__loading')).not.toBeNull();
		await new Promise((resolve) => setTimeout(resolve, 25));
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('.cr-list__table')).not.toBeNull();
	});

	it('shows an error and can retry a failed load', async () => {
		const fixture = await render(users.approver, (api) => (api.failNext = true));
		expect(fixture.nativeElement.querySelector('.cr-list__error').textContent).toContain('Network error');

		(fixture.nativeElement.querySelector('.cr-list__error button') as HTMLButtonElement).click();
		await flush();
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelectorAll('.cr-list__row').length).toBe(3);
	});

	it('shows the empty state when the org has no change requests', async () => {
		const fixture = await render({ id: 'x', orgCode: 'org-empty', policies: ['cr_r_o'] });
		expect(fixture.nativeElement.querySelector('.cr-list__empty')).not.toBeNull();
		expect(fixture.nativeElement.querySelector('.cr-list__no-results')).toBeNull();
		expect(fixture.nativeElement.querySelector('.cr-list__table')).toBeNull();
	});
});
