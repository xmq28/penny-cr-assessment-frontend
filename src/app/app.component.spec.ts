import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('AppComponent action refresh', () => {
	let fixture: ComponentFixture<AppComponent>;

	beforeEach(async () => {
		TestBed.configureTestingModule({ imports: [AppComponent] });
		await TestBed.compileComponents();
		fixture = TestBed.createComponent(AppComponent);
		fixture.detectChanges();
		await flush();
		fixture.detectChanges();
	});

	it.each([
		['approve', 'APPROVED'],
		['reject', 'REJECTED'],
	])('refreshes the list after a successful %s', async (action, expectedStatus) => {
		if (action === 'reject') {
			const reason: HTMLTextAreaElement = fixture.nativeElement.querySelector('.cr-actions__reason');
			reason.value = 'Budget change not approved';
			reason.dispatchEvent(new Event('input'));
			fixture.detectChanges();
		}

		const buttonClass = action === 'approve' ? '.cr-actions__approve' : '.cr-actions__reject-btn';
		(fixture.nativeElement.querySelector(buttonClass) as HTMLButtonElement).click();
		await flush();
		fixture.detectChanges();
		await flush();
		fixture.detectChanges();

		const requestRow: HTMLElement = [...fixture.nativeElement.querySelectorAll('.cr-list__row')].find((row: HTMLElement) =>
			row.textContent?.includes('CR-1'),
		);
		expect(requestRow.textContent).toContain(expectedStatus === 'APPROVED' ? 'Approved' : 'Rejected');
	});
});