'use strict';
const click = selector => [selector, 'click'];
const focus = selector => [selector, 'focus'];
const fill = (selector, value) => [selector, 'fill', value];
const select = (selector, value) => [selector, 'select', value];
const check = selector => [selector, 'check'];
const step = (...actions) => actions;
const lesson = (tab, steps, pre = []) => ({tab, steps, pre});
const summary = text => 'summary:text-is("' + text + '")';
const fgStep = number => '#fgSteps [data-step="' + number + '"]';
const record = [click('#railRecordTab')];
const buttons = [click('#settingsButtonsTab')];
const media = [click('#mediaSettingsOpen')];
const mount = 'mountTab', live = 'vioTab', cal = 'calibrationTab', flight = 'flightTab', update = 'updateTab';
module.exports = {
    'open-device': lesson(live, [step(focus('.brand-text')), step(focus('#globalStatus')), step(focus('.view-tabs'))]),
    'page-navigation': lesson(live, [step(click('#vioTab')), step(click('#mountTab')), step(click('#vioTab'))]),
    'language-theme': lesson(live, [step(click('#langToggle')), step(focus('#languageMenu')), step(click('#langToggle'), click('#themeToggle'))]),
    'first-check': lesson(live, [step(focus('#globalStatus')), step(click('#videoToggle')), step(click('#calibrationTab'), click('.cs-board-parameters summary'))]),
    'first-start': lesson(live, [step(click('#algoToggle')), step(focus('#algorithmStatus')), step(focus('#algorithmStatus'))]),
    'first-stop': lesson(live, [step(focus('#algorithmStatus')), step(click('#algoToggle')), step(focus('#algorithmStatus'))], [click('#algoToggle'), ['wait', 'wait', 1300]]),
    'vio-control': lesson(live, [step(click('#algoToggle')), step(focus('#algorithmStatus')), step(click('#algoToggle'))]),
    'vio-status': lesson(live, [step(focus('#algorithmStatus')), step(click('#algoToggle')), step(focus('#algorithmStatus'))]),
    'trajectory-views': lesson(live, [step(click('[data-scene-view="follow"]')), step(click('[data-scene-view="top"]')), step(click('[data-scene-view="iso"]'))], [click('#algoToggle'), ['wait', 'wait', 1400]]),
    'trajectory-tools': lesson(live, [step(click('#sceneGridToggle')), step(focus('#trailClearTop')), step(click('#trailClearTop'))]),
    'pose-readout': lesson(live, [step(focus('#posePosition')), step(check('[name="pose-format"][value="quaternion"]')), step(check('[name="pose-format"][value="euler"]'), check('[name="pose-unit"][value="rad"]'))]),
    'monitor-panel': lesson(live, [step(click('#railMonitorTab')), step(focus('#imuAccelChart')), step(focus('#imuGyroChart'))]),
    'preview-toggle': lesson(live, [step(focus('#videoToggle')), step(click('#videoToggle')), step(click('#videoToggle'))]),
    'preview-window': lesson(live, [step(click('#cameraExpand')), step(['#previewViewer .preview-viewer-header', 'drag']), step(click('#previewFitBtn'), click('#previewCloseBtn'))], [click('#videoToggle')]),
    'preview-rotate': lesson(live, [step(focus('#previewRotate')), step(click('#previewRotate')), step(click('#previewRotate'))], [click('#videoToggle')]),
    'color-settings': lesson(live, [step(focus('#mediaCodec')), step(select('#mediaCodec', 'h264'), fill('#mediaFps', '5')), step(click('#mediaApply'))], media),
    'color-stream': lesson(live, [step(click(summary('查看彩色画面'))), step(click('#colorToggle')), step(click('#colorToggle'), click(summary('接口说明')), focus('#mediaHttpAddress'))], media),
    'depth-control': lesson(live, [step(focus('#depthRunToggle')), step(click('#depthRunToggle')), step(click('#depthRunToggle'))]),
    'mount-platform': lesson(mount, [step(focus('#mountRobot')), step(select('#mountRobot', 'drone')), step(select('#mountRobot', 'car'), fill('#mountBodyLength', '300'))]),
    'mount-coordinates': lesson(mount, [step(focus('#mountConvention')), step(select('#mountConvention', 'FRD')), step(select('#mountConvention', 'FLU'))]),
    'mount-position': lesson(mount, [step(focus('#mountNumber3')), step(fill('#mountNumber3', '0.12')), step(fill('#mountNumber5', '0.05'))]),
    'mount-orientation': lesson(mount, [step(click('[data-mount-preset="inverted"]')), step(click('#mountReset')), step(fill('#mountNumber2', '15'))]),
    'mount-simulation': lesson(mount, [step(click('#mountOffsetDemo')), step(select('#mountMotion', 'tilt')), step(click('#mountPlay'))]),
    'mount-matrix': lesson(mount, [step(click('#mountMatrixShow')), step(focus('#mountMatrixRows')), step(click('#mountMatrixDialog [data-mount-close]'), click('#mountExport'))]),
    'mount-save': lesson(mount, [step(fill('#mountNumber3', '0.12')), step(click('#mountSave')), step(click('#mountRead'))]),
    'flight-scan': lesson(flight, [step(focus('#fgSteps')), step(click(summary('连接详情'))), step(click('#fgAutoScan'))]),
    'flight-manual': lesson(flight, [step(focus('#fgManualPanel')), step(click('[data-action="choose-ardupilot"]')), step(fill('#fgTryRate', '921600'), focus('#fgManualConnect'))], 'flight-manual'),
    'flight-parameters': lesson(flight, [step(click(fgStep(1))), step(click('#fgRead')), step(click('[data-action="recommend"]'))]),
    'flight-apply': lesson(flight, [step(focus('.fg-source-tabs')), step(click('#fgReferenceConfirm')), step(click('#fgReviewOpen'))], [click(fgStep(1)), click('#fgRead'), ['wait', 'wait', 400], click('[data-action="recommend"]')]),
    'flight-verify': lesson(flight, [step(click(fgStep(2))), step(click('#fgStatusDetails summary')), step(focus('#fgVerification'))]),
    'record-destination': lesson(live, [step(focus('#recordDestination')), step(select('#recordDestination', 'tf')), step(select('#recordDestination', 'usb'))], record),
    'record-channels': lesson(live, [step(focus('#recordChannels')), step(check('#recordGray'), check('#recordImu')), step(focus('#recordChannels'))], record),
    'record-preflight': lesson(live, [step(click('#railMonitorTab'), focus('#tfStorageDetails')), step(click('#railRecordTab'), focus('#recordCheckStart')), step(click('#recordCheckStart'))], [...record, select('#recordDestination', 'tf')]),
    'record-tf': lesson(live, [step(click('#recordStartBtn')), step(focus('#captureRecordState')), step(click('#recordStopBtn'))], [...record, select('#recordDestination', 'tf')]),
    'record-browser': lesson(live, [step(select('#recordDestination', 'usb')), step(click('#recordStartBtn')), step(click('#recordStopBtn'), click('#recordTab'), focus('#recordSessions'))], record),
    'record-catalog': lesson('recordTab', [step(focus('#recordSessions')), step(select('#recordSourceFilter', 'tf')), step(click('#recordRefreshBtn'), click('[data-action="detail"]'))]),
    'record-download-delete': lesson('recordTab', [step(click('[data-action="detail"]')), step(click('.record-detail-dialog button'), focus('[data-action="download"]')), step(focus('[data-action="delete"]'))]),
    'calibration-read': lesson(cal, [step(focus('.cs-heading')), step(click('.cs-board-parameters summary')), step(click('.cs-board-parameters button'))]),
    'calibration-board': lesson(cal, [step(focus('#boardCanvas')), step(click('#downloadBoardBtn')), step(click('#enterScreenBtn'))]),
    'calibration-measure-board': lesson(cal, [step(click('input[name="measureMode"][value="board"]')), step(fill('#boardMeasuredWidth', '24.3')), step(check('#measureConfirm'))], [click('#enterScreenBtn')]),
    'calibration-measure-screen': lesson(cal, [step(click('input[name="measureMode"][value="screen"]')), step(fill('#screenPhysicalWidth', '48')), step(fill('#screenPhysicalHeight', '27'))], [click('#enterScreenBtn')]),
    'calibration-measure-tag': lesson(cal, [step(click('input[name="measureMode"][value="tag"]')), step(fill('#tagMeasuredSize', '3')), step(check('#measureConfirm'), click('#confirmScreenBtn'))], [click('#enterScreenBtn')]),
    'calibration-settings': lesson(cal, [step(click('#openSettingsBtn')), step(focus('#tagRows'), focus('#tagCols')), step(focus('#spacingRatio'))]),
    'calibration-motion': lesson(cal, [step(focus('#captureTutorialDialog')), step(focus('#captureTutorialDialog')), step(click('#skipCaptureTutorialBtn'), focus('#startRecordBtn'))], 'calibration-ready'),
    'calibration-finish': lesson(cal, [step(focus('#actionCoverageGrid')), step(focus('#guideFinishEarly')), step(click('#guideFinishEarly'), focus('#jobState'))], 'calibration-capturing'),
    'calibration-solve': lesson(cal, [step(focus('#jobState')), step(click('#solveBtn')), step(focus('#viewResultBtn'))], 'calibration-finished'),
    'calibration-results': lesson(cal, [step(click('#viewResultBtn')), step(focus('#intrinsicsList')), step(focus('#resultFiles'))], 'calibration-solved'),
    'calibration-filter': lesson(cal, [step(focus('#frameFilterPanel summary')), step(fill('#frameFilterThreshold', '1'), click('#frameFilterApply')), step(click('#frameFilterSolve'))], 'calibration-results'),
    'calibration-save': lesson(cal, [step(click('#downloadSessionZip')), step(click('#saveBoardParametersBtn')), step(focus('#savedResultPath'))], 'calibration-solved'),
    'network-read': lesson('buttonTab', [step(focus('#settingsNetworkTab')), step(focus('#networkCurrentIP')), step(click('#networkRead'))]),
    'network-change': lesson('buttonTab', [step(fill('#networkIP', '12')), step(click('#networkApply')), step(click('#networkCancel'))]),
    'button-actions': lesson('buttonTab', [step(focus('#buttonSettingsFields')), step(select('#buttonShortAction', 'vio_toggle')), step(select('#buttonLongAction', 'record_toggle'), select('#buttonLongMs', '3000'))], buttons),
    'button-channels': lesson('buttonTab', [step(focus('.button-recording-options')), step(check('#buttonRecord_color')), step(click('#buttonSave'))], buttons),
    'button-reset': lesson('buttonTab', [step(click('#buttonDefaults')), step(focus('#buttonSettingsState')), step(click('#buttonRead'))], buttons),
    'boot-start': lesson(live, [step(click('#bootSettings summary')), step(check('#bootAutostart')), step(click('#bootSave'), click('#bootRefresh'))]),
    'update-version': lesson(update, [step(focus('#updateRunning')), step(click('#updateRefresh')), step(click('#updateDetailsLabel'))]),
    'update-upload': lesson(update, [step(focus('#updateHelp')), step(['#updateFile', 'file']), step(click('#updateUpload'))]),
    'update-install': lesson(update, [step(focus('#updateCandidate')), step(click('#updateInstall')), step(click('#updateConfirmCancel'))], 'update-package'),
    'update-reboot': lesson(update, [step(focus('#updateState')), step(click('#updateReboot')), step(click('#updateConfirmCancel'), click('#updateRefresh'))], 'update-reboot'),
    'examples-entry': lesson(live, [step(focus('#examplesLink')), step(click('#examplesLink')), step(focus('main'))]),
};
