'use strict';
(() => {
    const browser = globalThis.RoboBatonNeoBrowser;
    const listeners = new Set();
    const query = new URLSearchParams(location.search);
    const calibration = {
        connected: true, state: 'IDLE', recording: false, endpoint: '本机演示 · 未连接设备',
        record_duration_s: 0, record_images: 0, record_imu: 0, imu_rate_hz: 200,
        preview: {connected: true, frame_count: 100, last_frame_time: Date.now() / 1000, rate_hz: 15},
        workflow: {runtime: {state: 'STARTED'}, jobs: {}, node_solver_ready: true},
        quality: {}, resolution: [544, 640], file_exports: {},
    };
    const parameters = {camera_model: 'ds', distortion_model: 'none', intrinsics: [0.4, 0.6, 270, 270, 272, 320], distortion_coeffs: [], resolution: [544, 640], T_cam_imu: [[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]], timeshift_cam_imu: 0};
    let session = 'tutorial-demo';
    function completed() {
        calibration.state = 'COMPLETE'; calibration.recording = false;
        calibration.workflow.jobs[session] = {session, state: 'COMPLETE', parameters, publication_allowed: true, results: ['camchain-imucam.yaml']};
    }
    const originalRequest = browser.request;
    browser.status = () => calibration;
    browser.subscribe = callback => { listeners.add(callback); return () => listeners.delete(callback); };
    browser.acceptPublicOdometry = value => { for (const callback of listeners) callback({data: JSON.stringify(value)}); };
    browser.calibrationParameters = async () => ({source: 'saved', ...parameters});
    browser.calibrationSaved = () => false;
    browser.startCalibration = async () => calibration;
    browser.stopCalibration = async () => calibration;
    let previewEnabled = false;
    function drawPreview(canvas, orient = true) {
        canvas.width = 544; canvas.height = 640;
        const context = canvas.getContext('2d');
        context.fillStyle = '#e7ece9'; context.fillRect(0, 0, 544, 640);
        for (let row = 0; row < 7; row++) for (let column = 0; column < 6; column++) {
            context.fillStyle = (row + column) % 2 ? '#466356' : '#f9faf9';
            context.fillRect(62 + column * 70, 65 + row * 70, 70, 70);
        }
        context.fillStyle = '#244d40'; context.font = '24px sans-serif';
        context.fillText('↑ UP · 演示图像', 125, 610);
        if (orient && canvas.parentElement) globalThis.RoboBatonNeoPreviewOrientation?.apply(canvas.parentElement, 544, 640);
    }
    browser.setPreview = value => { previewEnabled = value; };
    browser.previewStatus = () => ({connected: true, width: 544, height: 640, rate_hz: 15});
    browser.httpStream = channels => {
        let closed = false;
        const stream = {config: {codec: 'mjpeg', width: 1080, height: 1280, fps: 5, quality: 80}, close() {closed = true; clearInterval(timer);}};
        const canvas = document.createElement('canvas'); drawPreview(canvas);
        const image = Uint8Array.from(atob(canvas.toDataURL('image/jpeg').split(',')[1]), char => char.charCodeAt(0));
        setTimeout(() => {if (!closed) stream.onopen?.();}, 80);
        const timer = setInterval(() => {
            if (closed) return;
            if (channels[0] === 'color') stream.onmessage?.({frame: {data: image, config: stream.config}});
            if (channels[0] === 'depth') {
                const depth = new Float32Array(384 * 384);
                for (let index = 0; index < depth.length; index++) depth[index] = Math.sin(index % 384 / 100) + Math.floor(index / 384) / 384;
                stream.onmessage?.({frame: {binary: new Uint8Array(depth.buffer)}});
            }
        }, 200);
        return stream;
    };
    browser.subscribeImu = callback => {
        let sample = 0;
        const timer = setInterval(() => {
            const samples = Array.from({length: 10}, () => {
                const time = ++sample / 200;
                return [String(sample * 5000000), Math.sin(time * 3) * 2, Math.cos(time * 2) * 1.5,
                    9.81 + Math.sin(time * 4) * 0.8, Math.sin(time * 2) * 0.3,
                    Math.cos(time * 3) * 0.2, Math.sin(time) * 0.4];
            });
            callback({type: 'imu', frame_id: sample, samples});
        }, 50);
        return () => clearInterval(timer);
    };
    let usbResult = null;
    browser.startSelectedRecording = async channels => {
        calibration.usb_recording = true; calibration.record_state = 'recording';
        calibration.recording_channels = channels;
    };
    browser.stopUsbRecording = async () => {
        calibration.usb_recording = false; calibration.record_state = 'completed';
        usbResult = {id: 'browser-tutorial-demo', channels: calibration.recording_channels,
            result: {state: 'completed', complete: true, end_reason: 'user_stop', duration_s: 4, bytes_written: '140000', counts: {gray: '20', imu: '800'}}};
    };
    browser.recordingDatasets = () => usbResult ? [usbResult] : [];
    browser.request = async (url, options = {}) => {
        if (!url.startsWith('/api/calibration/')) return originalRequest(url, options);
        const body = JSON.parse(options.body || '{}');
        let result = calibration;
        if (url.endsWith('/arm')) {
            session = body.session || body.output?.split('/').pop() || document.getElementById('sessionName').value;
            calibration.output = '/sessions/' + session;
            calibration.state = 'CAPTURING'; calibration.recording = true;
            calibration.record_images = 120; calibration.record_imu = 4800; calibration.record_duration_s = 24;
            calibration.diagnostics = {image_live: true};
            calibration.action_coverage = {minimum_ready: true, count: 8, total: 8, completed: Object.fromEntries(['framing', 'roll', 'pitch', 'yaw', 'translation_horizontal', 'translation_vertical', 'translation_depth', 'combined'].map(name => [name, true])), framing_regions: Array(9).fill(true), visual: {valid: true}};
        }
        if (url.endsWith('/guide/next') && body.finish) {
            completed(); calibration.workflow.jobs[session].state = 'EUROC_READY';
        }
        if (url.endsWith('/solve') || url.endsWith('/solve-filtered')) {
            calibration.workflow.jobs[session].state = 'CALIBRATING';
            calibration.workflow.active_job = session;
            setTimeout(() => { completed(); calibration.workflow.active_job = null; }, 800);
            if (url.endsWith('/solve-filtered')) result = {session};
        }
        if (url.endsWith('/cancel')) { calibration.state = 'IDLE'; calibration.recording = false; }
        if (url.endsWith('/parameters/save')) calibration.workflow.jobs[session].parameter_deployment = {state: 'SAVED', path: '/home/VIO/parameters/'};
        if (url.includes('frame-review')) result = {session, source_run: 'demo', input_sha256: '0'.repeat(64), frames: Array.from({length: 60}, (_, index) => ({timestamp: String(index + 1), filename: String(index + 1) + '.png', rms_px: index < 3 ? 1.5 : 0.2, max_px: index < 3 ? 2.1 : 0.4, corners: 60}))};
        return new Response(JSON.stringify(result), {headers: {'Content-Type': 'application/json'}});
    };
    browser.downloadCalibration = () => {
        calibration.file_exports[session] = 'requested';
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob(['Tutorial demonstration only. Not device data.']));
        link.download = 'tutorial-demo.txt'; link.click(); URL.revokeObjectURL(link.href);
    };
    globalThis.TutorialFixture = {
        calibration,
        complete: completed,
        emit(value) { for (const callback of listeners) callback({data: JSON.stringify(value)}); },
    };
    addEventListener('DOMContentLoaded', () => {
        const modes = globalThis.RoboBatonNeoDeviceModes;
        if (modes) {
            modes.startCalibration = async () => true;
            modes.endCalibration = async () => true;
        }
        const disclosure = document.createElement('div');
        disclosure.textContent = '操作演示 · 模拟数据 · 不连接设备'; disclosure.id = 'tutorial-disclosure';
        const caption = document.createElement('div'); caption.id = 'tutorial-caption';
        const pointer = document.createElement('div'); pointer.id = 'tutorial-pointer';
        const style = document.createElement('style');
        style.textContent = '#tutorial-disclosure{position:fixed;top:4px;left:50%;transform:translateX(-50%);z-index:2147483647;padding:4px 12px;border-radius:5px;background:#244d40;color:white;font:12px sans-serif;pointer-events:none}#tutorial-caption{position:fixed;bottom:12px;left:50%;transform:translateX(-50%);z-index:2147483647;padding:10px 18px;max-width:90%;border-radius:7px;background:#244d40;color:white;font:16px sans-serif;text-align:center;pointer-events:none}#tutorial-pointer{position:fixed;left:-50px;top:-50px;z-index:2147483647;width:22px;height:22px;border:3px solid #397d63;border-radius:50%;box-shadow:0 0 0 6px #397d6333;pointer-events:none;transition:left .35s,top .35s}';
        document.head.append(style); document.body.append(disclosure, caption, pointer);
        function placeOverlays() {
            const target = [...document.querySelectorAll('dialog[open]')].at(-1) || document.fullscreenElement || document.body;
            for (const element of [disclosure, caption, pointer]) if (element.parentElement !== target) target.append(element);
        }
        new MutationObserver(placeOverlays).observe(document.body, {subtree: true, attributes: true, attributeFilter: ['open']});
        document.addEventListener('fullscreenchange', placeOverlays);
        let sequence = 0;
        setInterval(() => {
            const time = ++sequence / 20;
            calibration.preview.last_frame_time = Date.now() / 1000;
            calibration.preview.frame_count = sequence;
            const calibrationImage = document.getElementById('calibrationImage');
            if (calibrationImage && !document.getElementById('calibrationPage').hidden) drawPreview(calibrationImage, false);
            browser.acceptPublicOdometry({type: 'connection', connected: true});
            browser.acceptPublicOdometry({type: 'state', frame_id: String(sequence), timestamp_ns: String(sequence * 50000000), valid: true, position: [Math.sin(time) * 3, Math.cos(time) * 3, Math.sin(time / 2) * 0.4], quaternion_wxyz: [Math.cos(time / 8),0,0,Math.sin(time / 8)], velocity: [Math.cos(time) * 3,-Math.sin(time) * 3,Math.cos(time / 2) * 0.2], angular_velocity: [0,0,0.25], confidence: 0.95, trip_distance_m: time * 3});
            if (previewEnabled) {
                drawPreview(document.getElementById('imageCanvas'));
                document.getElementById('cameraPlaceholder').hidden = true;
            }
        }, 50);
        if (query.get('calibration') === 'complete') completed();
    });
})();
