var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function (t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s)
                if (Object.prototype.hasOwnProperty.call(s, p))
                    t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try {
            step(generator.next(value));
        }
        catch (e) {
            reject(e);
        } }
        function rejected(value) { try {
            step(generator["throw"](value));
        }
        catch (e) {
            reject(e);
        } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function () { if (t[0] & 1)
            throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function () { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f)
            throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _)
            try {
                if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done)
                    return t;
                if (y = 0, t)
                    op = [op[0] & 2, t.value];
                switch (op[0]) {
                    case 0:
                    case 1:
                        t = op;
                        break;
                    case 4:
                        _.label++;
                        return { value: op[1], done: false };
                    case 5:
                        _.label++;
                        y = op[1];
                        op = [0];
                        continue;
                    case 7:
                        op = _.ops.pop();
                        _.trys.pop();
                        continue;
                    default:
                        if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                            _ = 0;
                            continue;
                        }
                        if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) {
                            _.label = op[1];
                            break;
                        }
                        if (op[0] === 6 && _.label < t[1]) {
                            _.label = t[1];
                            t = op;
                            break;
                        }
                        if (t && _.label < t[2]) {
                            _.label = t[2];
                            _.ops.push(op);
                            break;
                        }
                        if (t[2])
                            _.ops.pop();
                        _.trys.pop();
                        continue;
                }
                op = body.call(thisArg, _);
            }
            catch (e) {
                op = [6, e];
                y = 0;
            }
            finally {
                f = t = 0;
            }
        if (op[0] & 5)
            throw op[1];
        return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2)
        for (var i = 0, l = from.length, ar; i < l; i++) {
            if (ar || !(i in from)) {
                if (!ar)
                    ar = Array.prototype.slice.call(from, 0, i);
                ar[i] = from[i];
            }
        }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var _this = this;
(function () {
    'use strict';
    var C = window.RAJU_HPT_CONFIG;
    var sb = window.supabase.createClient(C.supabaseUrl, C.supabaseAnonKey);
    var $ = function (id) { return document.getElementById(id); };
    var results = [], videos = [], editingId = null, localUrl = null, localFile = null, editingCode = '';
    var esc = function (s) { return String(s !== null && s !== void 0 ? s : '').replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]); }); };
    var fmt = function (s) { s = Math.max(0, Number(s) || 0); return "".concat(String(Math.floor(s / 60)).padStart(2, '0'), ":").concat(String(Math.floor(s % 60)).padStart(2, '0'), ".").concat(Math.floor((s % 1) * 10)); };
    var notice = function (t, bad) {
        if (bad === void 0) {
            bad = false;
        }
        var e = $('notice');
        e.hidden = false;
        e.textContent = t;
        e.className = 'notice ' + (bad ? 'bad' : 'good');
        clearTimeout(e._t);
        e._t = setTimeout(function () { return e.hidden = true; }, 6000);
    };
    var emsg = function (t, bad) {
        if (bad === void 0) {
            bad = false;
        }
        $('editorMsg').textContent = t;
        $('editorMsg').className = 'message ' + (bad ? 'bad' : 'good');
    };
    function showLogin() { $('login').hidden = false; $('dashboard').hidden = true; $('logoutBtn').hidden = true; $('adminIdentity').hidden = true; $('detailModal').hidden = true; }
    function showDash(a) { $('login').hidden = true; $('dashboard').hidden = false; $('logoutBtn').hidden = false; $('adminIdentity').hidden = false; $('adminIdentity').textContent = (a === null || a === void 0 ? void 0 : a.full_name) || (a === null || a === void 0 ? void 0 : a.email) || ''; }
    function guard() {
        return __awaiter(this, void 0, void 0, function () {
            var session, _a, admin, error;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, sb.auth.getSession()];
                    case 1:
                        session = (_b.sent()).data.session;
                        if (!session) {
                            showLogin();
                            return [2 /*return*/, null];
                        }
                        return [4 /*yield*/, sb.from('admin_users').select('id,full_name,email').eq('id', session.user.id).eq('active', true).maybeSingle()];
                    case 2:
                        _a = _b.sent(), admin = _a.data, error = _a.error;
                        if (!(error || !admin))
                            return [3 /*break*/, 4];
                        return [4 /*yield*/, sb.auth.signOut()];
                    case 3:
                        _b.sent();
                        showLogin();
                        $('loginMsg').textContent = 'This account is not an active Raju Driving School admin.';
                        return [2 /*return*/, null];
                    case 4: return [2 /*return*/, { session: session, admin: admin }];
                }
            });
        });
    }
    function login() {
        return __awaiter(this, void 0, void 0, function () {
            var email, password, error, a;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        email = $('email').value.trim(), password = $('password').value;
                        if (!email || !password) {
                            $('loginMsg').textContent = 'Enter email and password.';
                            return [2 /*return*/];
                        }
                        $('loginBtn').disabled = true;
                        $('loginMsg').textContent = 'Signing in…';
                        return [4 /*yield*/, sb.auth.signInWithPassword({ email: email, password: password })];
                    case 1:
                        error = (_a.sent()).error;
                        if (error) {
                            $('loginMsg').textContent = error.message;
                            $('loginBtn').disabled = false;
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, guard()];
                    case 2:
                        a = _a.sent();
                        $('loginBtn').disabled = false;
                        if (!a)
                            return [3 /*break*/, 4];
                        showDash(a.admin);
                        return [4 /*yield*/, refreshAll()];
                    case 3:
                        _a.sent();
                        _a.label = 4;
                    case 4: return [2 /*return*/];
                }
            });
        });
    }
    function refreshAll() {
        return __awaiter(this, void 0, void 0, function () {
            var a;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, guard()];
                    case 1:
                        a = _a.sent();
                        if (!a)
                            return [2 /*return*/];
                        return [4 /*yield*/, Promise.all([loadResults(), loadVideos(), loadAccessCode()])];
                    case 2:
                        _a.sent();
                        updateStats();
                        return [2 /*return*/];
                }
            });
        });
    }
    function loadAccessCode() {
        return __awaiter(this, void 0, void 0, function () {
            var e, m, _a, data, error, err_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        e = $('adminAccessCode'), m = $('accessCodeMsg');
                        if (!e)
                            return [2 /*return*/];
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, sb.from('hpt_settings').select('access_code').eq('id', 1).maybeSingle()];
                    case 2:
                        _a = _b.sent(), data = _a.data, error = _a.error;
                        if (error)
                            throw error;
                        e.value = (data === null || data === void 0 ? void 0 : data.access_code) || '1234';
                        m.textContent = data ? '' : 'Run the included supabase-hpt-v21-access-code.sql migration once to enable persistent access-code changes.';
                        m.className = 'message ' + (data ? 'good' : 'bad');
                        return [3 /*break*/, 4];
                    case 3:
                        err_1 = _b.sent();
                        e.value = '1234';
                        m.textContent = 'Access-code settings are not configured yet. Run supabase-hpt-v21-access-code.sql in Supabase.';
                        m.className = 'message bad';
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    }
    function saveAccessCode() {
        return __awaiter(this, void 0, void 0, function () {
            var e, m, code, a, error, err_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        e = $('adminAccessCode'), m = $('accessCodeMsg');
                        code = e.value.trim();
                        if (!code) {
                            m.textContent = 'Enter an access code.';
                            m.className = 'message bad';
                            return [2 /*return*/];
                        }
                        if (code.length < 4) {
                            m.textContent = 'Access code must be at least 4 characters.';
                            m.className = 'message bad';
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, guard()];
                    case 1:
                        a = _a.sent();
                        if (!a)
                            return [2 /*return*/];
                        $('saveAccessCode').disabled = true;
                        $('saveAccessCode').textContent = 'SAVING…';
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, 5, 6]);
                        return [4 /*yield*/, sb.from('hpt_settings').update({ access_code: code, updated_at: new Date().toISOString() }).eq('id', 1)];
                    case 3:
                        error = (_a.sent()).error;
                        if (error)
                            throw error;
                        m.textContent = '✓ Candidate access code updated.';
                        m.className = 'message good';
                        notice('Candidate HPT access code updated.');
                        return [3 /*break*/, 6];
                    case 4:
                        err_2 = _a.sent();
                        m.textContent = err_2.message || 'Could not update access code.';
                        m.className = 'message bad';
                        notice(err_2.message || 'Could not update access code.', true);
                        return [3 /*break*/, 6];
                    case 5:
                        $('saveAccessCode').disabled = false;
                        $('saveAccessCode').textContent = 'SAVE ACCESS CODE';
                        return [7 /*endfinally*/];
                    case 6: return [2 /*return*/];
                }
            });
        });
    }
    function loadResults() {
        return __awaiter(this, void 0, void 0, function () {
            var all, pageSize, from, _a, data, error;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        all = [];
                        pageSize = 1000;
                        from = 0;
                        _b.label = 1;
                    case 1: return [4 /*yield*/, sb.from('hpt_attempts').select('id,candidate_name,phone,started_at,completed_at,total_score,passed,clip_order').order('started_at', { ascending: false }).range(from, from + pageSize - 1)];
                    case 2:
                        _a = _b.sent(), data = _a.data, error = _a.error;
                        if (error) {
                            notice(error.message, true);
                            return [2 /*return*/];
                        }
                        all.push.apply(all, (data || []));
                        if (!data || data.length < pageSize)
                            return [3 /*break*/, 4];
                        _b.label = 3;
                    case 3:
                        from += pageSize;
                        return [3 /*break*/, 1];
                    case 4:
                        results = all;
                        renderResults();
                        return [2 /*return*/];
                }
            });
        });
    }
    function isPassed(r) { return r.passed === true || Number(r.total_score || 0) >= 60; }
    function renderResults() {
        var q = $('searchResults').value.trim().toLowerCase(), f = $('resultFilter').value;
        var rows = results.filter(function (r) { return (!q || "".concat(r.candidate_name, " ").concat(r.phone).toLowerCase().includes(q)) && (f === 'all' || (f === 'pass' && isPassed(r)) || (f === 'fail' && !isPassed(r))); });
        $('resultsBody').innerHTML = rows.map(function (r) { return "<tr><td>".concat(new Date(r.started_at).toLocaleString('en-IN'), "</td><td><b>").concat(esc(r.candidate_name), "</b></td><td>").concat(esc(r.phone), "</td><td class=\"score\">").concat(Number(r.total_score || 0), " / 100</td><td class=\"").concat(isPassed(r) ? 'pass' : 'fail', "\">").concat(isPassed(r) ? 'PASS' : 'NOT PASSED', "</td><td><button class=\"small\" data-view=\"").concat(r.id, "\">VIEW</button>").concat(isPassed(r) ? "<button class=\"small certificate-btn\" title=\"Download HPT certificate\" data-certificate=\"".concat(r.id, "\">PRINT</button>") : '', "<button class=\"small danger-outline\" data-del-attempt=\"").concat(r.id, "\">DELETE</button></td></tr>"); }).join('') || '<tr><td colspan="6" class="empty">No examination results found.</td></tr>';
        var mr = $('mobileResults');
        if (mr)
            mr.innerHTML = rows.map(function (r) { return "<article class=\"result-card\"><div class=\"rc-head\"><div><small>DATE</small><b>".concat(new Date(r.started_at).toLocaleDateString('en-IN'), "</b></div><span class=\"").concat(isPassed(r) ? 'pass' : 'fail', "\">").concat(isPassed(r) ? 'PASS' : 'NOT PASSED', "</span></div><h3>").concat(esc(r.candidate_name), "</h3><div class=\"rc-grid\"><div><small>PHONE</small><b>").concat(esc(r.phone), "</b></div><div><small>SCORE</small><b>").concat(Number(r.total_score || 0), " / 100</b></div></div><div class=\"rc-actions\"><button class=\"small\" data-view=\"").concat(r.id, "\">VIEW</button>").concat(isPassed(r) ? "<button class=\"small certificate-btn\" data-certificate=\"".concat(r.id, "\">PRINT</button>") : '', "<button class=\"small danger-outline\" data-del-attempt=\"").concat(r.id, "\">DELETE</button></div></article>"); }).join('') || '<div class="empty">No examination results found.</div>';
        document.querySelectorAll('[data-view]').forEach(function (b) { return b.onclick = function () { return showDetail(b.dataset.view); }; });
        document.querySelectorAll('[data-certificate]').forEach(function (b) { return b.onclick = function () { return downloadCertificate(b.dataset.certificate); }; });
        document.querySelectorAll('[data-del-attempt]').forEach(function (b) { return b.onclick = function () { return deleteAttempt(b.dataset.delAttempt); }; });
    }
    function deleteAttempt(id) {
        return __awaiter(this, void 0, void 0, function () {
            var r, error, e2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        r = results.find(function (x) { return x.id === id; });
                        if (!r || !confirm("Delete the complete examination record for ".concat(r.candidate_name, "? This cannot be undone.")))
                            return [2 /*return*/];
                        return [4 /*yield*/, sb.from('hpt_responses').delete().eq('attempt_id', id)];
                    case 1:
                        error = (_a.sent()).error;
                        if (error) {
                            notice(error.message, true);
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, sb.from('hpt_attempts').delete().eq('id', id)];
                    case 2:
                        e2 = (_a.sent()).error;
                        if (e2) {
                            notice(e2.message, true);
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, loadResults()];
                    case 3:
                        _a.sent();
                        updateStats();
                        notice('Examination record deleted.');
                        return [2 /*return*/];
                }
            });
        });
    }
    function showDetail(id) {
        return __awaiter(this, void 0, void 0, function () {
            var r, _a, rs, error;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, guard()];
                    case 1:
                        if (!(_b.sent()))
                            return [2 /*return*/];
                        r = results.find(function (x) { return x.id === id; });
                        if (!r)
                            return [2 /*return*/];
                        return [4 /*yield*/, sb.from('hpt_responses').select('response_no,click_time_seconds,hazard_no,awarded_marks,video_id').eq('attempt_id', id).order('response_no')];
                    case 2:
                        _a = _b.sent(), rs = _a.data, error = _a.error;
                        if (error) {
                            notice(error.message, true);
                            return [2 /*return*/];
                        }
                        $('detailTitle').textContent = r.candidate_name;
                        $('detailMeta').textContent = "".concat(r.phone, " \u2022 ").concat(new Date(r.started_at).toLocaleString('en-IN'), " \u2022 ").concat(isPassed(r) ? 'PASS' : 'NOT PASSED', " \u2022 ").concat(r.total_score, "/100");
                        $('detailBody').innerHTML = "<div class=\"detail-clip\"><span>Responses</span><b>".concat((rs === null || rs === void 0 ? void 0 : rs.length) || 0, "</b></div><div class=\"detail-clip\"><span>Randomized order</span><b>").concat((r.clip_order || []).map(esc).join(' → ') || '—', "</b></div>") + (rs || []).map(function (x) { return "<div class=\"detail-clip\"><span>Response ".concat(x.response_no, " \u2022 ").concat(Number(x.click_time_seconds).toFixed(1), "s \u2022 Hazard ").concat(x.hazard_no || '—', "</span><b>+").concat(x.awarded_marks, "</b></div>"); }).join('');
                        $('detailModal').hidden = false;
                        return [2 /*return*/];
                }
            });
        });
    }
    function updateStats() { var passed = results.filter(isPassed).length, avg = results.length ? Math.round(results.reduce(function (a, r) { return a + Number(r.total_score || 0); }, 0) / results.length) : 0, ready = videos.filter(function (v) { return v.active && v.hazard_count >= 2; }).length; $('statAttempts').textContent = results.length; $('statPassed').textContent = passed; $('statAverage').textContent = avg; $('statVideos').textContent = ready; }
    function loadVideos() {
        return __awaiter(this, void 0, void 0, function () {
            var _a, data, error;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, sb.from('hpt_videos').select('id,clip_code,title,video_path,duration_seconds,active,updated_at,hpt_hazards(id,hazard_no,timestamp_seconds,label)').order('clip_code')];
                    case 1:
                        _a = _b.sent(), data = _a.data, error = _a.error;
                        if (error) {
                            notice(error.message, true);
                            return [2 /*return*/];
                        }
                        videos = (data || []).map(function (v) { return (__assign(__assign({}, v), { hazard_count: (v.hpt_hazards || []).length })); });
                        renderVideos();
                        return [2 /*return*/];
                }
            });
        });
    }
    function thumbPath(v) { var n = String(v.clip_code || '').replace(/\D/g, ''); return n ? "thumbnails/".concat(Number(n), ".jpg") : ''; }
    function renderVideos() { $('videoGrid').innerHTML = videos.map(function (v) { var thumb = thumbPath(v); return "<article class=\"video-card\"><div class=\"vc-preview\" data-edit=\"".concat(v.id, "\" title=\"Open clip\"><img class=\"vc-thumb\" src=\"").concat(thumb, "\" alt=\"Preview of Clip ").concat(esc(v.clip_code), "\" loading=\"lazy\" onerror=\"this.hidden=true;this.nextElementSibling.hidden=false\"><video class=\"vc-thumb-fallback\" src=\"").concat(esc(resolveVideoPath(v.video_path)), "\" muted playsinline preload=\"metadata\" hidden></video><span class=\"vc-play\">\u25B6</span></div><div class=\"vc-top\"><span class=\"clip\">CLIP ").concat(esc(v.clip_code), "</span><span class=\"status ").concat(v.active ? 'on' : 'off', "\">\u25CF ").concat(v.active ? 'ACTIVE' : 'INACTIVE', "</span></div><h3>").concat(esc(v.title), "</h3><p>").concat(esc(v.video_path), "</p><div class=\"tags\"><span>").concat(Number(v.duration_seconds || 0).toFixed(1), "s</span><span>").concat(v.hazard_count, "/2 hazards</span></div><div class=\"vc-actions\"><button class=\"small\" data-edit=\"").concat(v.id, "\">EDIT & MARK</button><button class=\"small\" data-toggle=\"").concat(v.id, "\">").concat(v.active ? 'DISABLE' : 'ENABLE', "</button></div></article>"); }).join('') || '<div class="empty">No HPT clips registered.</div>'; document.querySelectorAll('[data-edit]').forEach(function (b) { return b.onclick = function () { return editVideo(b.dataset.edit); }; }); document.querySelectorAll('[data-toggle]').forEach(function (b) { return b.onclick = function () { return toggleVideo(b.dataset.toggle); }; }); }
    function clearLocal() {
        if (localUrl) {
            URL.revokeObjectURL(localUrl);
            localUrl = null;
        }
        localFile = null;
    }
    function resetEditor() { clearLocal(); editingId = null; editingCode = ''; $('videoFile').value = ''; $('fileName').textContent = 'No file selected'; $('videoTitle').value = ''; $('h1t').value = ''; $('h2t').value = ''; $('h1label').value = ''; $('h2label').value = ''; $('active').checked = true; $('clipCodeDisplay').textContent = '—'; $('videoPathDisplay').textContent = 'videos/—'; $('h1preview').textContent = 'Not set'; $('h2preview').textContent = 'Not set'; $('preview').removeAttribute('src'); $('preview').load(); $('previewEmpty').hidden = false; $('deleteVideo').hidden = true; emsg(''); }
    function nextClipCode() {
        var nums = videos.map(function (v) { return parseInt(String(v.clip_code).replace(/\D/g, ''), 10); }).filter(Number.isFinite);
        var n = Math.max.apply(Math, __spreadArray([10], nums, false)) + 1;
        while (videos.some(function (v) { return String(v.clip_code).padStart(2, '0') === String(n).padStart(2, '0'); }))
            n++;
        return String(n).padStart(2, '0');
    }
    function newVideo() { resetEditor(); editingId = null; editingCode = nextClipCode(); $('editor').hidden = false; $('editorEyebrow').textContent = 'NEW VIDEO'; $('editorTitle').textContent = 'Upload HPT Video'; $('editorSub').textContent = 'Select a video. Clip number and GitHub path are assigned automatically.'; $('clipCodeDisplay').textContent = editingCode; $('videoPathDisplay').textContent = "videos/".concat(editingCode, ".webm"); $('videosPanel').hidden = false; $('editor').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    function editVideo(id) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        var v = videos.find(function (x) { return x.id === id; });
        if (!v)
            return;
        clearLocal();
        editingId = id;
        editingCode = v.clip_code;
        $('editor').hidden = false;
        $('editorEyebrow').textContent = 'EDIT CLIP';
        $('editorTitle').textContent = "Edit Clip ".concat(v.clip_code);
        $('editorSub').textContent = 'Replace the video if needed, adjust the two hazard points, then save once.';
        $('clipCodeDisplay').textContent = v.clip_code;
        $('videoPathDisplay').textContent = v.video_path;
        $('videoTitle').value = v.title;
        $('active').checked = !!v.active;
        $('videoFile').value = '';
        $('fileName').textContent = 'No replacement selected';
        var hs = (v.hpt_hazards || []).sort(function (a, b) { return a.hazard_no - b.hazard_no; });
        $('h1t').value = (_b = (_a = hs.find(function (x) { return x.hazard_no === 1; })) === null || _a === void 0 ? void 0 : _a.timestamp_seconds) !== null && _b !== void 0 ? _b : '';
        $('h2t').value = (_d = (_c = hs.find(function (x) { return x.hazard_no === 2; })) === null || _c === void 0 ? void 0 : _c.timestamp_seconds) !== null && _d !== void 0 ? _d : '';
        $('h1label').value = (_f = (_e = hs.find(function (x) { return x.hazard_no === 1; })) === null || _e === void 0 ? void 0 : _e.label) !== null && _f !== void 0 ? _f : '';
        $('h2label').value = (_h = (_g = hs.find(function (x) { return x.hazard_no === 2; })) === null || _g === void 0 ? void 0 : _g.label) !== null && _h !== void 0 ? _h : '';
        updateHazardPreviews();
        $('preview').src = resolveVideoPath(v.video_path);
        $('previewEmpty').hidden = true;
        $('preview').load();
        $('deleteVideo').hidden = false;
        $('videosPanel').hidden = false;
        $('editor').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    function resolveVideoPath(path) {
        if (!path)
            return '';
        if (/^https?:\/\//i.test(path))
            return path;
        var clean = path.replace(/^\.\//, '');
        return new URL(clean, location.href).href;
    }
    function setMarkers() {
        var d = Number($('preview').duration) || 50;
        var fill = Math.min(100, (Number($('preview').currentTime) || 0) / Math.max(1, d) * 100);
        $('trackFill').style.width = fill + '%';
        for (var _i = 0, _a = [1, 2]; _i < _a.length; _i++) {
            var n = _a[_i];
            var val = Number($("h".concat(n, "t")).value), m = $("marker".concat(n));
            if (Number.isFinite(val) && val >= 0 && val <= d) {
                m.hidden = false;
                m.style.left = (val / d * 100) + '%';
            }
            else
                m.hidden = true;
        }
    }
    function updateHazardPreviews() {
        for (var _i = 0, _a = [1, 2]; _i < _a.length; _i++) {
            var n = _a[_i];
            $("h".concat(n, "preview")).textContent = Number.isFinite(Number($("h".concat(n, "t")).value)) && $("h".concat(n, "t")).value !== '' ? fmt(Number($("h".concat(n, "t")).value)) : 'Not set';
        }
        setMarkers();
    }
    function setHaz(n) {
        if (!$('preview').src || !Number.isFinite($('preview').currentTime)) {
            emsg('Choose a playable video first.', true);
            return;
        }
        var t = Number($('preview').currentTime.toFixed(1));
        $("h".concat(n, "t")).value = t;
        updateHazardPreviews();
        emsg("Hazard ".concat(n, " set at ").concat(fmt(t), "."));
    }
    function validate() {
        var title = $('videoTitle').value.trim(), t1 = Number($('h1t').value), t2 = Number($('h2t').value), d = Number($('preview').duration);
        if (!localFile && !editingId)
            return 'Choose a video file first.';
        if (!title)
            return 'Enter a clip title.';
        if (!Number.isFinite(t1) || !Number.isFinite(t2))
            return 'Set both developing hazards using the buttons below the video.';
        if (t1 === t2)
            return 'Hazard timestamps must be different.';
        if (Number.isFinite(d) && (t1 > d || t2 > d))
            return 'A hazard timestamp cannot be beyond the video duration.';
        return '';
    }
    function publishFile(path_1) {
        return __awaiter(this, arguments, void 0, function (path, file) {
            var a, fd, session, r, e_1, text, j;
            if (file === void 0) {
                file = localFile;
            }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, guard()];
                    case 1:
                        a = _a.sent();
                        if (!a)
                            return [2 /*return*/, false];
                        fd = new FormData();
                        fd.append('file', file);
                        fd.append('path', path);
                        fd.append('commit_message', "HPT: publish ".concat(editingCode));
                        return [4 /*yield*/, sb.auth.getSession()];
                    case 2:
                        session = (_a.sent()).data.session;
                        _a.label = 3;
                    case 3:
                        _a.trys.push([3, 5, , 6]);
                        return [4 /*yield*/, fetch(C.githubPublishEndpoint, { method: 'POST', headers: { Authorization: "Bearer ".concat(session.access_token) }, body: fd })];
                    case 4:
                        r = _a.sent();
                        return [3 /*break*/, 6];
                    case 5:
                        e_1 = _a.sent();
                        throw new Error("Upload connection failed. The HPT GitHub Edge Function is not reachable. (".concat(e_1.message, ")"));
                    case 6: return [4 /*yield*/, r.text()];
                    case 7:
                        text = _a.sent();
                        j = {};
                        try {
                            j = JSON.parse(text);
                        }
                        catch (_b) { }
                        if (!r.ok)
                            throw new Error(j.error || "GitHub upload failed (".concat(r.status, ")."));
                        return [2 /*return*/, j];
                }
            });
        });
    }
    function makeVideoThumbnail(file) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, new Promise(function (resolve, reject) {
                            var url = URL.createObjectURL(file), v = document.createElement('video');
                            v.muted = true;
                            v.playsInline = true;
                            v.preload = 'metadata';
                            var done = false;
                            var cleanup = function () { URL.revokeObjectURL(url); v.remove(); };
                            v.onerror = function () {
                                if (!done) {
                                    done = true;
                                    cleanup();
                                    reject(new Error('Could not read video for thumbnail.'));
                                }
                            };
                            v.onloadedmetadata = function () {
                                try {
                                    v.currentTime = Math.min(1, Math.max(.1, (v.duration || 1) * .08));
                                }
                                catch (e) {
                                    v.currentTime = 0;
                                }
                            };
                            v.onseeked = function () {
                                if (done)
                                    return;
                                var c = document.createElement('canvas');
                                c.width = 640;
                                c.height = 360;
                                var x = c.getContext('2d');
                                x.drawImage(v, 0, 0, c.width, c.height);
                                c.toBlob(function (b) { done = true; cleanup(); b ? resolve(b) : reject(new Error('Could not create thumbnail.')); }, 'image/jpeg', .86);
                            };
                            v.src = url;
                            v.load();
                        })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    }
    function saveVideo() {
        return __awaiter(this, void 0, void 0, function () {
            var problem, duration, path, ext, thumb, thumbErr_1, payload, id, error, _a, existing, qerr, error, _b, data, error, he, e_2;
            var _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        problem = validate();
                        if (problem) {
                            emsg(problem, true);
                            return [2 /*return*/];
                        }
                        duration = Number($('preview').duration);
                        path = editingId ? (((_c = videos.find(function (v) { return v.id === editingId; })) === null || _c === void 0 ? void 0 : _c.video_path) || "videos/".concat(editingCode, ".webm")) : "videos/".concat(editingCode, ".webm");
                        if (localFile) {
                            ext = (localFile.name.split('.').pop() || 'webm').toLowerCase().replace(/[^a-z0-9]/g, '');
                            path = "videos/".concat(editingCode, ".").concat(ext || 'webm');
                        }
                        $('saveVideo').disabled = true;
                        $('saveVideo').textContent = 'SAVING & PUBLISHING…';
                        emsg('Uploading video…');
                        _d.label = 1;
                    case 1:
                        _d.trys.push([1, 17, 18, 19]);
                        if (!localFile)
                            return [3 /*break*/, 7];
                        return [4 /*yield*/, publishFile(path, localFile)];
                    case 2:
                        _d.sent();
                        _d.label = 3;
                    case 3:
                        _d.trys.push([3, 6, , 7]);
                        return [4 /*yield*/, makeVideoThumbnail(localFile)];
                    case 4:
                        thumb = _d.sent();
                        return [4 /*yield*/, publishFile("thumbnails/".concat(Number(String(editingCode).replace(/\D/g, '')), ".jpg"), thumb)];
                    case 5:
                        _d.sent();
                        return [3 /*break*/, 7];
                    case 6:
                        thumbErr_1 = _d.sent();
                        console.warn('HPT thumbnail upload skipped:', thumbErr_1);
                        return [3 /*break*/, 7];
                    case 7:
                        payload = { clip_code: editingCode, title: $('videoTitle').value.trim(), video_path: path, duration_seconds: Number((duration || 50).toFixed(2)), active: $('active').checked, updated_at: new Date().toISOString() };
                        id = editingId;
                        if (!id)
                            return [3 /*break*/, 9];
                        return [4 /*yield*/, sb.from('hpt_videos').update(payload).eq('id', id)];
                    case 8:
                        error = (_d.sent()).error;
                        if (error)
                            throw error;
                        return [3 /*break*/, 14];
                    case 9: return [4 /*yield*/, sb.from('hpt_videos').select('id').eq('clip_code', editingCode).maybeSingle()];
                    case 10:
                        _a = _d.sent(), existing = _a.data, qerr = _a.error;
                        if (qerr)
                            throw qerr;
                        if (!(existing === null || existing === void 0 ? void 0 : existing.id))
                            return [3 /*break*/, 12];
                        id = existing.id;
                        return [4 /*yield*/, sb.from('hpt_videos').update(payload).eq('id', id)];
                    case 11:
                        error = (_d.sent()).error;
                        if (error)
                            throw error;
                        return [3 /*break*/, 14];
                    case 12: return [4 /*yield*/, sb.from('hpt_videos').insert(payload).select('id').single()];
                    case 13:
                        _b = _d.sent(), data = _b.data, error = _b.error;
                        if (error)
                            throw error;
                        id = data.id;
                        _d.label = 14;
                    case 14: return [4 /*yield*/, sb.from('hpt_hazards').upsert([{ video_id: id, hazard_no: 1, timestamp_seconds: Number($('h1t').value), label: $('h1label').value.trim() || 'Developing hazard 1' }, { video_id: id, hazard_no: 2, timestamp_seconds: Number($('h2t').value), label: $('h2label').value.trim() || 'Developing hazard 2' }], { onConflict: 'video_id,hazard_no' })];
                    case 15:
                        he = (_d.sent()).error;
                        if (he)
                            throw he;
                        editingId = id;
                        return [4 /*yield*/, loadVideos()];
                    case 16:
                        _d.sent();
                        updateStats();
                        emsg('✓ Clip saved. Video published and both hazard timestamps are live.');
                        notice("Clip ".concat(editingCode, " saved successfully."));
                        return [3 /*break*/, 19];
                    case 17:
                        e_2 = _d.sent();
                        emsg(e_2.message || 'Could not save this clip.', true);
                        notice(e_2.message || 'Could not save this clip.', true);
                        return [3 /*break*/, 19];
                    case 18:
                        $('saveVideo').disabled = false;
                        $('saveVideo').textContent = '✓ SAVE & PUBLISH VIDEO';
                        return [7 /*endfinally*/];
                    case 19: return [2 /*return*/];
                }
            });
        });
    }
    function toggleVideo(id) {
        return __awaiter(this, void 0, void 0, function () {
            var v, error;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        v = videos.find(function (x) { return x.id === id; });
                        if (!v)
                            return [2 /*return*/];
                        return [4 /*yield*/, sb.from('hpt_videos').update({ active: !v.active, updated_at: new Date().toISOString() }).eq('id', id)];
                    case 1:
                        error = (_a.sent()).error;
                        if (error) {
                            notice(error.message, true);
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, loadVideos()];
                    case 2:
                        _a.sent();
                        updateStats();
                        return [2 /*return*/];
                }
            });
        });
    }
    function deleteVideo() {
        return __awaiter(this, void 0, void 0, function () {
            var v, ok, a, session, fd, r, e_3, text, j, h, error, wasMissing, e_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        v = videos.find(function (x) { return x.id === editingId; });
                        if (!v)
                            return [2 /*return*/];
                        ok = confirm("Delete Clip ".concat(v.clip_code, " permanently?\n\nThis will delete the video from GitHub and remove its HPT metadata and hazard timestamps from Supabase.\n\nThis cannot be undone."));
                        if (!ok)
                            return [2 /*return*/];
                        $('deleteVideo').disabled = true;
                        $('deleteVideo').textContent = 'DELETING…';
                        emsg('Deleting video from GitHub…');
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 12, 13, 14]);
                        return [4 /*yield*/, guard()];
                    case 2:
                        a = _a.sent();
                        if (!a)
                            throw new Error('Admin session is required.');
                        return [4 /*yield*/, sb.auth.getSession()];
                    case 3:
                        session = (_a.sent()).data.session;
                        fd = new FormData();
                        fd.append('action', 'delete');
                        fd.append('path', v.video_path);
                        fd.append('commit_message', "HPT: delete ".concat(v.clip_code));
                        r = void 0;
                        _a.label = 4;
                    case 4:
                        _a.trys.push([4, 6, , 7]);
                        return [4 /*yield*/, fetch(C.githubPublishEndpoint, { method: 'POST', headers: { Authorization: "Bearer ".concat(session.access_token) }, body: fd })];
                    case 5:
                        r = _a.sent();
                        return [3 /*break*/, 7];
                    case 6:
                        e_3 = _a.sent();
                        throw new Error("Delete connection failed. The HPT GitHub Edge Function is not reachable. (".concat(e_3.message, ")"));
                    case 7: return [4 /*yield*/, r.text()];
                    case 8:
                        text = _a.sent();
                        j = {};
                        try {
                            j = JSON.parse(text);
                        }
                        catch (_b) { }
                        if (!r.ok)
                            throw new Error(j.error || "GitHub delete failed (".concat(r.status, ")."));
                        emsg('GitHub video deleted. Removing HPT metadata…');
                        return [4 /*yield*/, sb.from('hpt_hazards').delete().eq('video_id', editingId)];
                    case 9:
                        h = (_a.sent()).error;
                        if (h)
                            throw h;
                        return [4 /*yield*/, sb.from('hpt_videos').delete().eq('id', editingId)];
                    case 10:
                        error = (_a.sent()).error;
                        if (error)
                            throw error;
                        wasMissing = !!j.missing;
                        closeEditor();
                        return [4 /*yield*/, loadVideos()];
                    case 11:
                        _a.sent();
                        updateStats();
                        notice(wasMissing ? "Clip ".concat(v.clip_code, " metadata deleted. GitHub file was already missing.") : "Clip ".concat(v.clip_code, " deleted from GitHub and Supabase."));
                        return [3 /*break*/, 14];
                    case 12:
                        e_4 = _a.sent();
                        emsg(e_4.message || 'Could not delete this clip.', true);
                        notice(e_4.message || 'Could not delete this clip.', true);
                        return [3 /*break*/, 14];
                    case 13:
                        $('deleteVideo').disabled = false;
                        $('deleteVideo').textContent = 'Delete clip';
                        return [7 /*endfinally*/];
                    case 14: return [2 /*return*/];
                }
            });
        });
    }
    function closeEditor() { clearLocal(); $('editor').hidden = true; editingId = null; editingCode = ''; }
    function imageData(url) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, new Promise(function (resolve, reject) { var img = new Image(); img.onload = function () { var c = document.createElement('canvas'); c.width = img.naturalWidth || img.width; c.height = img.naturalHeight || img.height; var x = c.getContext('2d'); x.drawImage(img, 0, 0); resolve(c.toDataURL('image/png')); }; img.onerror = reject; img.src = url + '?v=' + Date.now(); })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    }
    function downloadCertificate(id) {
        return __awaiter(this, void 0, void 0, function () {
            var r, btn, jsPDF, doc, W, H, logo, _a, lw, lh, d, e_5;
            var _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        r = results.find(function (x) { return x.id === id; });
                        if (!r || !isPassed(r))
                            return [2 /*return*/];
                        if (!((_b = window.jspdf) === null || _b === void 0 ? void 0 : _b.jsPDF)) {
                            notice('Certificate generator is not available. Please refresh the page.', true);
                            return [2 /*return*/];
                        }
                        btn = document.querySelector("[data-certificate=\"".concat(CSS.escape(id), "\"]"));
                        if (btn) {
                            btn.disabled = true;
                            btn.textContent = '…';
                        }
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 6, 7, 8]);
                        jsPDF = window.jspdf.jsPDF;
                        doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
                        W = 297, H = 210;
                        // Light, print-friendly certificate design.
                        doc.setFillColor(250, 251, 253);
                        doc.rect(0, 0, W, H, 'F');
                        doc.setDrawColor(212, 162, 32);
                        doc.setLineWidth(1.1);
                        doc.rect(8, 8, W - 16, H - 16, 'S');
                        doc.setDrawColor(33, 53, 72);
                        doc.setLineWidth(.35);
                        doc.rect(13, 13, W - 26, H - 26, 'S');
                        logo = null;
                        _c.label = 2;
                    case 2:
                        _c.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, imageData('raju-logo.png')];
                    case 3:
                        logo = _c.sent();
                        return [3 /*break*/, 5];
                    case 4:
                        _a = _c.sent();
                        return [3 /*break*/, 5];
                    case 5:
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
                        doc.text(String(r.candidate_name || 'Candidate'), W / 2, 112, { align: 'center' });
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
                        doc.text("SCORE: ".concat(Number(r.total_score || 0), " / 100"), W / 2, 149, { align: 'center' });
                        doc.setTextColor(35, 126, 78);
                        doc.setFontSize(16);
                        doc.text('PASS', W / 2, 160, { align: 'center' });
                        d = new Date(r.completed_at || r.started_at);
                        doc.setTextColor(92, 105, 116);
                        doc.setFont('helvetica', 'normal');
                        doc.setFontSize(9.5);
                        doc.text("Date: ".concat(d.toLocaleDateString('en-IN')), 45, 181);
                        doc.text("Certificate No: HPT-".concat(d.getFullYear()).concat(String(d.getMonth() + 1).padStart(2, '0')).concat(String(d.getDate()).padStart(2, '0'), "-").concat(String(r.id).slice(0, 8).toUpperCase()), W - 45, 181, { align: 'right' });
                        doc.setTextColor(33, 53, 72);
                        doc.setFont('helvetica', 'bold');
                        doc.setFontSize(9.5);
                        doc.text('RAJU MOTOR DRIVING SCHOOL • CHALAKUDY • SINCE 1969', W / 2, 191, { align: 'center' });
                        doc.save("Raju-HPT-Certificate-".concat(String(r.candidate_name || 'Candidate').replace(/[^a-z0-9]+/gi, '-'), ".pdf"));
                        notice("Certificate downloaded for ".concat(r.candidate_name, "."));
                        return [3 /*break*/, 8];
                    case 6:
                        e_5 = _c.sent();
                        console.error(e_5);
                        notice('Could not generate the certificate.', true);
                        return [3 /*break*/, 8];
                    case 7:
                        if (btn) {
                            btn.disabled = false;
                            btn.textContent = 'PRINT';
                        }
                        return [7 /*endfinally*/];
                    case 8: return [2 /*return*/];
                }
            });
        });
    }
    function exportCsv() { var lines = __spreadArray([['Date', 'Candidate', 'Phone', 'Score', 'Status']], results.map(function (r) { return [new Date(r.started_at).toLocaleString('en-IN'), r.candidate_name, r.phone, r.total_score, isPassed(r) ? 'PASS' : 'NOT PASSED']; }), true); var csv = lines.map(function (row) { return row.map(function (v) { return "\"".concat(String(v !== null && v !== void 0 ? v : '').replaceAll('"', '""'), "\""); }).join(','); }).join('\n'); var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'raju-hpt-results.csv'; a.click(); }
    $('loginBtn').onclick = login;
    $('password').onkeydown = function (e) {
        if (e.key === 'Enter')
            login();
    };
    $('saveAccessCode').onclick = saveAccessCode;
    $('logoutBtn').onclick = function () {
        return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, sb.auth.signOut()];
                    case 1:
                        _a.sent();
                        location.reload();
                        return [2 /*return*/];
                }
            });
        });
    };
    $('refreshAll').onclick = refreshAll;
    $('searchResults').oninput = renderResults;
    $('resultFilter').onchange = renderResults;
    $('exportCsv').onclick = exportCsv;
    $('newVideo').onclick = newVideo;
    $('closeEditor').onclick = closeEditor;
    $('saveVideo').onclick = saveVideo;
    $('deleteVideo').onclick = deleteVideo;
    $('mark1').onclick = function () { return setHaz(1); };
    $('mark2').onclick = function () { return setHaz(2); };
    $('annotationTrack').onclick = function (e) { var r = $('annotationTrack').getBoundingClientRect(); $('preview').currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * (Number($('preview').duration) || 50); setMarkers(); };
    var _loop_1 = function (n) {
        $("marker".concat(n)).onclick = function (e) { e.stopPropagation(); $('preview').currentTime = Number($("h".concat(n, "t")).value) || 0; };
    };
    for (var _i = 0, _a = [1, 2]; _i < _a.length; _i++) {
        var n = _a[_i];
        _loop_1(n);
    }
    $('preview').ontimeupdate = function () { $('now').textContent = fmt($('preview').currentTime); $('dur').textContent = fmt($('preview').duration); setMarkers(); };
    $('preview').onloadedmetadata = function () { $('previewEmpty').hidden = true; $('dur').textContent = fmt($('preview').duration); setMarkers(); };
    $('preview').onerror = function () { $('previewEmpty').hidden = false; $('previewEmpty').textContent = 'Video could not be loaded. If this is an existing clip, verify its published path.'; };
    $('videoFile').onchange = function () {
        clearLocal();
        localFile = $('videoFile').files[0] || null;
        if (localFile) {
            $('fileName').textContent = localFile.name;
            localUrl = URL.createObjectURL(localFile);
            $('preview').src = localUrl;
            $('previewEmpty').hidden = true;
            $('videoTitle').value = $('videoTitle').value || localFile.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
            $('preview').load();
        }
    };
    $('closeModal').onclick = function () { return $('detailModal').hidden = true; };
    $('detailModal').onclick = function (e) {
        if (e.target === $('detailModal'))
            $('detailModal').hidden = true;
    };
    document.querySelectorAll('.tab').forEach(function (t) { return t.onclick = function () { document.querySelectorAll('.tab').forEach(function (x) { return x.classList.remove('active'); }); t.classList.add('active'); var isR = t.dataset.tab === 'results'; $('resultsPanel').hidden = !isR; $('videosPanel').hidden = isR; $('editor').hidden = true; }; });
    var resultsPoll = null;
    function startResultsPolling() {
        var _this = this;
        clearInterval(resultsPoll);
        resultsPoll = setInterval(function () {
            return __awaiter(_this, void 0, void 0, function () {
                var e_6;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (document.hidden || $('dashboard').hidden)
                                return [2 /*return*/];
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 3, , 4]);
                            return [4 /*yield*/, loadResults()];
                        case 2:
                            _a.sent();
                            updateStats();
                            return [3 /*break*/, 4];
                        case 3:
                            e_6 = _a.sent();
                            console.error('HPT results refresh failed', e_6);
                            return [3 /*break*/, 4];
                        case 4: return [2 /*return*/];
                    }
                });
            });
        }, 5000);
    }
    document.addEventListener('visibilitychange', function () {
        if (!document.hidden && !$('dashboard').hidden)
            loadResults();
    });
    (function () {
        return __awaiter(_this, void 0, void 0, function () {
            var a;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, guard()];
                    case 1:
                        a = _a.sent();
                        if (!a)
                            return [3 /*break*/, 3];
                        showDash(a.admin);
                        return [4 /*yield*/, refreshAll()];
                    case 2:
                        _a.sent();
                        startResultsPolling();
                        _a.label = 3;
                    case 3: return [2 /*return*/];
                }
            });
        });
    })();
})();
