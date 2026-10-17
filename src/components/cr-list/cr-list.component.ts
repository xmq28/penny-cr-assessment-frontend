import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CrApiService } from '../../api/cr-api.service';
import { SessionService } from '../../session/session.service';
import { CrStatus, CrSummary } from '../../models/cr.models';
import { idle, loading, ViewState } from '../../common/view-state';
import { formatMoney } from '../../common/money.util';

/**
 * Change Request LIST page. Loads the caller's CRs and renders loading / loaded / empty / error
 * states, plus a status filter. The load + state handling are provided as the pattern; the status
 * filter (`visibleRows`) is yours to complete.
 */
@Component({
	selector: 'app-cr-list',
	standalone: true,
	imports: [CommonModule],
	templateUrl: './cr-list.component.html',
})
export class CrListComponent implements OnInit, OnChanges {
	@Input() selectedId: string | null = null;
	@Input() refreshToken = 0;
	@Output() select = new EventEmitter<string>();

	state: ViewState<CrSummary[]> = idle();
	statusFilter: CrStatus | 'ALL' = 'ALL';
	searchTerm = '';
	readonly statuses: (CrStatus | 'ALL')[] = ['ALL', 'DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'APPLIED', 'REJECTED', 'CANCELLED'];

	constructor(private readonly api: CrApiService, private readonly session: SessionService) {}

	ngOnInit(): void {
		void this.load();
	}

	ngOnChanges(changes: SimpleChanges): void {
		if (changes['refreshToken'] && !changes['refreshToken'].firstChange) void this.load();
	}

	async load(): Promise<void> {
		this.state = loading();
		try {
			const rows = await this.api.listChangeRequests(this.session.user);
			this.state = { status: rows.length ? 'loaded' : 'empty', data: rows };
		} catch (err) {
			this.state = { status: 'error', data: null, error: (err as Error).message };
		}
	}

	onFilterChange(value: string): void {
		this.statusFilter = value as CrStatus | 'ALL';
	}

	selectRow(id: string): void {
		this.select.emit(id);
	}

	selectRowOnKey(event: KeyboardEvent, id: string): void {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			this.selectRow(id);
		}
	}

	statusLabel(status: CrStatus): string {
		return status.split('_').map((word) => word.charAt(0) + word.slice(1).toLowerCase()).join(' ');
	}

	get visibleCount(): number {
		return this.visibleRows.length;
	}

	setSearchTerm(value: string): void {
		this.searchTerm = value;
	}

	clearFilters(): void {
		this.statusFilter = 'ALL';
		this.searchTerm = '';
	}

	deltaLabel(row: CrSummary): string {
		if (row.delta === 0) return 'No change';
		return `${row.delta > 0 ? '+' : ''}${formatMoney(row.delta, row.currency)}`;
	}

	deltaTone(row: CrSummary): 'up' | 'down' | 'flat' {
		return row.delta > 0 ? 'up' : row.delta < 0 ? 'down' : 'flat';
	}

	/** Rows to render, after applying the active status filter. */
	get visibleRows(): CrSummary[] {
		const rows = this.state.data ?? [];
		const query = this.searchTerm.trim().toLocaleLowerCase();
		return rows.filter((row) => {
			const matchesStatus = this.statusFilter === 'ALL' || row.status === this.statusFilter;
			const matchesSearch = !query || `${row.id} ${row.title}`.toLocaleLowerCase().includes(query);
			return matchesStatus && matchesSearch;
		});
	}
}
