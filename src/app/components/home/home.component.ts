import {Component, HostListener, OnInit, ViewChild} from '@angular/core';
import * as fs from 'fs';
import * as fse from 'fs-extra';
import {IActionMapping, ITreeOptions, KEYS, TREE_ACTIONS, TreeComponent, TreeModel} from 'angular-tree-component';
import * as keyShortcuts from 'electron-localshortcut';
import {remote} from 'electron';
import * as storage from 'electron-json-storage/lib/storage';
import {NgbModal} from '@ng-bootstrap/ng-bootstrap';
import {winattr} from 'winattr';
import {PreActionWarningModalContent} from '../modals/pre-action-warning';

// import {exiftool} from 'exiftool-vendored';
// const exiftool = require('exiftool-vendored').exiftool;

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {

  private static EMPTY_ALERT: IAlert = {type: '', message: ''};
  get EMPTY_ALERT() {
    return HomeComponent.EMPTY_ALERT;
  }

  @ViewChild('photoTree') treeComponent: TreeComponent;

  buckets: Array<Bucket>;
  activeBucket: Bucket;
  actionInProgress: Action;
  alert: IAlert = HomeComponent.EMPTY_ALERT;

  sourcePath = '/Users/mskalski/dev/my_projects/PhotoViewer/photo-viewer/src/main/resources/';
  destinationPath = '/Users/mskalski/Desktop';
  nodes: Array<File> = [];
  photoPath = '';
  screenHeight;

  shiftDown = false;
  showBucketMode = false;
  fullScreenMode = false;

  actionMapping: IActionMapping = {
    mouse: {
      contextMenu: (tree, node, $event) => {
        $event.preventDefault();
        alert(`context menu for ${node.data.name}`);
      },
      dblClick: (tree, node, $event) => {
        // this.fullScreenMode = true;
        // const currentWindow = remote.getCurrentWindow();
        // currentWindow.setFullScreen(true);
      },
      click: (tree, node, $event) => {
        console.log('mouse click is shift', $event.shiftKey);
        this.photoPath = 'file:///' + node.data.filePath;
        TREE_ACTIONS.FOCUS(tree, node, $event);
      }
    },
    keys: {
      [KEYS.DOWN]: (tree, node, $event) => {
      },
      [KEYS.UP]: (tree, node, $event) => {
      }
    }
  };
  options: ITreeOptions = {
    actionMapping: this.actionMapping
  };

  lastFocusEvent: any;

  onActivate = ($event) => {
    // console.log("activate", $event);
    this.photoPath = 'file:///' + $event.node.data.filePath;
    // exiftool
    //   .read('/Users/mskalski/Downloads/fotki/09_15_27.jpg')
    //   .then((tags /*: Tags */) =>
    //     console.log(tags, tags)
        // console.log(
        //   `Make: ${tags.Make}, Model: ${tags.Model}, Errors: ${tags.errors}`
        // )
      // )
      // .catch(err => console.error("Something terrible happened: ", err));
    const isWin = process.platform === 'win32';
    if (isWin) {
      console.log('I am windows');
      winattr.get(this.photoPath, function(err, attrs) {
        if (err == null) {
          console.log('Photo attributes', attrs);
        } else {
          console.log('Unable to load photo attributes', err);
        }
      });
    }
  }

  onDeactivate = $event => {
    // console.log("deactivate", $event);
    this.photoPath = 'file:///' + $event.node.data.filePath;
  }

  onFocus = ($event) => {
    // console.log('on focus event', $event);
    if (!this.lastFocusEvent || (this.lastFocusEvent.node.data.filePath !== $event.node.data.filePath)) {
      this.lastFocusEvent = $event;

      // console.log('aaa', this.shiftDown);

      this.shiftDown
        ? TREE_ACTIONS.TOGGLE_ACTIVE_MULTI($event.treeModel, $event.node, $event)
        : TREE_ACTIONS.TOGGLE_ACTIVE($event.treeModel, $event.node, $event);

      $event.node.scrollIntoView();
    }
  }

  update() {
    const treeModel: TreeModel = this.treeComponent.treeModel;

    console.log('model in update', treeModel);

    const root = treeModel.getFirstRoot();

    root.focus(true);
    root.expandAll();
  }

  constructor(private modalService: NgbModal) {
  }

  ngOnInit() {
    // exiftool
    //   .version()
    //   .then(version => console.log(`We're running ExifTool v${version}`));

    const currentWindow = remote.getCurrentWindow();

    window.addEventListener('keyup', (e) => {
      if (e.code === 'ShiftLeft') {
        this.shiftDown = false;
      }
    }, true);
    window.addEventListener('keydown', (e) => {
      if (e.code === 'ShiftLeft') {
        this.shiftDown = true;
      }
    }, true);

    keyShortcuts.register(currentWindow, 'Esc', () => {
      this.exitFullScreen();
    });
    keyShortcuts.register(currentWindow, 'Enter', () => {
      this.enterFullScreen();
    });
    keyShortcuts.register(currentWindow, 'Up', () => this.up());
    keyShortcuts.register(currentWindow, 'Down', () => this.down());
    keyShortcuts.register(currentWindow, 'Shift+Up', () => this.up());
    keyShortcuts.register(currentWindow, 'Shift+Down', () => this.down());
    keyShortcuts.register(currentWindow, 'Left', () => {
      if (!this.activeBucket) {
        this.activeBucket = this.buckets[this.buckets.length - 1];
        return;
      }

      if (this.activeBucket !== this.buckets[0]) {
        const activeBucketIndex = this.buckets.indexOf(this.activeBucket);
        if (activeBucketIndex > 0) {
          this.activeBucket = this.buckets[activeBucketIndex - 1];
        }
      }
    });
    keyShortcuts.register(currentWindow, 'Right', () => {
      if (!this.activeBucket) {
        this.activeBucket = this.buckets[0];
        return;
      }

      if (this.activeBucket !== this.buckets[this.buckets.length - 1]) {
        const activeBucketIndex = this.buckets.indexOf(this.activeBucket);
        if (activeBucketIndex < this.buckets.length - 1) {
          this.activeBucket = this.buckets[activeBucketIndex + 1];
        }
      }
    });

    keyShortcuts.register(currentWindow, '1', () => this.moveToBucket(0));
    keyShortcuts.register(currentWindow, '2', () => this.moveToBucket(1));
    keyShortcuts.register(currentWindow, '3', () => this.moveToBucket(2));

    this.buckets = [
      new Bucket(0, 'Dobre', 'success'),
      new Bucket(1, 'Srednie', 'warning'),
      new Bucket(2, 'Zle', 'danger')
    ];

    storage.has('settings', (error, hasKey) => {
      if (error) {
        throw error;
      }

      if (hasKey) {
        storage.get('settings', (e, settings) => {

          if (e) {
            throw e;
          }

          this.sourcePath = settings.sourcePath;
          this.destinationPath = settings.destinationPath;

          this.reload();
        });
      } else {
        this.reload();
      }
    });
  }

  saveSettings() {
    storage.set('settings', {sourcePath: this.sourcePath, destinationPath: this.destinationPath}, (error) => {
      if (error) {
        throw error;
      }

      this.alert = {type: 'info', message: 'Settings has been saved successfully'};
    });
  }

  private exitFullScreen() {
    const currentWindow = remote.getCurrentWindow();
    this.fullScreenMode = false;
    this.showBucketMode = false;
    currentWindow.setFullScreen(false);
  }

  private enterFullScreen() {
    const currentWindow = remote.getCurrentWindow();
    currentWindow.setFullScreen(true);
    this.fullScreenMode = true;
  }

  getBucketClass(bucket: Bucket) {
    if (this.activeBucket === bucket) {
      return 'bucket-active ' + 'alert-' + bucket.className;
    } else {
      return 'alert-' + bucket.className;
    }
  }

  up() {
    const treeModel: TreeModel = this.treeComponent.treeModel;
    const focusedNode = treeModel.getFocusedNode();

    if (focusedNode) {
      focusedNode.expandAll();
      const previousNode = focusedNode.findPreviousNode();

      treeModel.focusPreviousNode();
      if (previousNode && (
        (!this.showBucketMode && !previousNode.data.isFile || !previousNode.data.name.endsWith('.jpg')) ||
        (this.showBucketMode && previousNode.data.bucket !== this.activeBucket)
      )) {
        this.up();
      }
    } else {
      treeModel.focusPreviousNode();
    }

  }

  down() {
    const treeModel: TreeModel = this.treeComponent.treeModel;
    const focusedNode = treeModel.getFocusedNode();

    if (focusedNode) {
      focusedNode.expandAll();
      const nextNode = focusedNode.findNextNode();
      treeModel.focusNextNode();

      if (nextNode && (
        (!this.showBucketMode && !nextNode.data.isFile) ||
        (this.showBucketMode && nextNode.data.bucket !== this.activeBucket)
      )) {
        this.down();
      }
    } else {
      treeModel.focusNextNode();
    }

  }

  ngAfterInit() {
  }

  private reloadPhotos() {
    const files = this.loadFileTree(this.sourcePath);

    console.log('loaded files:', files);

    this.nodes = files;
  }

  private reload() {
    this.reloadPhotos();

    // const traverse = node =>
    //   (node.children.length ? [] :[[node.item]]).concat(...node.children.map(child =>
    //     traverse(child).map(arr =>
    //       [node.item].concat(arr)
    //     )
    //   ));


    const flattenNodes: Array<File> = [];
    this.flatten(this.nodes, flattenNodes);

    console.log('flatten photos', flattenNodes);

    this.buckets.forEach(b => {
      const photos = b.clear();
      console.log('photos from clear method', photos);
      photos.forEach(p => {

        const file = flattenNodes.find(n => p.filePath === n.filePath);
        console.log('found file from flatten nodes', file);
        if (file) {
          console.log('adding file', file);
          file.bucket = b;
          b.add(file);
        }
      });
    });
  }

  private flatten(photos, ret) {
    return photos.reduce((r, entry) => {
      ret.push(entry);
      if (entry.children.length > 0) {
        this.flatten(entry.children, ret);
      }
      return ret;
    }, ret || []);
  }

  @HostListener('window:resize', ['$event'])
  onResize() {
    this.screenHeight = window.innerHeight - 75;
    console.log('wysokosc:', this.screenHeight);
  }

  onSourcePathChanged(event) {
    this.sourcePath = event.target.files[0].path;

    console.log('changed source directory:', this.sourcePath);

    this.reload();
  }

  onDestinationPathChanged(event) {
    this.destinationPath = event.target.files[0].path;

    console.log('changed destination directory:', this.destinationPath);
  }

  private loadFileTree(directoryPath: string): Array<File> {
    const fileNames = fs.readdirSync(directoryPath);
    let files = fileNames.map(fileName => {
      const fullPath = `${directoryPath}/${fileName}`;
      const fileData = fs.statSync(fullPath);
      const file = new File();
      file.name = fileName;
      file.filePath = fullPath;
      file.isFile = fileData.isFile();
      if (!file.isFile) {
        file.children = this.loadFileTree(file.filePath);
      }

      return file;
    });

    files = files.filter(f => (!f.isFile && f.children.length > 0) || f.name.endsWith('.jpg'));

    return files;
  }

  private moveToBucket(bucketIndex: number) {
    const treeModel: TreeModel = this.treeComponent.treeModel;
    const activeNodes = treeModel.activeNodes;
    console.log('activeNodes', activeNodes);
    // const focusedNode = treeModel.getFocusedNode();
    // const currentPhoto = focusedNode.data;

    if (activeNodes && activeNodes.length > 0) {
      activeNodes.forEach(a => {
        const photo = a.data;
        for (const bucket of this.buckets) {
          bucket.remove(photo);
        }

        if (photo.bucket === this.buckets[bucketIndex]) {
          photo.bucket = null;
        } else {
          this.buckets[bucketIndex].add(photo);
        }
      });
    }
  }

  private removeFromBucket(bucketIndex: number, file: File) {
    file.bucket = null;
    this.buckets[bucketIndex].remove(file);
  }

  showBucket() {
    this.showBucketMode = true;

    const treeModel: TreeModel = this.treeComponent.treeModel;
    const root = treeModel.getFirstRoot();
    root.focus(true);

    if (root.data.bucket !== this.activeBucket) {
      this.down();
    }

    this.enterFullScreen();
  }

  emptyBucket() {
    this.activeBucket.clear();
  }

  copy() {
    const warnings = this.checkBeforeAction();
    if (warnings.length > 0) {
      const modalRef = this.modalService.open(PreActionWarningModalContent, { centered: true });
      modalRef.componentInstance.name = 'Copy';
      modalRef.componentInstance.sourceDir = this.sourcePath;
      modalRef.componentInstance.photos = warnings[0].files;
      modalRef.result.then((result) => {
        console.log(`Closed with: ${result}`);

        if (result === 'continue') {
          this.performCopy();
        }

        if (result === 'clean_buckets') {
          for (const photo of warnings[0].files) {
            photo.bucket.remove(photo);
          }
        }
      }, (reason) => {
        console.log(`Dismissed ${reason}`);
      });
    } else {
      this.performCopy();
    }
  }

  performCopy() {
    this.actionInProgress = new Action('Copying in progress', 0);

    const copyLoop = (action, bucket, index) => {
      if (index >= bucket.count()) {
        this.alert = {type: 'info', message: 'Copy operation has completed successfully'};
        this.actionInProgress = null;
        return;
      }
      fse.copy(bucket.photos[index].filePath, this.destinationPath + '/' + bucket.photos[index].name);
      action.progress = ((index + 1) / (bucket.count())) * 100;

      if (index % 10 === 0) {
        setTimeout(copyLoop, 500, action, bucket, index + 1);
      } else {
        setTimeout(copyLoop, 0, action, bucket, index + 1);
      }

    };

    setTimeout(copyLoop, 100, this.actionInProgress, this.activeBucket, 0);
  }

  private checkBeforeAction() {
    const warnings: Array<PreActionWarning> = [];

    if (this.activeBucket.countDirs() > 0) {
      const overlapPhotos: Array<File> = [];
      const dirs = this.activeBucket.dirs();
      for (const dir of dirs) {
        const flatten: Array<File> = [];
        this.flatten(dir.children, flatten);

        const argArray = flatten.filter(f => f.bucket != null && f.bucket !== this.activeBucket);

        overlapPhotos.push.apply(overlapPhotos, argArray);
      }

      if (overlapPhotos.length > 0) {
        warnings.push(new PreActionWarning(overlapPhotos));
      }
    }

    return warnings;
  }

  move() {
    const warnings = this.checkBeforeAction();
    if (warnings.length > 0) {
      const modalRef = this.modalService.open(PreActionWarningModalContent, { centered: true });
      modalRef.componentInstance.name = 'Move';
      modalRef.componentInstance.sourceDir = this.sourcePath;
      modalRef.componentInstance.photos = warnings[0].files;
      modalRef.result.then((result) => {
        console.log(`Closed with: ${result}`);

        if (result === 'continue') {
          this.performMove();
        }

        if (result === 'clean_buckets') {
          for (const photo of warnings[0].files) {
            photo.bucket.remove(photo);
          }
        }
      }, (reason) => {
        console.log(`Dismissed ${reason}`);
      });
    } else {
      this.performMove();
    }
  }

  performMove() {
    this.actionInProgress = new Action('Moving in progress', 0);

    const moveLoop = (action, bucket, index) => {
      if (index >= bucket.count()) {
        bucket.clear();
        this.reload();
        this.actionInProgress = null;
        this.alert = {type: 'info', message: 'Moving operation has completed successfully'};
        return;
      }
      try {
        const destinationPhotoPath = this.destinationPath + '/' + bucket.photos[index].name;
        console.log('moving', bucket.photos[index].filePath);
        fse.moveSync(bucket.photos[index].filePath, destinationPhotoPath, { overwrite: true });
        action.progress = ((index + 1) / (bucket.count())) * 100;
        if (index % 10 === 0) {
          setTimeout(moveLoop, 500, action, bucket, index + 1);
        } else {
          setTimeout(moveLoop, 0, action, bucket, index + 1);
        }
      } catch (e) {
        this.actionInProgress = null;
        this.alert = {type: 'danger', message: e.message};
      }

    };

    setTimeout(moveLoop, 100, this.actionInProgress, this.activeBucket, 0);
  }

  allSelected() {
    const flatten = [];
    this.flatten(this.nodes, flatten);

    // console.log('flatten', flatten);

    return flatten.filter(p => p.isFile).some(p => p.bucket === null || p.bucket === undefined);
  }

  addUnselected() {
    const treeModel: TreeModel = this.treeComponent.treeModel;

    console.log('model:', treeModel);

    const add = (file: File) => {
      if (file.isFile && !file.bucket) {
        this.activeBucket.add(file);
        return;
      }

      if (!file.isFile) {
        file.children.forEach(f => add(f));
      }
    };

    if (treeModel.nodes) {
      treeModel.nodes.forEach(f => add(f));
    }
  }

  closeAlert() {
    this.alert = HomeComponent.EMPTY_ALERT;
  }
}

export interface IAlert {
  type: string;
  message: string;
}

class File {
  filePath: string;
  name: string;
  isFile: boolean;
  bucket: Bucket;
  children: Array<File> = [];
}

class Bucket {
  index: number;
  name: string;
  className: string;
  photos: Array<File> = [];

  constructor(index: number, name: string, className: string) {
    this.index = index;
    this.name = name;
    this.className = className;
  }

  add(photo: File) {
    photo.bucket = this;
    this.photos.push(photo);
  }

  remove(photo: File) {
    const index = this.photos.indexOf(photo, 0);
    if (index > -1) {
      this.photos[index].bucket = null;
      this.photos.splice(index, 1);
    }
  }

  clear() {
    console.log('photos before clear', this.photos);

    const copy = this.photos.map(x => Object.assign({}, x));

    console.log('after copy', copy);

    this.photos.forEach(p => p.bucket = null);
    this.photos = [];

    console.log('after clear', copy);

    return copy;
  }

  countFiles() {
    return this.photos.filter(p => p.isFile).length;
  }

  countDirs() {
    return this.photos.filter(p => !p.isFile).length;
  }

  dirs() {
    return this.photos.filter(p => !p.isFile);
  }

  count() {
    return this.countDirs() + this.countFiles();
  }

  isEmpty() {
    return this.countFiles() === 0 && this.countDirs() === 0;
  }
}

class Action {
  name: string;
  progress: number;

  constructor(name: string, progress: number) {
    this.name = name;
    this.progress = progress;
  }
}

class Settings {
  sourcePath: string;
  destinationPath: string;

  constructor(sourcePath: string, destinationPath: string) {
    this.sourcePath = sourcePath;
    this.destinationPath = destinationPath;
  }
}

class PreActionWarning {
  constructor(public files: Array<File>) {

  }
}
