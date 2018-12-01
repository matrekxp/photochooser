import { Component, Input } from "@angular/core";
import { NgbActiveModal} from "@ng-bootstrap/ng-bootstrap";
import {MatChipInputEvent} from "@angular/material";
import {COMMA, ENTER} from '@angular/cdk/keycodes';

@Component({
  selector: "tags",
  template: `
    <div class="modal-header">
      <h4 class="modal-title">Enter tags</h4>
      <button type="button" class="close" aria-label="Close" (click)="activeModal.dismiss('Cross click')">
        <span aria-hidden="true">&times;</span>
      </button>
    </div>
    <div class="modal-body">
      <p>All bucket photos will be updated with the entered tags</p>
      <mat-form-field style="width: 100%;">
        <mat-chip-list #chipList>
          <mat-chip *ngFor="let value of this.tags" [removable]="true" (removed)="removeTag(value)">
            {{value}}
            <mat-icon matChipRemove>cancel</mat-icon>
          </mat-chip>
          <input [matChipInputFor]="chipList" placeholder="New tags..." [matChipInputSeparatorKeyCodes]="separatorKeysCodes"
                 (matChipInputTokenEnd)="addTag($event)">
        </mat-chip-list>
      </mat-form-field>
    </div>
    <div class="modal-footer justify-content-center">
      <button type="button" class="btn btn-outline-dark" (click)="close('add_tags')">Add tags</button>
      <button type="button" class="btn btn-outline-dark" (click)="close('set_tags')">Set tags</button>
      <button type="button" class="btn btn-outline-dark" (click)="close('remove_tags')">Remove tags</button>
    </div>
  `
})
export class TagsModalContent {
  readonly separatorKeysCodes: number[] = [ENTER, COMMA];
  tags: Array<String> = [];

  constructor(public activeModal: NgbActiveModal) {}

  addTag(event: MatChipInputEvent): void {
    const input = event.input;
    const value = event.value;

    // Add our fruit
    if ((value || '').trim()) {
      this.tags.push(value.trim());
    }

    // Reset the input value
    if (input) {
      input.value = '';
    }
  }

  removeTag(value: string) {
    console.log('usuwam wartosc', value);
    const index = this.tags.indexOf(value);

    if (index >= 0) {
      this.tags.splice(index, 1);
    }
  }

  close(mode) {
    this.activeModal.close({
      mode: mode,
      tags: this.tags
    });
  }
}

