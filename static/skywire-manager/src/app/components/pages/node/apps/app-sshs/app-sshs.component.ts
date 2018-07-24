import { Component } from '@angular/core';
import { AppsService } from '../../../../../services/apps.service';
import { MatDialog } from '@angular/material';
import { LogComponent } from '../log/log.component';
import { AppWrapper } from '../apps.component';
import { SshsStartupComponent } from './sshs-startup/sshs-startup.component';
import { SshsWhitelistComponent } from './sshs-whitelist/sshs-whitelist.component';

@Component({
  selector: 'app-app-sshs',
  templateUrl: './app-sshs.component.html',
  styleUrls: ['./app-sshs.component.css']
})
export class AppSshsComponent extends AppWrapper {
  constructor(
    private appsService: AppsService,
    private dialog: MatDialog,
  ) {
    super();
  }

  start() {
    this.appsService.startSshServer().subscribe();
  }

  showStartupConfig() {
    this.dialog.open(SshsStartupComponent, {
      data: {
        node: this.node,
      },
    });
  }

  showWhitelist() {
    this.dialog.open(SshsWhitelistComponent, {
      data: {
        node: this.app,
        app: this.app,
      },
    });
  }

  showLog() {
    this.dialog.open(LogComponent, {
      data: {
        app: this.app,
      },
    });
  }
}
