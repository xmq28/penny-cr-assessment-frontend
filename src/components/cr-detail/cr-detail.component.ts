import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { CrApiService } from '../../api/cr-api.service';
import { SessionService } from '../../session/session.service';
import { CrDetail, TimelineEntry } from '../../models/cr.models';
import { idle, loading, ViewState } from '../../common/view-state';
import { canApproveChangeRequest } from '../../common/permissions';
import { computeDiff, DiffRow } from '../diff.util';
import { formatMoney } from '../../common/money.util';

/**
 * Change Request DETAIL page: loads a CR and renders the diff/preview, the approval timeline, and
 * permission-aware Approve/Reject actions. `load`, the diff binding, and the template skeleton are
 * provided; the timeline ordering, permission gating, actions, and reject validation are yours.
 */
@Component({
	selector: 'app-cr-detail',
	standalone: true,
	imports: [CommonModule, ReactiveFormsModule],
	templateUrl: './cr-detail.component.html',
})
export class CrDetailComponent implements OnInit, OnChanges {
	@Input() id!: string;
	@Output() actionSucceeded = new EventEmitter<void>();

	state: ViewState<CrDetail> = idle();
	submitting = false;
	actionError?: string;
	rejectControl = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/\S/)] });

	constructor(private readonly api: CrApiService, private readonly session: SessionService) {}

	ngOnInit(): void {
		void this.load();
	}

	ngOnChanges(changes: SimpleChanges): void {
		if (changes['id'] && !changes['id'].firstChange) void this.load();
	}

	async load(): Promise<void> {
		this.state = loading();
		this.actionError = undefined;
		try {
			const detail = await this.api.getChangeRequest(this.session.user, this.id);
			this.state = { status: 'loaded', data: detail };
		} catch (err) {
			this.state = { status: 'error', data: null, error: (err as Error).message };
		}
	}

	get detail(): CrDetail | null {
		return this.state.data;
	}

	get diff(): DiffRow[] {
		return this.detail ? computeDiff(this.detail.baselineLineItems, this.detail.proposedLineItems) : [];
	}

	/** Approval timeline, oldest-first. */
	get timeline(): TimelineEntry[] {
		return [...(this.detail?.audit ?? [])].sort((left, right) => Date.parse(left.at) - Date.parse(right.at));
	}

	timelineAction(action: string): string {
		return action.split('_').map((word) => word.charAt(0) + word.slice(1).toLowerCase()).join(' ');
	}

	deltaTone(delta: number): 'up' | 'down' | 'flat' {
		return delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
	}

	deltaIcon(delta: number): string {
		return delta > 0 ? '#i-arrow-up' : delta < 0 ? '#i-arrow-down' : '#i-minus';
	}

	isQuantityChanged(row: DiffRow): boolean {
		return !!row.baseline && !!row.proposed && row.baseline.quantity !== row.proposed.quantity;
	}

	isUnitPriceChanged(row: DiffRow): boolean {
		return !!row.baseline && !!row.proposed && row.baseline.unitPrice !== row.proposed.unitPrice;
	}

	isDescriptionChanged(row: DiffRow): boolean {
		return !!row.baseline && !!row.proposed && row.baseline.description !== row.proposed.description;
	}

	/** Whether the current user may approve the loaded CR. */
	get canApprove(): boolean {
		return !!this.detail && this.detail.status === 'PENDING_APPROVAL' && canApproveChangeRequest(this.session.user, this.detail);
	}

	get canReject(): boolean {
		return this.canApprove;
	}

	fmt(amount: number): string {
		return this.detail ? formatMoney(amount, this.detail.currency) : String(amount);
	}

	async approve(): Promise<void> {
		if (!this.canApprove || this.submitting) return;
		this.submitting = true;
		this.actionError = undefined;
		try {
			const updated = await this.api.approve(this.session.user, this.id, new Date().toISOString());
			this.state = { status: 'loaded', data: updated };
			this.actionSucceeded.emit();
		} catch (err) {
			this.actionError = (err as Error).message;
		} finally {
			this.submitting = false;
		}
	}

	async reject(): Promise<void> {
		this.rejectControl.markAsTouched();
		if (!this.canReject || this.submitting || this.rejectControl.invalid) return;
		this.submitting = true;
		this.actionError = undefined;
		try {
			const updated = await this.api.reject(
				this.session.user,
				this.id,
				new Date().toISOString(),
				this.rejectControl.value.trim(),
			);
			this.state = { status: 'loaded', data: updated };
			this.actionSucceeded.emit();
		} catch (err) {
			this.actionError = (err as Error).message;
		} finally {
			this.submitting = false;
		}
	}
}
