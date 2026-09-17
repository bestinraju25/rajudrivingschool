var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var _this_1 = this;
(function () {
    'use strict';
    var _a;
    if (!document.getElementById('hptHiddenFix')) {
        var s = document.createElement('style');
        s.id = 'hptHiddenFix';
        s.textContent = '[hidden]{display:none!important}';
        document.head.appendChild(s);
    }
    var $ = function (id) { return document.getElementById(id); };
    var C = window.RAJU_HPT_CONFIG;
    var UA = (navigator.userAgent || '').toLowerCase();
    var IS_TV = /smarttv|smart-tv|hbbtv|tizen|webos|web0s|netcast|googletv|google tv|android tv|bravia|vidaa|viera|aquos|roku/i.test(UA);
    if (IS_TV)
        document.documentElement.classList.add('tv-safe');
    var clips = [], order = [], pos = 0, responses = [], scores = [], running = false, finishing = false, timer = null, responseLocked = false;
    var candidate = { name: '', phone: '' }, sound = true, accessCode = '1234';
    var video = $('video');
    var audioCtx = null;
    function setupHomeMedia() {
        var _this_1 = this;
        var full = $('homeFullBtn');
        if (full)
            full.onclick = function () { return __awaiter(_this_1, void 0, void 0, function () { var _a; var _b, _c, _d; return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        _e.trys.push([0, 5, , 6]);
                        if (!!document.fullscreenElement) return [3 /*break*/, 2];
                        return [4 /*yield*/, ((_c = (_b = document.documentElement).requestFullscreen) === null || _c === void 0 ? void 0 : _c.call(_b))];
                    case 1:
                        _e.sent();
                        return [3 /*break*/, 4];
                    case 2: return [4 /*yield*/, ((_d = document.exitFullscreen) === null || _d === void 0 ? void 0 : _d.call(document))];
                    case 3:
                        _e.sent();
                        _e.label = 4;
                    case 4: return [3 /*break*/, 6];
                    case 5:
                        _a = _e.sent();
                        toast('Fullscreen is not available in this browser.', true);
                        return [3 /*break*/, 6];
                    case 6: return [2 /*return*/];
                }
            }); }); };
        var att = $('homeAttemptsBtn');
        if (att)
            att.onclick = openAttempts;
    }
    function startLoadingScreen() {
        var screen = $('loadingScreen'), fill = $('loaderFill'), percent = $('loaderPercent'), status = $('loaderStatusText'), scene = $('loaderScene');
        if (!screen)
            return;
        if (IS_TV) {
            screen.style.display = 'none';
            return;
        }
        var started = performance.now(), duration = 5600;
        var tick = function (now) {
            var t = Math.min(1, (now - started) / duration);
            // The loading percentage follows the traffic-signal story: approach → yellow/slow → stop → red → ready.
            var value;
            if (t < .45)
                value = Math.round((t / .45) * 42);
            else if (t < .68)
                value = 42 + Math.round(((t - .45) / .23) * 28);
            else if (t < .82)
                value = 70 + Math.round(((t - .68) / .14) * 30);
            else
                value = 100;
            if (fill)
                fill.style.width = value + '%';
            if (scene)
                scene.style.setProperty('--drive-progress', Math.min(1, t / 0.67).toFixed(4));
            if (percent)
                percent.textContent = value + '%';
            if (status) {
                if (t < .42)
                    status.textContent = 'GREEN SIGNAL • DRIVE';
                else if (t < .66)
                    status.textContent = 'YELLOW SIGNAL • SLOW DOWN';
                else if (t < .75)
                    status.textContent = 'BRAKING • STOPPING';
                else if (t < .84)
                    status.textContent = 'RED SIGNAL • STOPPED';
                else
                    status.textContent = 'READY TO DRIVE';
            }
            if (t < 1)
                requestAnimationFrame(tick);
            else
                setTimeout(function () { screen.classList.add('loaded'); setTimeout(function () { return screen.remove(); }, 520); }, 300);
        };
        requestAnimationFrame(tick);
    }
    var fmt = function (s) { s = Math.max(0, Math.ceil(Number(s) || 0)); return "00:".concat(String(s).padStart(2, '0')); };
    var shuffle = function (a) {
        var _a;
        a = __spreadArray([], a, true);
        for (var i = a.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            _a = [a[j], a[i]], a[i] = _a[0], a[j] = _a[1];
        }
        return a;
    };
    var show = function (id, on) { var e = $(id); if (!e)
        return; e.hidden = !on; if (id === 'examScreen')
        document.body.classList.toggle('exam-active', on); if (id === 'startScreen')
        document.body.classList.toggle('home-active', on); if (id === 'resultScreen')
        document.body.classList.toggle('result-active', on); };
    var toast = function (t, bad) {
        if (bad === void 0) { bad = false; }
        var e = $('toast');
        e.textContent = t;
        e.className = 'toast show' + (bad ? ' bad' : '');
        clearTimeout(e._t);
        e._t = setTimeout(function () { return e.className = 'toast'; }, 1100);
    };
    function responseLimitWarning() { var m = $('responseLimitModal'); if (!m)
        return; show('responseLimitModal', true); clearTimeout(m._t); m._t = setTimeout(function () { return show('responseLimitModal', false); }, 2200); }
    function update() { var d = Math.min(C.clipLimitSeconds, video.duration || C.clipLimitSeconds); var shown = Math.min(pos + 1, order.length); $('clipNo').textContent = "".concat(shown, " / ").concat(order.length); $('clipNo2').textContent = "".concat(shown, " / ").concat(order.length); $('timer').textContent = fmt(Math.max(0, C.clipLimitSeconds - video.currentTime)); $('elapsed').textContent = fmt(video.currentTime); $('duration').textContent = fmt(d); $('respCount').textContent = "".concat(responses.length, " / ").concat(C.maxResponsesPerClip); var pct = d ? Math.min(100, Math.max(0, (video.currentTime / d) * 100)) : 0; var fill = $('progressFill'); var head = $('playHead'); if (fill)
        fill.style.width = pct + '%'; if (head)
        head.style.left = pct + '%'; }
    function timeline() { var t = $('track'); if (!t)
        return; var d = Math.max(1, Math.min(C.clipLimitSeconds, video.duration || C.clipLimitSeconds)); t.querySelectorAll('.mark').forEach(function (e) { return e.remove(); }); responses.forEach(function (r, i) { var m = document.createElement('div'); m.className = 'mark'; m.style.left = Math.min(100, Math.max(0, (Number(r.t) || 0) / d * 100)) + '%'; m.title = "Response ".concat(i + 1); m.setAttribute('aria-label', "Response ".concat(i + 1)); m.innerHTML = '<span></span>'; t.appendChild(m); }); }
    function resetClip() { responses = []; responseLocked = false; finishing = false; timeline(); update(); }
    function staticHazards(code) { var _a; return (((_a = C.staticHazards) === null || _a === void 0 ? void 0 : _a[String(code).padStart(2, '0')]) || []).map(function (h, i) { return (__assign(__assign({}, h), { hazard_no: i + 1 })); }); }
    function xhrJSON(url, method, body) {
        return new Promise(function (resolve) {
            var x = new XMLHttpRequest();
            x.open(method, url, true);
            x.setRequestHeader('apikey', C.supabaseAnonKey);
            x.setRequestHeader('Authorization', 'Bearer ' + C.supabaseAnonKey);
            x.setRequestHeader('Content-Type', 'application/json');
            x.onreadystatechange = function () {
                if (x.readyState !== 4)
                    return;
                var ok = x.status >= 200 && x.status < 300, data = null, error = null;
                try {
                    data = x.responseText ? JSON.parse(x.responseText) : null;
                }
                catch (e) {
                    error = { message: 'Invalid server response' };
                }
                if (!ok)
                    error = error || { message: 'Request failed (' + x.status + ')' };
                resolve({ data: data, error: error });
            };
            x.onerror = function () { resolve({ data: null, error: { message: 'Network request failed' } }); };
            try {
                x.send(body ? JSON.stringify(body) : null);
            }
            catch (e) {
                resolve({ data: null, error: { message: e.message || 'Network request failed' } });
            }
        });
    }
    function legacyRestClient() {
        var base = String(C.supabaseUrl || '').replace(/\/$/, '');
        return {
            rpc: function (name, body) { return xhrJSON(base + '/rest/v1/rpc/' + name, 'POST', body); },
            from: function (table) {
                return {
                    select: function (cols) {
                        return {
                            eq: function (field, value) {
                                var url = base + '/rest/v1/' + table + '?select=' + encodeURIComponent(cols || '*') + '&' + encodeURIComponent(field) + '=eq.' + encodeURIComponent(String(value));
                                return xhrJSON(url, 'GET');
                            }
                        };
                    }
                };
            }
        };
    }
    function supabase() {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (window._sb)
                    return [2 /*return*/, window._sb];
                try {
                    if (window.supabase && window.supabase.createClient) {
                        window._sb = window.supabase.createClient(C.supabaseUrl, C.supabaseAnonKey);
                        return [2 /*return*/, window._sb];
                    }
                }
                catch (e) { }
                window._sb = legacyRestClient();
                return [2 /*return*/, window._sb];
            });
        });
    }
    function loadClips() {
        return __awaiter(this, void 0, void 0, function () {
            var sb, vs, hs, by_1, remote, merged_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        clips = C.staticClips.map(function (x) { return (__assign(__assign({}, x), { hazards: staticHazards(x.clip_code) })); });
                        return [4 /*yield*/, supabase()];
                    case 1:
                        sb = _a.sent();
                        if (!sb) return [3 /*break*/, 4];
                        return [4 /*yield*/, sb.from('hpt_videos').select('id,clip_code,title,video_path,duration_seconds,active').eq('active', true)];
                    case 2:
                        vs = (_a.sent()).data;
                        if (!(vs === null || vs === void 0 ? void 0 : vs.length)) return [3 /*break*/, 4];
                        return [4 /*yield*/, sb.from('hpt_hazards').select('video_id,hazard_no,timestamp_seconds,label')];
                    case 3:
                        hs = (_a.sent()).data;
                        by_1 = {};
                        (hs || []).forEach(function (h) { var _a; var _b; return ((_a = by_1[_b = h.video_id]) !== null && _a !== void 0 ? _a : (by_1[_b] = [])).push({ t: Number(h.timestamp_seconds), label: h.label || "Hazard ".concat(h.hazard_no), hazard_no: h.hazard_no }); });
                        remote = vs.map(function (v) { return (__assign(__assign({}, v), { file: v.video_path.startsWith('http') ? v.video_path : (v.video_path.startsWith('./') ? v.video_path : C.videoBase + v.video_path.replace(/^videos\//, '')), hazards: (by_1[v.id] || []) })); }).filter(function (v) { return v.hazards.length >= 2; });
                        merged_1 = __spreadArray([], clips, true);
                        remote.forEach(function (v) { var i = merged_1.findIndex(function (x) { return String(x.clip_code).padStart(2, '0') === String(v.clip_code).padStart(2, '0'); }); if (i >= 0)
                            merged_1[i] = v;
                        else
                            merged_1.push(v); });
                        clips = merged_1;
                        _a.label = 4;
                    case 4: return [2 /*return*/, clips.filter(function (c) { var _a; return c.active && c.video_path && ((_a = c.hazards) === null || _a === void 0 ? void 0 : _a.length) >= 2; })];
                }
            });
        });
    }
    function saveAttempt() {
        return __awaiter(this, void 0, void 0, function () {
            var sb, total, payload, attempt, _a, data, error;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, supabase()];
                    case 1:
                        sb = _b.sent();
                        if (!sb)
                            return [2 /*return*/, { ok: false, error: 'Supabase is not available.' }];
                        total = scores.reduce(function (a, b) { return a + b; }, 0);
                        payload = { candidate_name: candidate.name, phone: candidate.phone, started_at: new Date(Date.now() - C.examClipCount * C.clipLimitSeconds * 1000).toISOString(), completed_at: new Date().toISOString(), total_score: total, passed: total >= C.passMark, clip_order: order.map(function (c) { return c.clip_code; }), responses: scores.flatMap(function (_, i) { return (order[i]._responses || []).map(function (r) { return ({ video_id: order[i].id || null, response_no: r.response_no, click_time_seconds: r.t, hazard_no: r.hazard_no || null, awarded_marks: r.points }); }); }) };
                        attempt = 1;
                        _b.label = 2;
                    case 2:
                        if (!(attempt <= 2)) return [3 /*break*/, 6];
                        return [4 /*yield*/, sb.rpc('hpt_record_attempt', payload)];
                    case 3:
                        _a = _b.sent(), data = _a.data, error = _a.error;
                        if (!error && data)
                            return [2 /*return*/, { ok: true, id: data }];
                        if (attempt === 2)
                            return [2 /*return*/, { ok: false, error: (error === null || error === void 0 ? void 0 : error.message) || 'Could not save the examination result.' }];
                        return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 600); })];
                    case 4:
                        _b.sent();
                        _b.label = 5;
                    case 5:
                        attempt++;
                        return [3 /*break*/, 2];
                    case 6: return [2 /*return*/, { ok: false, error: 'Could not save the examination result.' }];
                }
            });
        });
    }
    function localTvSource(clip) { if (/^https?:\/\//i.test(String(clip.file || ''))) return null; var code = String(clip.clip_code || '').replace(/^0+/, ''); if (code && /^[0-9]+$/.test(code) && Number(code) >= 1 && Number(code) <= 10)
        return './videos-tv2/' + code + '.mp4'; return null; }
    function alternateVideoSource(clip) { var tv = localTvSource(clip); if (tv && video.src.indexOf('/videos-tv2/') < 0)
        return tv; var f = String(clip.file || ''); if (/\.webm(?:$|\?)/i.test(f))
        return f.replace(/videos\//, 'videos-tv2/').replace(/\.webm(?:$|\?)/i, '.mp4'); if (/\.mp4(?:$|\?)/i.test(f))
        return f.replace(/videos-tv2\//, 'videos/').replace(/\.mp4(?:$|\?)/i, '.webm'); return null; }
    function loadClip() { resetClip(); running = false; clearTimeout(timer); video.pause(); video.removeAttribute('src'); video.controls = false; video.setAttribute('playsinline', ''); video.setAttribute('disablepictureinpicture', ''); video.setAttribute('disableremoteplayback', ''); var clip = order[pos]; var primary = (IS_TV && localTvSource(clip)) || clip.file; video._hptFallbackTried = false; video.src = primary; video.muted = IS_TV ? !0 : !sound; video.load(); $('playOverlay').hidden = true; video.onloadedmetadata = function () { video.currentTime = 0; update(); timeline(); var p = video.play(); if (p && p.catch)
        p.catch(function () { $('playOverlay').hidden = IS_TV ? true : false; }); running = true; clearTimeout(timer); timer = setTimeout(finishClip, C.clipLimitSeconds * 1000); preloadNextClip(); }; video.onerror = function () { var alt = alternateVideoSource(clip); if (alt && !video._hptFallbackTried) {
        video._hptFallbackTried = true;
        video.src = alt;
        video.load();
        return;
    } running = false; $('playOverlay').hidden = false; $('playNow').textContent = 'PLAY CLIP'; toast('Video could not be loaded', true); }; }
    function preloadNextClip() { try {
        if (!IS_TV || pos + 1 >= order.length)
            return;
        var n = order[pos + 1], src = localTvSource(n) || n.file;
        if (!src)
            return;
        var p = document.createElement('video');
        p.preload = 'auto';
        p.muted = true;
        p.src = src;
        p.load();
        video._nextPreload = p;
    }
    catch (e) { } }
    function finishClip() {
        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (finishing)
                        return [2 /*return*/];
                    finishing = true;
                    running = false;
                    clearTimeout(timer);
                    video.pause();
                    scores.push(Math.max(0, Math.min(10, scoreThis())));
                    pos++;
                    if (!(pos >= order.length)) return [3 /*break*/, 2];
                    return [4 /*yield*/, finishExam()];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
                case 2:
                    setTimeout(function () { finishing = false; loadClip(); }, 220);
                    return [2 /*return*/];
            }
        }); });
    }
    function scoreThis() { return responses.reduce(function (a, r) { return a + r.points; }, 0); }
    function finishExam() {
        return __awaiter(this, void 0, void 0, function () { var total, saved, rows; return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    total = scores.reduce(function (a, b) { return a + b; }, 0);
                    return [4 /*yield*/, saveAttempt()];
                case 1:
                    saved = _a.sent();
                    show('examScreen', false);
                    show('resultScreen', true);
                    $('candidateResult').textContent = "".concat(candidate.name, " \u2022 ").concat(candidate.phone);
                    $('finalScore').textContent = "".concat(total, " / 100");
                    $('passText').textContent = total >= C.passMark ? 'PASS — EXAMINATION STANDARD MET' : 'NOT PASSED — BELOW PASS MARK';
                    $('passText').className = 'status ' + (total >= C.passMark ? 'pass' : 'fail');
                    $('resultSaveStatus').textContent = saved.ok ? 'Result recorded successfully.' : 'Result could not be recorded automatically. Please inform the school admin.';
                    $('resultSaveStatus').className = 'save-status ' + (saved.ok ? 'ok' : 'error');
                    $('printCertBtn').hidden = total < C.passMark;
                    rows = scores.map(function (s, i) { return "<div class=\"scoreRow\"><span>Clip ".concat(String(i + 1).padStart(2, '0'), "</span><b>").concat(s, " / 10</b></div>"); }).join('');
                    $('resultDetails').innerHTML = "<div class=\"scoreGrid\">".concat(rows, "</div><div class=\"resultSummary\"><div><span>PASS MARK</span><b>").concat(C.passMark, "</b></div><div><span>YOUR SCORE</span><b>").concat(total, "</b></div><div><span>STATUS</span><b>").concat(total >= C.passMark ? 'PASS' : 'NOT PASSED', "</b></div></div>");
                    window._lastExam = { total: total, saved: saved };
                    if (total >= C.passMark)
                        setupCandidateCertificate();
                    return [2 /*return*/];
            }
        }); });
    }
    function begin() {
        return __awaiter(this, void 0, void 0, function () { var n, p, code, msg, sb, verified, _a, data, error, e_1; return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    n = $('name').value.trim(), p = $('phone').value.trim(), code = $('accessCode').value.trim(), msg = $('accessCodeMsg');
                    if (msg) {
                        msg.hidden = true;
                        msg.textContent = '';
                    }
                    if (!n || !p || !code) {
                        toast('Enter candidate name, phone number and access code', true);
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, supabase()];
                case 1:
                    sb = _b.sent();
                    if (!sb) {
                        toast('Access code verification is unavailable. Please try again.', true);
                        return [2 /*return*/];
                    }
                    verified = false;
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, sb.rpc('verify_hpt_access_code', { p_code: code })];
                case 3:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw error;
                    verified = data === true;
                    return [3 /*break*/, 5];
                case 4:
                    e_1 = _b.sent();
                    console.error('HPT access-code verification failed', e_1);
                    if (msg) {
                        msg.textContent = 'ACCESS CODE VERIFICATION UNAVAILABLE';
                        msg.hidden = false;
                    }
                    toast('Access code verification is unavailable.', true);
                    return [2 /*return*/];
                case 5:
                    if (!verified) {
                        if (msg) {
                            msg.textContent = 'ACCESS CODE DENIED';
                            msg.hidden = false;
                        }
                        toast('ACCESS CODE DENIED', true);
                        $('accessCode').focus();
                        return [2 /*return*/];
                    }
                    accessCode = code;
                    return [4 /*yield*/, loadClips()];
                case 6:
                    clips = _b.sent();
                    if (clips.length < C.examClipCount) {
                        toast("Need ".concat(C.examClipCount, " active clips with 2 hazards each"), true);
                        return [2 /*return*/];
                    }
                    candidate = { name: n, phone: p };
                    $('candName').textContent = n;
                    $('candPhone').textContent = p;
                    order = shuffle(clips).slice(0, C.examClipCount);
                    pos = 0;
                    scores = [];
                    show('startScreen', false);
                    show('resultScreen', false);
                    show('examScreen', true);
                    loadClip();
                    return [2 /*return*/];
            }
        }); });
    }
    function loadJsPdf() { return new Promise(function (resolve, reject) { if (window.jspdf && window.jspdf.jsPDF)
        return resolve(window.jspdf); var sc = document.createElement('script'); sc.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js'; sc.onload = function () { if (window.jspdf && window.jspdf.jsPDF)
        resolve(window.jspdf);
    else
        reject(new Error('PDF library unavailable')); }; sc.onerror = function () { reject(new Error('PDF library unavailable')); }; document.head.appendChild(sc); }); }
    function printCertificate() {
        return __awaiter(this, arguments, void 0, function (examOverride, candidateOverride) {
            var exam, person, e_2, jsPDF, doc, W, H, logo, _a, lw, lh, d, certNo;
            if (examOverride === void 0) { examOverride = null; }
            if (candidateOverride === void 0) { candidateOverride = null; }
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        exam = examOverride || window._lastExam;
                        person = candidateOverride || candidate;
                        if (!exam || Number(exam.total) < C.passMark)
                            return [2 /*return*/];
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 4, , 5]);
                        if (!(!window.jspdf || !window.jspdf.jsPDF)) return [3 /*break*/, 3];
                        return [4 /*yield*/, loadJsPdf()];
                    case 2:
                        _b.sent();
                        _b.label = 3;
                    case 3: return [3 /*break*/, 5];
                    case 4:
                        e_2 = _b.sent();
                        toast('Certificate generator is unavailable in this browser.', true);
                        return [2 /*return*/];
                    case 5:
                        jsPDF = window.jspdf.jsPDF;
                        doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
                        W = 297, H = 210;
                        doc.setFillColor(250, 251, 253);
                        doc.rect(0, 0, W, H, 'F');
                        doc.setDrawColor(212, 162, 32);
                        doc.setLineWidth(1.1);
                        doc.rect(8, 8, W - 16, H - 16, 'S');
                        doc.setDrawColor(33, 53, 72);
                        doc.setLineWidth(.35);
                        doc.rect(13, 13, W - 26, H - 26, 'S');
                        logo = null;
                        _b.label = 6;
                    case 6:
                        _b.trys.push([6, 8, , 9]);
                        return [4 /*yield*/, imageData('raju-logo.png')];
                    case 7:
                        logo = _b.sent();
                        return [3 /*break*/, 9];
                    case 8:
                        _a = _b.sent();
                        return [3 /*break*/, 9];
                    case 9:
                        if (logo) {
                            lw = 43, lh = 33.2;
                            doc.addImage(logo, 'PNG', (W - lw) / 2, 17, lw, lh);
                        }
                        doc.setTextColor(33, 53, 72);
                        doc.setFont('helvetica', 'bold');
                        doc.setFontSize(10);
                        doc.text('RAJU MOTOR DRIVING SCHOOL • CHALAKUDY', W / 2, 57, { align: 'center' });
                        doc.setTextColor(184, 132, 12);
                        doc.setFontSize(25);
                        doc.text('CERTIFICATE OF HAZARD PERCEPTION', W / 2, 73, { align: 'center' });
                        doc.setDrawColor(212, 162, 32);
                        doc.setLineWidth(.7);
                        doc.line(82, 79, 215, 79);
                        doc.setTextColor(92, 105, 116);
                        doc.setFont('helvetica', 'normal');
                        doc.setFontSize(13);
                        doc.text('This certificate is awarded to', W / 2, 94, { align: 'center' });
                        doc.setTextColor(25, 38, 51);
                        doc.setFont('helvetica', 'bold');
                        doc.setFontSize(27);
                        doc.text(String((person === null || person === void 0 ? void 0 : person.name) || exam.candidate_name || 'Candidate'), W / 2, 112, { align: 'center' });
                        doc.setDrawColor(180, 188, 195);
                        doc.setLineWidth(.35);
                        doc.line(70, 118, 227, 118);
                        doc.setTextColor(92, 105, 116);
                        doc.setFont('helvetica', 'normal');
                        doc.setFontSize(12);
                        doc.text('for successfully completing the Raju Motor Driving School Hazard Perception Test', W / 2, 131, { align: 'center' });
                        doc.setTextColor(33, 53, 72);
                        doc.setFont('helvetica', 'bold');
                        doc.setFontSize(19);
                        doc.text("SCORE: ".concat(Number(exam.total || exam.total_score || 0), " / 100"), W / 2, 149, { align: 'center' });
                        doc.setTextColor(35, 126, 78);
                        doc.setFontSize(16);
                        doc.text('PASS', W / 2, 160, { align: 'center' });
                        d = new Date(exam.completed_at || Date.now());
                        doc.setTextColor(92, 105, 116);
                        doc.setFont('helvetica', 'normal');
                        doc.setFontSize(9.5);
                        doc.text("Date: ".concat(d.toLocaleDateString('en-IN')), 45, 181);
                        certNo = exam.id ? "HPT-".concat(d.getFullYear()).concat(String(d.getMonth() + 1).padStart(2, '0')).concat(String(d.getDate()).padStart(2, '0'), "-").concat(String(exam.id).slice(0, 8).toUpperCase()) : "HPT-".concat(d.getFullYear()).concat(String(d.getMonth() + 1).padStart(2, '0')).concat(String(d.getDate()).padStart(2, '0'), "-").concat(Math.random().toString(36).slice(2, 8).toUpperCase());
                        doc.text("Certificate No: ".concat(certNo), W - 45, 181, { align: 'right' });
                        doc.setTextColor(33, 53, 72);
                        doc.setFont('helvetica', 'bold');
                        doc.setFontSize(9.5);
                        doc.text('RAJU MOTOR DRIVING SCHOOL • CHALAKUDY • SINCE 1969', W / 2, 191, { align: 'center' });
                        doc.save("Raju-HPT-Certificate-".concat(String((person === null || person === void 0 ? void 0 : person.name) || exam.candidate_name || 'Candidate').replace(/[^a-z0-9]+/gi, '-'), ".pdf"));
                        return [2 /*return*/];
                }
            });
        });
    }
    function imageData(url) {
        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, new Promise(function (resolve, reject) { var img = new Image(); img.onload = function () { var c = document.createElement('canvas'); c.width = img.naturalWidth || img.width; c.height = img.naturalHeight || img.height; var x = c.getContext('2d'); x.drawImage(img, 0, 0); resolve(c.toDataURL('image/png')); }; img.onerror = reject; img.src = url + '?v=' + Date.now(); })];
                case 1: return [2 /*return*/, _a.sent()];
            }
        }); });
    }
    function lookupAttempts() {
        return __awaiter(this, void 0, void 0, function () {
            var phoneInput, msg, list, phone, sb, _a, data, error, rows_1, e_3;
            var _this_1 = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        phoneInput = $('attemptPhone');
                        msg = $('attemptMsg');
                        list = $('attemptList');
                        phone = ((phoneInput === null || phoneInput === void 0 ? void 0 : phoneInput.value) || '').trim();
                        if (!phone) {
                            if (msg) {
                                msg.textContent = 'Enter your mobile number.';
                                msg.className = 'attemptMsg bad';
                            }
                            return [2 /*return*/];
                        }
                        if (msg) {
                            msg.textContent = 'Searching…';
                            msg.className = 'attemptMsg';
                        }
                        list.innerHTML = '<div class="attemptLoading">Loading your examination attempts…</div>';
                        return [4 /*yield*/, supabase()];
                    case 1:
                        sb = _b.sent();
                        if (!sb) {
                            list.innerHTML = '';
                            if (msg) {
                                msg.textContent = 'Results service is unavailable. Please try again.';
                                msg.className = 'attemptMsg bad';
                            }
                            return [2 /*return*/];
                        }
                        _b.label = 2;
                    case 2:
                        _b.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, sb.rpc('hpt_get_candidate_attempts', { p_phone: phone })];
                    case 3:
                        _a = _b.sent(), data = _a.data, error = _a.error;
                        if (error)
                            throw error;
                        rows_1 = data || [];
                        if (!rows_1.length) {
                            list.innerHTML = '<div class="attemptEmpty">No HPT attempts found for this mobile number.</div>';
                            if (msg) {
                                msg.textContent = '';
                                msg.className = 'attemptMsg';
                            }
                            return [2 /*return*/];
                        }
                        if (msg) {
                            msg.textContent = "".concat(rows_1.length, " attempt").concat(rows_1.length === 1 ? '' : 's', " found");
                            msg.className = 'attemptMsg ok';
                        }
                        list.innerHTML = rows_1.map(function (r, i) {
                            var passed = Number(r.total_score || 0) >= C.passMark;
                            var d = new Date(r.completed_at || r.started_at);
                            return "<article class=\"attemptCard\"><div class=\"attemptTop\"><div><span class=\"attemptDate\">".concat(d.toLocaleDateString('en-IN'), " \u2022 ").concat(d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }), "</span><strong>Attempt ").concat(rows_1.length - i, "</strong></div><span class=\"attemptStatus ").concat(passed ? 'pass' : 'fail', "\">").concat(passed ? 'PASS' : 'NOT PASSED', "</span></div><div class=\"attemptScore\"><b>").concat(Number(r.total_score || 0), "</b><span>/ 100</span></div><div class=\"attemptMeta\">Pass mark ").concat(C.passMark, " \u2022 ").concat(passed ? 'Certificate available' : 'Certificate not available', "</div>").concat(passed ? "<button class=\"attemptCertBtn\" type=\"button\" data-attempt-cert=\"".concat(escHtml(r.id), "\">\u2193 DOWNLOAD CERTIFICATE</button>") : '', "</article>");
                        }).join('');
                        list.querySelectorAll('[data-attempt-cert]').forEach(function (btn) { return btn.onclick = function () { return __awaiter(_this_1, void 0, void 0, function () {
                            var r, e_4;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        r = rows_1.find(function (x) { return String(x.id) === String(btn.dataset.attemptCert); });
                                        if (!r)
                                            return [2 /*return*/];
                                        btn.disabled = true;
                                        btn.textContent = 'GENERATING…';
                                        _a.label = 1;
                                    case 1:
                                        _a.trys.push([1, 3, 4, 5]);
                                        return [4 /*yield*/, printCertificate({ id: r.id, total: r.total_score, completed_at: r.completed_at, candidate_name: r.candidate_name }, { name: r.candidate_name, phone: r.phone })];
                                    case 2:
                                        _a.sent();
                                        return [3 /*break*/, 5];
                                    case 3:
                                        e_4 = _a.sent();
                                        console.error(e_4);
                                        toast('Could not generate the certificate.', true);
                                        return [3 /*break*/, 5];
                                    case 4:
                                        btn.disabled = false;
                                        btn.textContent = '↓ DOWNLOAD CERTIFICATE';
                                        return [7 /*endfinally*/];
                                    case 5: return [2 /*return*/];
                                }
                            });
                        }); }; });
                        return [3 /*break*/, 5];
                    case 4:
                        e_3 = _b.sent();
                        console.error(e_3);
                        list.innerHTML = '';
                        if (msg) {
                            msg.textContent = 'Could not load attempts. Please try again.';
                            msg.className = 'attemptMsg bad';
                        }
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                }
            });
        });
    }
    function escHtml(s) { return String(s !== null && s !== void 0 ? s : '').replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]); }); }
    function openAttempts() { show('attemptsModal', true); $('attemptPhone').value = ''; $('attemptMsg').textContent = ''; $('attemptList').innerHTML = '<div class="attemptEmpty">Enter your mobile number to view your HPT attempts.</div>'; setTimeout(function () { var _a; return (_a = $('attemptPhone')) === null || _a === void 0 ? void 0 : _a.focus(); }, 80); }
    function closeAttempts() { show('attemptsModal', false); }
    function setupCandidateCertificate() { $('printCertBtn').onclick = printCertificate; }
    $('startBtn').onclick = begin;
    $('resultClose').onclick = function () { show('resultScreen', false); show('startScreen', true); };
    $('newBtn').onclick = function () { show('resultScreen', false); show('startScreen', true); };
    $('printCertBtn').onclick = function () { return printCertificate(); };
    var viewAttemptsBtn = $('viewAttemptsBtn');
    if (viewAttemptsBtn)
        viewAttemptsBtn.onclick = openAttempts;
    $('attemptSearchBtn').onclick = lookupAttempts;
    $('attemptCloseBtn').onclick = closeAttempts;
    $('attemptPhone').onkeydown = function (e) { if (e.key === 'Enter')
        lookupAttempts(); };
    $('attemptsModal').onclick = function (e) { if (e.target === $('attemptsModal'))
        closeAttempts(); };
    $('skipBtn').onclick = finishClip;
    $('soundBtn').onclick = function () { sound = !sound; video.muted = !sound; $('soundBtn').textContent = sound ? '🔊' : '🔇'; };
    $('fullBtn').onclick = function () { var _a, _b, _c; if (!document.fullscreenElement)
        (_b = (_a = document.documentElement).requestFullscreen) === null || _b === void 0 ? void 0 : _b.call(_a);
    else
        (_c = document.exitFullscreen) === null || _c === void 0 ? void 0 : _c.call(document); };
    $('helpBtn').onclick = function () { return toast('Tap when a developing hazard becomes apparent. You can make up to 5 responses per clip.'); };
    $('exitBtn').onclick = function () { if (confirm('Exit the examination? This attempt will be incomplete.')) {
        clearTimeout(timer);
        video.pause();
        running = false;
        show('examScreen', false);
        show('startScreen', true);
    } };
    $('playNow').onclick = function () { return video.play().then(function () { $('playOverlay').hidden = true; running = true; clearTimeout(timer); timer = setTimeout(finishClip, C.clipLimitSeconds * 1000); }).catch(function () { return toast('Video could not start', true); }); };
    video.addEventListener('timeupdate', function () { update(); timeline(); });
    video.addEventListener('ended', finishClip);
    function responseBeep() { try {
        if (!sound)
            return;
        audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended')
            audioCtx.resume();
        var now = audioCtx.currentTime;
        var o1 = audioCtx.createOscillator(), o2 = audioCtx.createOscillator(), g = audioCtx.createGain();
        o1.type = 'triangle';
        o2.type = 'sine';
        o1.frequency.setValueAtTime(720, now);
        o1.frequency.exponentialRampToValueAtTime(1080, now + 0.07);
        o2.frequency.setValueAtTime(1080, now + 0.025);
        o2.frequency.exponentialRampToValueAtTime(1420, now + 0.09);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(0.34, now + 0.012);
        g.gain.exponentialRampToValueAtTime(0.18, now + 0.075);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
        o1.connect(g);
        o2.connect(g);
        g.connect(audioCtx.destination);
        o1.start(now);
        o2.start(now + 0.018);
        o1.stop(now + 0.225);
        o2.stop(now + 0.225);
    }
    catch (_a) { } }
    video.addEventListener('click', function (e) {
        if (!running || finishing)
            return;
        var max = Math.max(1, Number(C.maxResponsesPerClip) || 5);
        if (responseLocked || responses.length >= max) {
            responseLocked = true;
            responseLimitWarning();
            update();
            return;
        }
        var t = video.currentTime, hz = order[pos].hazards || [];
        var best = null;
        hz.forEach(function (h, i) {
            var hn = h.hazard_no || i + 1;
            if (responses.some(function (r) { return r.hazard_no === hn; }))
                return;
            var delta = t - Number(h.t);
            if (delta >= 0 && delta <= 5) {
                var pts = delta <= 0.75 ? 5 : delta <= 1.5 ? 4 : delta <= 2.5 ? 3 : delta <= 3.5 ? 2 : 1;
                if (!best || pts > best.points)
                    best = { hazard_no: hn, points: pts };
            }
        });
        var r = { t: t, response_no: responses.length + 1, hazard_no: (best === null || best === void 0 ? void 0 : best.hazard_no) || null, points: (best === null || best === void 0 ? void 0 : best.points) || 0 };
        responses.push(r);
        responseBeep();
        if (responses.length >= max)
            responseLocked = true;
        update();
        order[pos]._responses = responses.slice();
    });
    var deferredInstallPrompt = null;
    function isStandalone() { var _a; return ((_a = window.matchMedia) === null || _a === void 0 ? void 0 : _a.call(window, '(display-mode: standalone)').matches) || window.navigator.standalone === true; }
    function showInstallHelp() { var m = $('installHelpModal'); if (!m)
        return; $('installHelpText').innerHTML = 'On Android Chrome, use <b>Install app</b> when offered. On iPhone, open the browser share menu and choose <b>Add to Home Screen</b>.'; show('installHelpModal', true); }
    window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferredInstallPrompt = e; show('installAppCard', !isStandalone()); });
    window.addEventListener('appinstalled', function () { deferredInstallPrompt = null; show('installAppCard', false); });
    $('installAppBtn').onclick = function () { return __awaiter(_this_1, void 0, void 0, function () { var _a; return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                if (!deferredInstallPrompt) return [3 /*break*/, 5];
                deferredInstallPrompt.prompt();
                _b.label = 1;
            case 1:
                _b.trys.push([1, 3, , 4]);
                return [4 /*yield*/, deferredInstallPrompt.userChoice];
            case 2:
                _b.sent();
                return [3 /*break*/, 4];
            case 3:
                _a = _b.sent();
                return [3 /*break*/, 4];
            case 4:
                deferredInstallPrompt = null;
                return [2 /*return*/];
            case 5:
                showInstallHelp();
                return [2 /*return*/];
        }
    }); }); };
    $('installHelpClose').onclick = function () { return show('installHelpModal', false); };
    $('installHelpOk').onclick = function () { return show('installHelpModal', false); };
    if (!isStandalone())
        show('installAppCard', true);
    setupHomeMedia();
    (_a = $('startScreen').querySelector('input')) === null || _a === void 0 ? void 0 : _a.focus();
    show('startScreen', true);
    show('examScreen', false);
    show('resultScreen', false);
    startLoadingScreen();
    window.RAJU_HPT_READY = true;
})();
