import { Component, Input } from '@angular/core';
import { NgbActiveModal} from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'pre-action-warning',
  template: `
    <div class="modal-header">
      <h4 class="modal-title">{{name}} action</h4>
      <button type="button" class="close" aria-label="Close" (click)="activeModal.dismiss('Cross click')">
        <span aria-hidden="true">&times;</span>
      </button>
    </div>
    <div class="modal-body">
      <p>One or more of selected directories contains photos from other buckets:</p>
      <ul>
        <li *ngFor="let photo of photos">{{this.relativePath(photo.filePath)}} ({{photo.bucket.name}})</li>
      </ul>
      <p>What do you want to do with them?</p>
    </div>
    <div class="modal-footer justify-content-center">
      <button type="button" class="btn btn-outline-dark" (click)="activeModal.close('continue')">Continue action</button>
      <button type="button" class="btn btn-outline-dark" (click)="activeModal.close('clean_buckets')">Clean buckets</button>
      <button type="button" class="btn btn-outline-dark" (click)="activeModal.close('nothing')">Nothing</button>
    </div>
  `
})
export class PreActionWarningModalContent {
  @Input() photos;
  @Input() sourceDir;
  @Input() name;

  constructor(public activeModal: NgbActiveModal) {}

  relativePath(photoPath) {
    return photoPath.substring(this.sourceDir.length, photoPath.length);
  }
}

