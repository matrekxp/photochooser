import { Component, OnInit, Input } from '@angular/core';
import {HomeComponent} from '../home.component';

@Component({
  selector: 'app-status',
  templateUrl: './status.component.html',
  styleUrls: ['./status.component.scss']
})
export class StatusComponent implements OnInit {

  @Input() alert;
  @Input() actionInProgress;

  get EMPTY_ALERT() {
    return HomeComponent.EMPTY_ALERT;
  }

  constructor() {
  }

  ngOnInit() {
  }

  closeAlert() {
    this.alert = HomeComponent.EMPTY_ALERT;
  }

}
