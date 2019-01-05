import {ApplicationRef, Component, HostListener, OnInit, ViewChild} from '@angular/core';
import {COMMA, ENTER} from '@angular/cdk/keycodes';
import * as fs from 'fs';
import * as fse from 'fs-extra';
import {IActionMapping, ITreeOptions, KEYS, TREE_ACTIONS, TreeComponent, TreeModel} from 'angular-tree-component';
import * as keyShortcuts from 'electron-localshortcut';
import {remote} from 'electron';
import * as storage from 'electron-json-storage/lib/storage';
import {NgbModal} from '@ng-bootstrap/ng-bootstrap';
import {PreActionWarningModalContent} from '../modals/pre-action-warning';
import {TagsModalContent} from '../modals/tags';
import * as path from 'path';

import {AppConfig} from '../../../environments/environment';
import {MatChipInputEvent} from '@angular/material';

const app = remote.app;
const child = require('child_process').execFile;

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {

  public static EMPTY_ALERT: IAlert = {type: '', message: ''};
  // public static get EMPTY_ALERT() {
  //   return HomeComponent.EMPTY_ALERT;
  // }

  @ViewChild('photoTree') treeComponent: TreeComponent;

  buckets: Array<Bucket>;
  activeBucket: Bucket;
  actionInProgress: Action;
  alert: IAlert = HomeComponent.EMPTY_ALERT;
  editableTags = ['Keywords'];
  readonly separatorKeysCodes: number[] = [ENTER, COMMA];

  sourcePath = '';
  destinationPath = '';
  nodes: Array<File> = [];
  photoPath = '';
  photo: File;
  attributes: Array<FileAttribute> = [];
  screenHeight;

  shiftDown = false;
  showBucketMode = false;
  fullScreenMode = false;
  reachedEnd = false;
  canGo = true;
  useDestination = 'no';

  actionMapping: IActionMapping = {
    mouse: {
      contextMenu: (tree, node, $event) => {
        $event.preventDefault();
        alert(`context menu for ${node.data.name}`);
      },
      dblClick: (tree, node, $event) => {
      },
      click: (tree, node, $event) => {
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
    actionMapping: this.actionMapping,
    useVirtualScroll: true,
    nodeHeight: 22
  };

  lastFocusEvent: any;

  currentPhoto: File;

  onActivate = ($event) => {
    this.currentPhoto = $event.node.data;

    setTimeout(() => {
      if (this.currentPhoto.filePath === $event.node.data.filePath) {
        this.photo = this.currentPhoto;
        this.photoPath = 'file:///' + $event.node.data.filePath;

        if (this.photo.isFile) {
          this.readTags($event.node.data.filePath);
        }
      }
    }, 150);
  }

  readTags(photoPath) {
    let options = [];
    let executablePath: String;

    if (process.platform === 'win32') {
      options = ['-Keywords', '-ImageSize', '-CreateDate', '-FileSize', photoPath.replace(/file:\/\/\//g, '').replace(/\//g, '\\')];
      if (AppConfig.production) {
        executablePath = path.join(app.getAppPath(), '..', 'extras/exiftool.exe');
      } else {
        executablePath = path.join(app.getAppPath(), 'extras/exiftool.exe');
      }
    } else {
      options = ['-Keywords', '-ImageSize', '-CreateDate', '-FileSize', '-MDItemUserTags', photoPath.replace(/file:\/\/\//g, '')];
      executablePath = 'exiftool';
    }

    child(executablePath, options, (err, data) => {
      if (err) {
        console.error(err);
        return;
      }

      const lines = data.toString().match(/[^\r\n]+/g);
      console.log('tags', lines);
      this.attributes = lines.filter(l => l.startsWith('Keywords') || l.startsWith('MD Item User Tags')
        || l.startsWith('Image Size') || l.startsWith('Create Date') || l.startsWith('File Size')).map(l => {

        const name = l.substr(0, l.indexOf(':'));

        let value = l.substr(l.indexOf(':') + 1, l.length);
        const isEditable = this.editableTags.some(a => name.startsWith(a));
        const isMultiValue = isEditable;

        if (isMultiValue) {
          value = value.split(',');
        }

        return new FileAttribute(name, value, isEditable, isEditable);
      });

      if (this.attributes.findIndex(a => a.name.startsWith('Keywords')) < 0) {
        this.attributes.push(new FileAttribute('Keywords', [], true, true));
      }

      this.appRef.tick();
    });
  }

  updateAttribute(attribute, photoPaths, mode = '=') {
    let executablePath: String;

    if (process.platform === 'win32') {
      if (AppConfig.production) {
        executablePath = path.join(app.getAppPath(), '..', 'extras/exiftool.exe');
      } else {
        executablePath = path.join(app.getAppPath(), 'extras/exiftool.exe');
      }
    } else {
      executablePath = 'exiftool';
    }

    let opt = ['-overwrite_original'];

    opt = this.addAttribute(attribute, opt, mode);

    opt = opt.concat(['-m', '-r']);

    photoPaths.map(p => p.replace(/file:\/\/\//g, '')).forEach(p => opt = opt.concat(p));

    console.log('options', opt);

    return new Promise((resolve, reject) => {

      child(executablePath, opt, (err, data) => {
        if (err) {
          console.error(err);
          reject(err);
          return;
        }

        console.log(data.toString());

        if (attribute.name.trim() === 'Keywords') {
          const copy = {...attribute};
          copy.name = 'MDItemUserTags';
          this.updateAttribute(copy, photoPaths, mode)
            .then(() => {
              resolve();
            }).catch((error) => {
            reject(error);
          });
        } else {
          resolve();
        }
      });
    });
  }

  private addAttribute(attribute, opt, mode) {
    if (attribute.value.length === 0) {
      opt = opt.concat('-' + attribute.name + '=');
    } else {
      opt = opt.concat(attribute.value.map(v => '-' + attribute.name + mode + v.trim()));
    }
    return opt;
  }

  addAttributeValue(attribute: FileAttribute, event: MatChipInputEvent): void {
    const input = event.input;
    const value = event.value;

    // Add our fruit
    if ((value || '').trim()) {
      attribute.value.push(value.trim());
    }

    // Reset the input value
    if (input) {
      input.value = '';
    }
  }

  removeAttributeValue(attribute: FileAttribute, value: string) {
    console.log('usuwam wartosc', attribute, value);
    const index = attribute.value.indexOf(value);

    if (index >= 0) {
      attribute.value.splice(index, 1);
    }
    this.appRef.tick();
  }

  onDeactivate = $event => {
    this.currentPhoto = $event.node.data;

    setTimeout(() => {
      if (this.currentPhoto.filePath === $event.node.data.filePath) {

        this.photoPath = 'file:///' + $event.node.data.filePath;
        this.appRef.tick();
      }
    }, 350);
  }

  onFocus = ($event) => {
    if (!this.lastFocusEvent || (this.lastFocusEvent.node.data.filePath !== $event.node.data.filePath)) {
      this.lastFocusEvent = $event;

      this.shiftDown
        ? TREE_ACTIONS.TOGGLE_ACTIVE_MULTI($event.treeModel, $event.node, $event)
        : TREE_ACTIONS.TOGGLE_ACTIVE($event.treeModel, $event.node, $event);

      $event.node.scrollIntoView();
    }
  }

  update() {
    const treeModel: TreeModel = this.treeComponent.treeModel;
    const root = treeModel.getFirstRoot();

    root.focus(true);
    root.expandAll();
  }

  constructor(private modalService: NgbModal, private appRef: ApplicationRef) {
  }

  ngOnInit() {
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
    keyShortcuts.register(currentWindow, 'Shift+' +
      'Enter', () => {
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

    keyShortcuts.register(currentWindow, 'F1', () => {
      this.activeBucket = this.buckets[0];
      this.moveToBucket(0);
    });
    keyShortcuts.register(currentWindow, 'F2', () => {
      this.activeBucket = this.buckets[1];
      this.moveToBucket(1);
    });
    keyShortcuts.register(currentWindow, 'F3', () => {
      this.activeBucket = this.buckets[2];
      this.moveToBucket(2);
    });

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

  up(autoScroll = false) {
    if (!this.canGo && !autoScroll) {
      return;
    }
    this.canGo = false;

    setTimeout(() => {this.canGo = true; }, 75);

    const treeModel: TreeModel = this.treeComponent.treeModel;
    const focusedNode = treeModel.getFocusedNode();

    if (!this.reachedEnd || this.shouldGoToNextNode(focusedNode)) {
      this.reachedEnd = false;

      if (focusedNode) {
        focusedNode.expandAll();
        const previousNode = focusedNode.findPreviousNode();

        treeModel.focusPreviousNode();

        this.reachedEnd = !previousNode;

        if (this.shouldGoToNextNode(previousNode)) {
          this.up(true);
        }
      } else {
        treeModel.focusPreviousNode();
      }

    } else {
      this.reachedEnd = false;
    }

  }

  private shouldGoToNextNode(node) {
    return node && (
      (!this.showBucketMode && !node.data.isFile || !this.isImage(node.data)) ||
      (this.showBucketMode && node.data.bucket !== this.activeBucket)
    );
  }

  isImage(file: File) {
    return file.name.endsWith('.jpg') || file.name.endsWith('.JPG');
  }

  down(autoScroll = false) {
    if (!this.canGo && !autoScroll) {
      return;
    }
    this.canGo = false;

    setTimeout(() => {this.canGo = true; }, 75);

    const treeModel: TreeModel = this.treeComponent.treeModel;
    const focusedNode = treeModel.getFocusedNode();

    if (!this.reachedEnd || this.shouldGoToNextNode(focusedNode)) {
      this.reachedEnd = false;
      if (focusedNode) {
        focusedNode.expandAll();
        const nextNode = focusedNode.findNextNode();
        treeModel.focusNextNode();

        this.reachedEnd = !nextNode;

        if (this.shouldGoToNextNode(nextNode)) {
          this.down(true);
        }
      } else {
        treeModel.focusNextNode();
      }

    } else {
      this.reachedEnd = false;
    }

  }

  ngAfterInit() {
  }

  private reloadPhotos() {
    this.nodes = [];

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

    // console.log('flatten photos', flattenNodes);

    this.buckets.forEach(b => {
      const photos = b.clear();
      // console.log('photos from clear method', photos);
      photos.forEach(p => {

        const file = flattenNodes.find(n => p.filePath === n.filePath);
        // console.log('found file from flatten nodes', file);
        if (file) {
          // console.log('adding file', file);
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
    this.screenHeight = window.innerHeight - 150;
    console.log('wysokosc:', this.screenHeight);
  }

  onSourcePathChanged(event) {
    this.sourcePath = event.target.files[0].path;
    this.reload();
  }

  onDestinationPathChanged(event) {
    this.destinationPath = event.target.files[0].path;
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

    files = files.filter(f => (!f.isFile && f.children.length > 0) || this.isImage(f));

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

        if (photo.bucket === this.buckets[bucketIndex]) {
          this.buckets[bucketIndex].remove(photo);
        } else {
          for (const bucket of this.buckets) {
            bucket.remove(photo);
          }
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
      fse.copySync(bucket.photos[index].filePath, this.destinationPath + '/' + bucket.photos[index].name);
      action.progress = (((index + 1) / (bucket.count())) * 100).toFixed(2);

      if (index % 10 === 0) {
        setTimeout(copyLoop, 250, action, bucket, index + 1);
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
        action.progress = (((index + 1) / (bucket.count())) * 100).toFixed(2);
        if (index % 10 === 0) {
          setTimeout(moveLoop, 200, action, bucket, index + 1);
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

  setTags() {
    // const warnings = this.checkBeforeAction();
    // if (warnings.length > 0) {
      const modalRef = this.modalService.open(TagsModalContent, { centered: true });
      modalRef.result.then((result) => {
        console.log(`Closed with: ${result}`);

        if (result.mode === 'add_tags') {
          this.performSetTags('+=', result.tags);
        }

        if (result.mode === 'set_tags') {
          this.performSetTags('=', result.tags);
        }

        if (result.mode === 'remove_tags') {
          this.performSetTags('-=', result.tags);
        }
      }, (reason) => {
        console.log(`Dismissed ${reason}`);
      });
  }

  performSetTags(mode: string, tags: Array<String>) {
    this.actionInProgress = new Action('Updating tags in progress', 0);

    const setTagsLoop = (action, bucket, index) => {
      if (index >= bucket.count()) {
        this.actionInProgress = null;
        this.alert = {type: 'info', message: 'Updating tags operation has completed successfully'};
        this.readTags(this.photoPath);
        return;
      }
      try {
        const filesToUpdate = [];

        for (let i = 0; i < 10 && index < bucket.count(); i++) {
          if (this.useDestination === 'no') {
            filesToUpdate.push(this.fix(bucket.photos[index].filePath));
          } else {
            filesToUpdate.push(this.fix(`${this.destinationPath}\\${bucket.photos[index].name}`));
          }
          index = index + 1;
        }

        // console.log('updating tags', filesToUpdate);
        this.updateAttribute(new FileAttribute('Keywords', tags, true, true), filesToUpdate, mode)
          .then(() => {
            action.progress = (((index) / (bucket.count())) * 100).toFixed(2);
            setTimeout(setTagsLoop, 250, action, bucket, index);
          })
          .catch(e => {
            this.actionInProgress = null;
            this.alert = {type: 'danger', message: e.message};
          });
      } catch (e) {
        this.actionInProgress = null;
        this.alert = {type: 'danger', message: e.message};
      }
    };

    setTimeout(setTagsLoop, 100, this.actionInProgress, this.activeBucket, 0);
  }

  private fix(pathToFix) {
    if (process.platform === 'win32') {
      return pathToFix.replace(/\//g, '\\');
    } else {
      return pathToFix.replace(/\\/g, '\/');
    }
  }

  allSelected() {
    const flatten = [];
    this.flatten(this.nodes, flatten);

    return flatten.filter(p => p.isFile).some(p => p.bucket === null || p.bucket === undefined);
  }

  addUnselected() {
    const treeModel: TreeModel = this.treeComponent.treeModel;

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
    const copy = this.photos.map(x => Object.assign({}, x));

    this.photos.forEach(p => p.bucket = null);
    this.photos = [];

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

class FileAttribute {
  constructor(public name: string, public value, public multivalue: boolean, public editable: boolean) {}
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
