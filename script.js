/* ==========================================================================
   ۱. دیتابیس ابری زنده (Cloud Sync) + دیتابیس محلی
   ========================================================================== */
// آدرس دیتابیس ابری زنده مدرسه فاتحان آینده
const CLOUD_DB_URL = "https://fatehan-ayandeh-default-rtdb.firebaseio.com/schoolData.json";

let db = JSON.parse(localStorage.getItem('smart_school_db')) || [];
let currentUser = JSON.parse(localStorage.getItem('smart_school_user')) || null;
let currentClassFilter = 'all';
let isAdmin = false;
let selectedStudentIdForModal = null;

let rulesDB = JSON.parse(localStorage.getItem('smart_school_rules')) || [
    { id: 1, title: "غیبت غیرموجه", amount: -5 },
    { id: 2, title: "فعالیت کلاسی عالی", amount: 10 },
    { id: 3, title: "بی‌انضباطی در کلاس", amount: -2 },
    { id: 4, title: "کسب نمره ۲۰ در آزمون", amount: 15 }
];

// ارسال لحظه‌ای تمام تغییرات (امتیازها، غیبت‌ها و...) به ابر
function saveDB() {
    localStorage.setItem('smart_school_db', JSON.stringify(db));
    
    fetch(CLOUD_DB_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(db)
    }).catch(err => console.log("خطا در ارسال ابری:", err));
}

function saveRulesDB() {
    localStorage.setItem('smart_school_rules', JSON.stringify(rulesDB));
}

// دریافت آنلاین و زنده نمره‌ها از اینترنت
async function syncFromCloud() {
    try {
        const response = await fetch(CLOUD_DB_URL);
        const cloudData = await response.json();
        
        if (cloudData && Array.isArray(cloudData) && cloudData.length > 0) {
            db = cloudData;
            localStorage.setItem('smart_school_db', JSON.stringify(db));
            
            // اگر پاپ‌آپ ادمین باز نبود، صفحه رو زنده آپدیت کن
            if (!selectedStudentIdForModal) {
                renderStudents();
                fillProfile();
                renderAbsences();
            }
        }
    } catch (e) {
        console.log("دریافت آفلاین انجام شد.");
    }
}

/* ==========================================================================
   ۲. اعلانات موقت (Toast)
   ========================================================================== */
function showToast(message, type = 'success') {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? '✅' : '❌';
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'slideDown 0.4s reverse forwards';
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}

/* ==========================================================================
   ۳. ورود، ثبت‌نام و خروج
   ========================================================================== */
function switchAuth(type) {
    const tabs = document.querySelectorAll('.auth-tab');
    if (tabs.length >= 2) {
        tabs.forEach(t => t.classList.remove('active'));
        if (type === 'login') {
            tabs[0].classList.add('active');
            document.getElementById('login-form').classList.remove('hidden');
            document.getElementById('register-form').classList.add('hidden');
        } else {
            tabs[1].classList.add('active');
            document.getElementById('login-form').classList.add('hidden');
            document.getElementById('register-form').classList.remove('hidden');
        }
    }
}

function loginUser() {
    const phone = document.getElementById('login-phone').value.trim();
    const pass = document.getElementById('login-pass').value.trim();
    if (!phone || !pass) return showToast('شماره و رمز را وارد کنید!', 'error');

    const user = db.find(u => u.phone === phone && u.pass === pass);
    if (user) {
        currentUser = user; localStorage.setItem('smart_school_user', JSON.stringify(currentUser));
        showToast(`خوش آمدید ${user.name}!`, 'success'); enterApp();
    } else showToast('اطلاعات اشتباه است!', 'error');
}

function registerUser() {
    const name = document.getElementById('reg-name').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    const pass = document.getElementById('reg-pass').value.trim();
    const stdClass = document.getElementById('reg-class').value;

    if (!name || !phone || !pass || !stdClass) return showToast('تمام فیلدها را پر کنید!', 'error');
    if (db.find(u => u.phone === phone)) return showToast('این شماره قبلاً ثبت شده است!', 'error');

    const newUser = { id: Date.now(), phone: phone, pass: pass, name: name, class: stdClass, points: 0, present: true, behavior: "عالی", rank: 0, absences: [] };
    db.push(newUser); saveDB(); currentUser = newUser; localStorage.setItem('smart_school_user', JSON.stringify(currentUser));
    showToast('ثبت‌نام انجام شد!', 'success'); enterApp();
}

function logoutUser() {
    currentUser = null; isAdmin = false; localStorage.removeItem('smart_school_user');
    document.getElementById('main-app').classList.add('hidden');
    document.getElementById('auth-screen').classList.remove('hidden');
    showToast('خارج شدید', 'success');
}

function enterApp() {
    document.getElementById('auth-screen').classList.add('hidden'); document.getElementById('main-app').classList.remove('hidden');
    const badge = document.getElementById('user-name-badge');
    if (badge && currentUser) badge.innerText = `👨‍🎓 ${currentUser.name}`;
    renderStudents(); fillProfile(); renderRules(); renderAbsences();
}

function switchTab(tabId, btnElement) {
    document.querySelectorAll('.tab-page').forEach(page => { page.classList.add('hidden'); page.classList.remove('active-page'); });
    const activePage = document.getElementById(tabId);
    if (activePage) { activePage.classList.remove('hidden'); activePage.classList.add('active-page'); }

    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    if (btnElement) { btnElement.classList.add('active'); btnElement.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }); }

    if (tabId === 'tab-profile') fillProfile();
    if (tabId === 'tab-attendance') renderAbsences();
    if (tabId === 'tab-rules') renderRules();
}

document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active')); this.classList.add('active');
        currentClassFilter = this.getAttribute('data-class'); renderStudents(); renderAbsences();
    });
});

document.getElementById('search-input').addEventListener('input', function(e) { renderStudents(e.target.value.toLowerCase().trim()); });

/* ==========================================================================
   ۴. رندر لیست اصلی و پرونده
   ========================================================================== */
function renderStudents(searchQuery = '') {
    const container = document.getElementById('students-container');
    if (!container) return; container.innerHTML = '';

    let filtered = db.filter(s => {
        const matchClass = currentClassFilter === 'all' || s.class === currentClassFilter;
        return matchClass && s.name.toLowerCase().includes(searchQuery);
    });

    filtered.sort((a, b) => Number(b.points) - Number(a.points));

    if (filtered.length === 0) { container.innerHTML = '<div style="text-align:center; padding:30px; color:gray;">یافت نشد! 🔍</div>'; return; }

    filtered.forEach((student, index) => {
        let rankClass = index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : index === 2 ? 'rank-3' : '';
        const card = document.createElement('div'); card.className = `student-card`;
        card.innerHTML = `
            <div class="student-info" style="cursor:pointer;" onclick="viewStudentProfile(${student.id})">
                <div class="rank-badge ${rankClass}">${index + 1}</div>
                <div class="name-container"><h3 style="font-size:0.95rem; margin-bottom:3px;">${student.name}</h3><span style="font-size:0.75rem; color:gray;">کلاس ${student.class}</span></div>
            </div>
            <div style="text-align:left;">
                <div class="points-badge">${student.points} امتیاز</div>
                ${isAdmin ? `
                <div class="admin-controls" style="margin-top:5px; display:flex; gap:5px; justify-content:flex-end;">
                    <button style="background:#38a169; color:white; border:none; padding:4px 8px; border-radius:5px; cursor:pointer; font-weight:bold; font-size:0.75rem;" onclick="customScore(${student.id}, 'add')">➕ دلخواه</button>
                    <button style="background:#e53e3e; color:white; border:none; padding:4px 8px; border-radius:5px; cursor:pointer; font-weight:bold; font-size:0.75rem;" onclick="customScore(${student.id}, 'sub')">➖ دلخواه</button>
                </div>` : ''}
            </div>
        `;
        container.appendChild(card);
    });
}

// کسر/اضافه کردن آنلاین امتیازات با ذخیره آنی
function customScore(studentId, actionType) {
    if (!isAdmin) return showToast('فقط مدیر می‌تواند امتیاز تغییر دهد!', 'error');
    const student = db.find(s => s.id === studentId);
    if (!student) return;

    let inputStr = prompt(actionType === 'add' ? `چند امتیاز به ${student.name} اضافه شود؟` : `چند امتیاز از ${student.name} کم شود؟`);
    if (!inputStr || inputStr.trim() === "") return;

    let amount = Number(inputStr);
    if (isNaN(amount) || amount <= 0) return showToast('عدد نامعتبر!', 'error');

    let pts = Number(student.points) || 0;
    if (actionType === 'add') { student.points = pts + amount; showToast(`${amount}+ امتیاز به ${student.name} ثبت شد ✅`, 'success'); } 
    else { student.points = Math.max(0, pts - amount); showToast(`${amount}- امتیاز از ${student.name} کسر شد ❌`, 'error'); }

    saveDB(); // ارسال آنی به سرور ابری
    renderStudents(); 
    fillProfile();
}

function viewStudentProfile(studentId) {
    const student = db.find(s => s.id === studentId);
    if (student) {
        currentUser = student; fillProfile();
        const navItems = document.querySelectorAll('.nav-item');
        if (navItems.length >= 3) switchTab('tab-profile', navItems[2]);
    }
}

function fillProfile() {
    if (!currentUser) return;
    const liveUser = db.find(s => s.id === currentUser.id) || currentUser;
    currentUser = liveUser; localStorage.setItem('smart_school_user', JSON.stringify(currentUser));

    const sorted = [...db].sort((a, b) => Number(b.points) - Number(a.points));
    const myRank = sorted.findIndex(s => s.id === liveUser.id) + 1;

    const nameEl = document.getElementById('prof-name-large'); if (nameEl) nameEl.innerText = liveUser.name;
    const classBehaviorEl = document.getElementById('prof-class-behavior'); if (classBehaviorEl) classBehaviorEl.innerText = `کلاس: ${liveUser.class} | وضعیت انضباط: ${liveUser.behavior || 'عالی'}`;
    const pointsEl = document.getElementById('prof-points'); if (pointsEl) pointsEl.innerText = liveUser.points;
    
    const absenceCount = (liveUser.absences && Array.isArray(liveUser.absences)) ? liveUser.absences.length : 0;

    const allStats = document.querySelectorAll('.stat-item strong, .prof-stats strong, .stat-box strong');
    if (allStats.length >= 1) allStats[0].innerText = liveUser.points;
    if (allStats.length >= 2) allStats[1].innerText = myRank > 0 ? myRank : '-';
    if (allStats.length >= 3) allStats[2].innerText = absenceCount;
}

/* ==========================================================================
   ۵. سیستم غیبت‌ها
   ========================================================================== */
function renderAbsences() {
    const container = document.getElementById('my-absences-list');
    if (!container) return;
    container.innerHTML = '';

    let allAbsences = [];
    db.forEach(student => {
        if (student.absences && Array.isArray(student.absences) && student.absences.length > 0) {
            const matchClass = (currentClassFilter === 'all' || student.class === currentClassFilter);
            if (matchClass) {
                student.absences.forEach((date, index) => {
                    allAbsences.push({
                        studentId: student.id,
                        name: student.name,
                        class: student.class,
                        date: date,
                        absenceIndex: index
                    });
                });
            }
        }
    });

    if (allAbsences.length === 0) {
        container.innerHTML = '<div style="background:var(--bg-card); border:1px solid var(--border-color); padding:20px; border-radius:15px; text-align:center; color:var(--success-color); font-weight:bold;">هیچ غیبتی برای دانش‌آموزان ثبت نشده است. همه حاضر هستند! ✅</div>';
        return;
    }

    let html = '';
    allAbsences.forEach(item => {
        html += `
            <div style="background:var(--bg-card); padding:14px 16px; border-radius:12px; border-right:5px solid var(--danger-color); margin-bottom:10px; display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border-color); border-bottom:1px solid var(--border-color); border-left:1px solid var(--border-color); box-shadow:0 2px 5px rgba(0,0,0,0.03);">
                <div>
                    <strong style="font-size:0.95rem; color:var(--text-main); display:block; margin-bottom:4px;">${item.name} <span style="font-size:0.75rem; color:gray; font-weight:normal;">(کلاس ${item.class})</span></strong>
                    <span style="color:var(--danger-color); font-size:0.85rem; font-weight:bold;">📅 تاریخ غیبت: ${item.date}</span>
                </div>
                ${isAdmin ? `<button onclick="deleteAbsence(${item.studentId}, ${item.absenceIndex})" style="background:#fed7d7; color:#c53030; border:1px solid #fc8181; padding:6px 12px; border-radius:8px; cursor:pointer; font-size:0.75rem; font-weight:bold;">حذف غیبت 🗑️</button>` : ''}
            </div>
        `;
    });

    container.innerHTML = html;
}

function deleteAbsence(studentId, index) {
    if(!isAdmin) return;
    const student = db.find(s => s.id === studentId);
    if(student && student.absences && student.absences[index] !== undefined) {
        student.absences.splice(index, 1);
        saveDB(); renderAbsences(); renderStudents(); fillProfile();
        showToast(`غیبت ${student.name} حذف شد ✅`, 'success');
    }
}

function deleteSpecificAbsence(studentId, index) { deleteAbsence(studentId, index); }

/* ==========================================================================
   ۶. قوانین امتیازگیری
   ========================================================================== */
function renderRules() {
    const container = document.getElementById('rules-container');
    if (!container) return; container.innerHTML = '';
    if (rulesDB.length === 0) { container.innerHTML = '<p style="text-align:center; color:gray; padding:20px;">هیچ قانونی ثبت نشده است.</p>'; return; }

    rulesDB.forEach(rule => {
        const isPos = rule.amount > 0;
        const color = isPos ? 'var(--success-color)' : 'var(--danger-color)';
        const bg = isPos ? '#f0fff4' : '#fff5f5';
        const sign = isPos ? '+' : '';
        container.innerHTML += `
            <div style="background:var(--bg-card); padding:15px; border-radius:12px; border:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center; border-right:5px solid ${color};">
                <strong style="font-size:0.95rem; color:var(--text-main);">${rule.title}</strong>
                <span style="background:${bg}; color:${color}; padding:6px 12px; border-radius:10px; font-weight:900; font-size:1.1rem;" dir="ltr">${sign}${rule.amount}</span>
            </div>
        `;
    });
}

function adminManageRules() {
    if (!isAdmin) return showToast('اول وارد مدیریت شو!', 'error');
    
    document.getElementById('admin-modal-title').innerText = "🎯 مدیریت قوانین امتیازدهی";
    document.getElementById('modal-select-group').style.display = "none";
    document.getElementById('modal-submit-btn').style.display = "none";

    const extra = document.getElementById('modal-extra-fields');
    let optionsHTML = rulesDB.map((r,i) => `<option value="${i}">${r.title} (${r.amount > 0 ? '+'+r.amount : r.amount})</option>`).join('');
    
    extra.innerHTML = `
        <div style="background:#f0fff4; padding:15px; border-radius:10px; margin-bottom:15px; border:1px solid #c6f6d5;">
            <h4 style="color:#2f855a; margin-bottom:10px;">➕ افزودن قانون جدید</h4>
            <input type="text" id="new-rule-title" class="modal-field-input" placeholder="عنوان قانون (مثلاً: تاخیر)">
            <input type="number" id="new-rule-amount" class="modal-field-input" placeholder="امتیاز (مثلاً 5 یا -5)">
            <button onclick="submitNewRule()" class="btn-giant btn-success" style="padding:10px; font-size:0.9rem; margin-top:5px;">ثبت قانون</button>
        </div>
        <div style="background:#fff5f5; padding:15px; border-radius:10px; border:1px solid #fed7d7;">
            <h4 style="color:#c53030; margin-bottom:10px;">🗑️ حذف قانون</h4>
            <select id="delete-rule-select" class="modal-field-input">${optionsHTML}</select>
            <button onclick="submitDeleteRule()" class="btn-giant btn-danger" style="padding:10px; font-size:0.9rem; margin-top:5px;">حذف قانون انتخاب‌شده</button>
        </div>
    `;

    document.getElementById('custom-admin-modal').classList.remove('hidden');
}

function submitNewRule() {
    const title = document.getElementById('new-rule-title').value.trim();
    const amount = document.getElementById('new-rule-amount').value;
    if (!title || !amount) return showToast('فیلدها را پر کنید!', 'error');
    
    rulesDB.push({ id: Date.now(), title: title, amount: Number(amount) });
    saveRulesDB(); renderRules(); closeAdminModal();
    showToast('قانون جدید اضافه شد ✅', 'success');
}

function submitDeleteRule() {
    const select = document.getElementById('delete-rule-select');
    if (!select || select.value === "") return showToast('قانونی وجود ندارد!', 'error');
    
    const idx = Number(select.value);
    rulesDB.splice(idx, 1);
    saveRulesDB(); renderRules(); closeAdminModal();
    showToast('قانون حذف شد 🗑️', 'success');
}

/* ==========================================================================
   ۷. پاپ‌آپ مدیریت و ادمین
   ========================================================================== */
function unlockAdminPanel() {
    const pass = prompt("🔒 لطفاً رمز عبور مدیریت را وارد کنید:");
    if (pass === null || pass.trim() === "") return;
    if (pass.trim() === "1234") {
        isAdmin = true;
        document.getElementById('full-admin-panel').classList.remove('hidden');
        document.getElementById('admin-login-section').classList.add('hidden');
        showToast('ورود مدیر موفقیت‌آمیز بود! ⚙️', 'success'); renderStudents(); renderAbsences();
    } else showToast('رمز عبور مدیر اشتباه است!', 'error');
}

function lockAdminPanel() {
    isAdmin = false;
    document.getElementById('full-admin-panel').classList.add('hidden');
    document.getElementById('admin-login-section').classList.remove('hidden');
    showToast('از پنل مدیریت خارج شدید 🔒', 'success'); renderStudents(); renderAbsences();
}

function populateModalList(searchQuery = '') {
    const listDiv = document.getElementById('modal-student-list');
    if (!listDiv) return; listDiv.innerHTML = '';

    const sorted = [...db].sort((a, b) => a.class.localeCompare(b.class) || a.name.localeCompare(b.name));
    const filtered = sorted.filter(s => s.name.includes(searchQuery));

    if (filtered.length === 0) { listDiv.innerHTML = '<div style="padding:15px; text-align:center; color:gray;">یافت نشد!</div>'; return; }

    filtered.forEach(s => {
        const item = document.createElement('div');
        item.className = `modal-list-item ${selectedStudentIdForModal === s.id ? 'selected' : ''}`;
        item.innerHTML = `<div>${s.name}</div><div style="font-size:0.75rem; color:gray;">کلاس: ${s.class} | ${s.points} امتیاز</div>`;
        item.onclick = function() {
            selectedStudentIdForModal = s.id; populateModalList(searchQuery);
            if (document.getElementById('edit-name')) updateModalEditFields(s.id);
        };
        listDiv.appendChild(item);
    });
}

function filterModalList() { populateModalList(document.getElementById('modal-search-input').value.trim()); }

function closeAdminModal() {
    const modal = document.getElementById('custom-admin-modal');
    if (modal) modal.classList.add('hidden');
    selectedStudentIdForModal = null;
    document.getElementById('modal-submit-btn').style.display = "block";
    if(document.getElementById('modal-search-input')) document.getElementById('modal-search-input').value = '';
}

function adminSetAbsent() {
    if (!isAdmin) return showToast('اول وارد مدیریت شو!', 'error');
    selectedStudentIdForModal = null;
    document.getElementById('admin-modal-title').innerText = "📋 ثبت غیبت با تاریخ (-۵ امتیاز)";
    document.getElementById('modal-select-group').style.display = "block";
    document.getElementById('modal-submit-btn').style.display = "block";
    
    let todayStr = "۱۴۰۴/۰۸/۱۲";
    try { todayStr = new Date().toLocaleDateString('fa-IR'); } catch(e){}

    document.getElementById('modal-extra-fields').innerHTML = `
        <label style="font-size:0.85rem; font-weight:bold; display:block; margin-bottom:5px;">تاریخ غیبت را وارد کنید:</label>
        <input type="text" id="modal-absent-date" class="modal-field-input" value="${todayStr}" placeholder="مثلاً: 1404/08/12">
    `;
    populateModalList();

    const btn = document.getElementById('modal-submit-btn');
    btn.innerText = "ثبت غیبت و کسر ۵ امتیاز"; btn.className = "btn-giant"; btn.style.background = "#e53e3e"; btn.style.color = "white";
    
    btn.onclick = function() {
        if (!selectedStudentIdForModal) return showToast('لطفاً یک دانش‌آموز را انتخاب کنید!', 'error');
        
        let dateVal = document.getElementById('modal-absent-date').value.trim();
        if(!dateVal) dateVal = todayStr;

        const student = db.find(s => s.id === selectedStudentIdForModal);
        if (student) {
            if(!student.absences || !Array.isArray(student.absences)) student.absences = [];
            student.absences.push(dateVal);
            student.present = false; 
            student.points = Math.max(0, (Number(student.points) || 0) - 5);
            
            saveDB(); renderStudents(); fillProfile(); renderAbsences(); closeAdminModal();
            showToast(`غیبت برای ${student.name} ثبت شد ❌`, 'error');
        }
    };
    document.getElementById('custom-admin-modal').classList.remove('hidden');
}

function adminDeleteAbsence() {
    if (!isAdmin) return showToast('اول وارد مدیریت شو!', 'error');
    selectedStudentIdForModal = null;
    document.getElementById('admin-modal-title').innerText = "🗑️ حذف غیبت‌های ثبت‌شده";
    document.getElementById('modal-select-group').style.display = "block";
    document.getElementById('modal-submit-btn').style.display = "none";
    
    document.getElementById('modal-extra-fields').innerHTML = `
        <p style="text-align:center; color:gray; font-size:0.85rem; margin-bottom:10px;">دانش‌آموز را انتخاب کنید:</p>
        <div id="absence-list-container"></div>
    `;
    populateModalList();
    
    window.showStudentAbsences = function(studentId) {
        const student = db.find(s => s.id === studentId);
        const container = document.getElementById('absence-list-container');
        if(!container) return;
        
        if (!student || !student.absences || student.absences.length === 0) {
            container.innerHTML = `<div style="background:var(--bg-card); padding:12px; border-radius:10px; text-align:center; color:var(--success-color); font-weight:bold;">این دانش‌آموز هیچ غیبتی ندارد ✅</div>`;
            return;
        }
        
        let html = `<div style="margin-top:10px;"><strong style="display:block; margin-bottom:8px;">غیبت‌های ${student.name}:</strong>`;
        student.absences.forEach((date, index) => {
            html += `
                <div style="background:var(--bg-card); padding:10px; border-radius:10px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; border:1px solid var(--border-color);">
                    <span style="color:var(--danger-color); font-weight:bold; font-size:0.85rem;">📅 ${date}</span>
                    <button onclick="deleteAbsence(${student.id}, ${index})" style="background:#fed7d7; color:#c53030; border:none; padding:5px 10px; border-radius:6px; cursor:pointer; font-size:0.75rem; font-weight:bold;">حذف غیبت</button>
                </div>
            `;
        });
        container.innerHTML = html;
    };
    
    setTimeout(() => {
        document.querySelectorAll('.modal-list-item').forEach(item => {
            item.addEventListener('click', function() {
                if (selectedStudentIdForModal) showStudentAbsences(selectedStudentIdForModal);
            });
        });
    }, 100);
    
    document.getElementById('custom-admin-modal').classList.remove('hidden');
}

function adminChangePoints() {
    if (!isAdmin) return showToast('اول وارد مدیریت شو!', 'error');
    selectedStudentIdForModal = null;
    document.getElementById('admin-modal-title').innerText = "📝 تغییر دستی امتیاز";
    document.getElementById('modal-select-group').style.display = "block";
    document.getElementById('modal-submit-btn').style.display = "block";
    document.getElementById('modal-extra-fields').innerHTML = `<input type="number" id="modal-new-points-input" class="modal-field-input" placeholder="امتیاز جدید (مثلاً 50)...">`;
    populateModalList();

    const btn = document.getElementById('modal-submit-btn');
    btn.innerText = "ثبت امتیاز جدید"; btn.className = "btn-giant"; btn.style.background = "#3182ce"; btn.style.color = "white";
    btn.onclick = function() {
        if (!selectedStudentIdForModal) return showToast('یک دانش‌آموز را انتخاب کنید!', 'error');
        const newPts = document.getElementById('modal-new-points-input').value;
        if (newPts === "") return showToast('امتیاز را وارد کنید!', 'error');
        const student = db.find(s => s.id === selectedStudentIdForModal);
        if (student) {
            student.points = Math.max(0, Number(newPts));
            saveDB(); renderStudents(); fillProfile(); closeAdminModal();
            showToast(`امتیاز تغییر کرد ✅`, 'success');
        }
    };
    document.getElementById('custom-admin-modal').classList.remove('hidden');
}

function deleteStudent() {
    if (!isAdmin) return showToast('اول وارد مدیریت شو!', 'error');
    selectedStudentIdForModal = null;
    document.getElementById('admin-modal-title').innerText = "🗑️ حذف دانش‌آموز";
    document.getElementById('modal-select-group').style.display = "block";
    document.getElementById('modal-submit-btn').style.display = "block";
    document.getElementById('modal-extra-fields').innerHTML = '<p style="color:red; text-align:center; font-size:0.85rem;">هشدار: دانش‌آموز برای همیشه پاک خواهد شد.</p>';
    populateModalList();

    const btn = document.getElementById('modal-submit-btn');
    btn.innerText = "حذف برای همیشه"; btn.className = "btn-giant"; btn.style.background = "#e53e3e"; btn.style.color = "white";
    btn.onclick = function() {
        if (!selectedStudentIdForModal) return showToast('یک دانش‌آموز را انتخاب کنید!', 'error');
        const student = db.find(s => s.id === selectedStudentIdForModal);
        if (student && confirm(`مطمئنی می‌خوای ${student.name} رو برای همیشه حذف کنی؟`)) {
            db = db.filter(s => s.id !== selectedStudentIdForModal);
            saveDB(); renderStudents(); fillProfile(); renderAbsences(); closeAdminModal();
            showToast(`دانش‌آموز حذف شد 🗑️`, 'success');
        }
    };
    document.getElementById('custom-admin-modal').classList.remove('hidden');
}

function adminEditStudentFull() {
    if (!isAdmin) return showToast('اول وارد مدیریت شو!', 'error');
    selectedStudentIdForModal = null;
    document.getElementById('admin-modal-title').innerText = "✏️ ویرایش اطلاعات";
    document.getElementById('modal-select-group').style.display = "block";
    document.getElementById('modal-submit-btn').style.display = "block";
    document.getElementById('modal-extra-fields').innerHTML = `
        <label style="font-size:0.8rem; font-weight:bold;">نام جدید:</label>
        <input type="text" id="edit-name" class="modal-field-input" placeholder="انتخاب دانش‌آموز..." disabled>
        <label style="font-size:0.8rem; font-weight:bold;">کلاس جدید:</label>
        <input type="text" id="edit-class" class="modal-field-input" placeholder="انتخاب دانش‌آموز..." disabled>
    `;
    populateModalList();

    const btn = document.getElementById('modal-submit-btn');
    btn.innerText = "ذخیره تغییرات"; btn.className = "btn-giant"; btn.style.background = "#38a169"; btn.style.color = "white";
    btn.onclick = function() {
        if (!selectedStudentIdForModal) return showToast('یک دانش‌آموز را انتخاب کنید!', 'error');
        const student = db.find(s => s.id === selectedStudentIdForModal);
        if (student) {
            student.name = document.getElementById('edit-name').value.trim() || student.name;
            student.class = document.getElementById('edit-class').value.trim() || student.class;
            saveDB(); renderStudents(); fillProfile(); renderAbsences(); closeAdminModal();
            showToast(`اطلاعات ذخیره شد ✅`, 'success');
        }
    };
    document.getElementById('custom-admin-modal').classList.remove('hidden');
}

function updateModalEditFields(id) {
    const student = db.find(s => s.id === id);
    if (student) {
        const nameInput = document.getElementById('edit-name'); const classInput = document.getElementById('edit-class');
        if(nameInput) { nameInput.value = student.name; nameInput.disabled = false; }
        if(classInput) { classInput.value = student.class; classInput.disabled = false; }
    }
}

function addStudentFromAdmin() {
    if (!isAdmin) return showToast('اول وارد مدیریت شو!', 'error');
    document.getElementById('admin-modal-title').innerText = "➕ افزودن دانش‌آموز";
    document.getElementById('modal-select-group').style.display = "none";
    document.getElementById('modal-submit-btn').style.display = "block";

    const extra = document.getElementById('modal-extra-fields');
    extra.innerHTML = `
        <label style="font-size:0.8rem; font-weight:bold;">نام و نام خانوادگی:</label>
        <input type="text" id="add-name" class="modal-field-input" placeholder="مثلاً: علی رضایی">
        <label style="font-size:0.8rem; font-weight:bold;">کلاس:</label>
        <select id="add-class" class="modal-field-input"><option value="هفتم">هفتم</option><option value="هشتم ۱">هشتم ۱</option><option value="هشتم ۲">هشتم ۲</option><option value="نهم ۱">نهم ۱</option><option value="نهم ۲">نهم ۲</option></select>
        <label style="font-size:0.8rem; font-weight:bold;">امتیاز اولیه:</label>
        <input type="number" id="add-points" class="modal-field-input" value="0">
    `;

    const btn = document.getElementById('modal-submit-btn');
    btn.innerText = "افزودن به مدرسه"; btn.className = "btn-giant"; btn.style.background = "#38a169"; btn.style.color = "white";
    btn.onclick = function() {
        const name = document.getElementById('add-name').value.trim();
        const stdClass = document.getElementById('add-class').value;
        const pts = Number(document.getElementById('add-points').value) || 0;
        if (!name) return showToast('نام را وارد کنید!', 'error');

        db.push({ id: Date.now(), name: name, class: stdClass, points: Math.max(0, pts), present: true, behavior: "عالی", pass: "1234", phone: "09" + Math.floor(Math.random() * 100000000), absences: [] });
        saveDB(); renderStudents(); closeAdminModal(); showToast(`${name} اضافه شد! ✅`, 'success');
    };
    document.getElementById('custom-admin-modal').classList.remove('hidden');
}

function resetAllPoints() {
    if (!isAdmin) return showToast('اول وارد مدیریت شو!', 'error');
    if (confirm("آیا مطمئنی می‌خوای امتیاز همه دانش‌آموزان صفر (0) بشه؟")) {
        db.forEach(s => s.points = 0); saveDB(); renderStudents(); fillProfile(); showToast('تمام امتیازات صفر شدند! 🔄', 'success');
    }
}

function adminEditStudent() { adminEditStudentFull(); }

/* ==========================================================================
   ۸. دیتابیس ۸۶ دانش‌آموز + راه‌اندازی با همگام‌سازی آنلاین
   ========================================================================== */
const fullSchoolData = [
    { id: 701, phone: "09100000701", pass: "1234", name: "محمد اکرمی ابرقوئی", class: "هفتم", points: 950, present: true, behavior: "عالی", absences: [] },
    { id: 702, phone: "09100000702", pass: "1234", name: "محمدکیان برائی", class: "هفتم", points: 920, present: true, behavior: "خوب", absences: [] },
    { id: 703, phone: "09100000703", pass: "1234", name: "محمدطه تکتاز", class: "هفتم", points: 890, present: true, behavior: "عالی", absences: [] },
    { id: 704, phone: "09100000704", pass: "1234", name: "محمذرحیم تهمتن", class: "هفتم", points: 860, present: true, behavior: "عالی", absences: [] },
    { id: 705, phone: "09100000705", pass: "1234", name: "امیرعباس جوکار", class: "هفتم", points: 940, present: true, behavior: "عالی", absences: [] },
    { id: 706, phone: "09100000706", pass: "1234", name: "محمدطاها خانی دهنوی", class: "هفتم", points: 880, present: true, behavior: "نیاز به تلاش", absences: [] },
    { id: 707, phone: "09100000707", pass: "1234", name: "محمدمهدی خزائی", class: "هفتم", points: 910, present: true, behavior: "عالی", absences: [] },
    { id: 708, phone: "09100000708", pass: "1234", name: "علی داریوش نیا", class: "هفتم", points: 875, present: true, behavior: "خوب", absences: [] },
    { id: 709, phone: "09100000709", pass: "1234", name: "حسین دلیاسری", class: "هفتم", points: 830, present: true, behavior: "عالی", absences: [] },
    { id: 710, phone: "09100000710", pass: "1234", name: "محمدماهان دهقانی سعدی", class: "هفتم", points: 905, present: true, behavior: "عالی", absences: [] },
    { id: 711, phone: "09100000711", pass: "1234", name: "محمدطاها رحمانی", class: "هفتم", points: 960, present: true, behavior: "عالی", absences: [] },
    { id: 712, phone: "09100000712", pass: "1234", name: "علیرضا رزمخواه", class: "هفتم", points: 840, present: true, behavior: "خوب", absences: [] },
    { id: 713, phone: "09100000713", pass: "1234", name: "محمدحسن زارع", class: "هفتم", points: 895, present: true, behavior: "عالی", absences: [] },
    { id: 714, phone: "09100000714", pass: "1234", name: "میعاد شریف پور", class: "هفتم", points: 915, present: true, behavior: "عالی", absences: [] },
    { id: 715, phone: "09100000715", pass: "1234", name: "مهیار شریف پور", class: "هفتم", points: 925, present: true, behavior: "عالی", absences: [] },
    { id: 716, phone: "09100000716", pass: "1234", name: "علی شهبازی", class: "هفتم", points: 870, present: true, behavior: "عالی", absences: [] },
    { id: 717, phone: "09100000717", pass: "1234", name: "ابالفضل عباسی", class: "هفتم", points: 855, present: true, behavior: "عالی", absences: [] },
    { id: 718, phone: "09100000718", pass: "1234", name: "محمد فتحی", class: "هفتم", points: 885, present: true, behavior: "عالی", absences: [] },
    { id: 719, phone: "09100000719", pass: "1234", name: "حسین فریدونی خانیمنی", class: "هفتم", points: 935, present: true, behavior: "عالی", absences: [] },
    { id: 720, phone: "09100000720", pass: "1234", name: "کیان گورکانی", class: "هفتم", points: 900, present: true, behavior: "خوب", absences: [] },

    { id: 8101, phone: "09100008101", pass: "1234", name: "محمدسبحان اوحدی", class: "هشتم ۱", points: 980, present: true, behavior: "عالی", absences: [] },
    { id: 8102, phone: "09100008102", pass: "1234", name: "علی بانشی", class: "هشتم ۱", points: 945, present: true, behavior: "عالی", absences: [] },
    { id: 8103, phone: "09100008103", pass: "1234", name: "امیرعلی برومند", class: "هشتم ۱", points: 910, present: true, behavior: "خوب", absences: [] },
    { id: 8104, phone: "09100008104", pass: "1234", name: "ابوالفضل بهمیی", class: "هشتم ۱", points: 890, present: true, behavior: "عالی", absences: [] },
    { id: 8105, phone: "09100008105", pass: "1234", name: "علی جابری اربابی", class: "هشتم ۱", points: 865, present: true, behavior: "عالی", absences: [] },
    { id: 8106, phone: "09100008106", pass: "1234", name: "امیرحسین جهانخواه", class: "هشتم ۱", points: 930, present: true, behavior: "عالی", absences: [] },
    { id: 8107, phone: "09100008107", pass: "1234", name: "محمدرضا دشتکی پور", class: "هشتم ۱", points: 905, present: true, behavior: "عالی", absences: [] },
    { id: 8108, phone: "09100008108", pass: "1234", name: "امیرعلی ربانی", class: "هشتم ۱", points: 875, present: true, behavior: "خوب", absences: [] },
    { id: 8109, phone: "09100008109", pass: "1234", name: "محمدطاها رحیم زادگان", class: "هشتم ۱", points: 955, present: true, behavior: "عالی", absences: [] },
    { id: 8110, phone: "09100008110", pass: "1234", name: "رضا زارعی", class: "هشتم ۱", points: 845, present: true, behavior: "عالی", absences: [] },
    { id: 8111, phone: "09100008111", pass: "1234", name: "امیرمهدی زراوشان", class: "هشتم ۱", points: 915, present: true, behavior: "عالی", absences: [] },
    { id: 8112, phone: "09100008112", pass: "1234", name: "محمدطاها سلطانی", class: "هشتم ۱", points: 885, present: true, behavior: "عالی", absences: [] },
    { id: 8113, phone: "09100008113", pass: "1234", name: "محمدصالح شهریاری", class: "هشتم ۱", points: 925, present: true, behavior: "خوب", absences: [] },
    { id: 8114, phone: "09100008114", pass: "1234", name: "محمدحسن صمیمی", class: "هشتم ۱", points: 895, present: true, behavior: "عالی", absences: [] },
    { id: 8115, phone: "09100008115", pass: "1234", name: "احمدعلی طالع زاده", class: "هشتم ۱", points: 860, present: true, behavior: "عالی", absences: [] },
    { id: 8116, phone: "09100008116", pass: "1234", name: "محمدرضا قربانی باوریانی", class: "هشتم ۱", points: 935, present: true, behavior: "عالی", absences: [] },
    { id: 8117, phone: "09100008117", pass: "1234", name: "ایلیا کاظمی احمدآبادی", class: "هشتم ۱", points: 965, present: true, behavior: "عالی", absences: [] },
    { id: 8118, phone: "09100008118", pass: "1234", name: "علی کشاورز", class: "هشتم ۱", points: 880, present: true, behavior: "عالی", absences: [] },
    { id: 8119, phone: "09100008119", pass: "1234", name: "حسین محمدی", class: "هشتم ۱", points: 900, present: true, behavior: "عالی", absences: [] },
    { id: 8120, phone: "09100008120", pass: "1234", name: "محمدحسین مشکین فام فرد", class: "هشتم ۱", points: 870, present: true, behavior: "خوب", absences: [] },
    { id: 8121, phone: "09100008121", pass: "1234", name: "سیدمحمدباقر نبوی زاده", class: "هشتم ۱", points: 910, present: true, behavior: "عالی", absences: [] },

    { id: 8201, phone: "09100008201", pass: "1234", name: "متین احمدی چنارفاریابی", class: "هشتم ۲", points: 950, present: true, behavior: "عالی", absences: [] },
    { id: 8202, phone: "09100008202", pass: "1234", name: "محمدطاها اهرمی", class: "هشتم ۲", points: 920, present: true, behavior: "خوب", absences: [] },
    { id: 8203, phone: "09100008203", pass: "1234", name: "امیرمحمد جعفری", class: "هشتم ۲", points: 880, present: true, behavior: "عالی", absences: [] },
    { id: 8204, phone: "09100008204", pass: "1234", name: "محمدطاها جمالی آزاد", class: "هشتم ۲", points: 865, present: true, behavior: "عالی", absences: [] },
    { id: 8205, phone: "09100008205", pass: "1234", name: "امیررضا جوکارکمال آبادی", class: "هشتم ۲", points: 915, present: true, behavior: "عالی", absences: [] },
    { id: 8206, phone: "09100008206", pass: "1234", name: "محمدسبحان حاصلی", class: "هشتم ۲", points: 895, present: true, behavior: "عالی", absences: [] },
    { id: 8207, phone: "09100008207", pass: "1234", name: "علی حسین پور", class: "هشتم ۲", points: 935, present: true, behavior: "عالی", absences: [] },
    { id: 8208, phone: "09100008208", pass: "1234", name: "محمد حمزه نژاد", class: "هشتم ۲", points: 875, present: true, behavior: "خوب", absences: [] },
    { id: 8209, phone: "09100008209", pass: "1234", name: "حسین دادگر", class: "هشتم ۲", points: 905, present: true, behavior: "عالی", absences: [] },
    { id: 8210, phone: "09100008210", pass: "1234", name: "متین ریحانی", class: "هشتم ۲", points: 960, present: true, behavior: "عالی", absences: [] },
    { id: 8211, phone: "09100008211", pass: "1234", name: "امیرعلی زارع", class: "هشتم ۲", points: 885, present: true, behavior: "عالی", absences: [] },
    { id: 8212, phone: "09100008212", pass: "1234", name: "احمدرضا زارع کدنچی", class: "هشتم ۲", points: 925, present: true, behavior: "عالی", absences: [] },
    { id: 8213, phone: "09100008213", pass: "1234", name: "محمدطاها شکاری", class: "هشتم ۲", points: 855, present: true, behavior: "عالی", absences: [] },
    { id: 8214, phone: "09100008214", pass: "1234", name: "محمدمهدی شهبازی", class: "هشتم ۲", points: 890, present: true, behavior: "عالی", absences: [] },
    { id: 8215, phone: "09100008215", pass: "1234", name: "محمدسپهر شیردل", class: "هشتم ۲", points: 910, present: true, behavior: "خوب", absences: [] },
    { id: 8216, phone: "09100008216", pass: "1234", name: "امیرمحمد فردفتح آبادی", class: "هشتم ۲", points: 940, present: true, behavior: "عالی", absences: [] },
    { id: 8217, phone: "09100008217", pass: "1234", name: "محمدپارسا مروت", class: "هشتم ۲", points: 870, present: true, behavior: "عالی", absences: [] },
    { id: 8218, phone: "09100008218", pass: "1234", name: "محمدامین مصلی نژاد", class: "هشتم ۲", points: 930, present: true, behavior: "عالی", absences: [] },

    { id: 9101, phone: "09100009101", pass: "1234", name: "محمدجواد اشراق پور", class: "نهم ۱", points: 990, present: true, behavior: "عالی", absences: [] },
    { id: 9102, phone: "09100009102", pass: "1234", name: "محمدپارسا جعفری", class: "نهم ۱", points: 920, present: true, behavior: "عالی", absences: [] },
    { id: 9103, phone: "09100009103", pass: "1234", name: "طاها حسینقلی", class: "نهم ۱", points: 885, present: true, behavior: "عالی", absences: [] },
    { id: 9104, phone: "09100009104", pass: "1234", name: "محمدمهدی دادگر", class: "نهم ۱", points: 945, present: true, behavior: "عالی", absences: [] },
    { id: 9105, phone: "09100009105", pass: "1234", name: "ایلیا ذوالعدل", class: "نهم ۱", points: 910, present: true, behavior: "خوب", absences: [] },
    { id: 9106, phone: "09100009106", pass: "1234", name: "عرشیا ذوالعدل", class: "نهم ۱", points: 875, present: true, behavior: "عالی", absences: [] },
    { id: 9107, phone: "09100009107", pass: "1234", name: "شایان سیمکانی", class: "نهم ۱", points: 960, present: true, behavior: "عالی", absences: [] },
    { id: 9108, phone: "09100009108", pass: "1234", name: "عرفان محسنی حقیقی", class: "نهم ۱", points: 935, present: true, behavior: "عالی", absences: [] },
    { id: 9109, phone: "09100009109", pass: "1234", name: "علی نام آور", class: "نهم ۱", points: 895, present: true, behavior: "عالی", absences: [] },
    { id: 9110, phone: "09100009110", pass: "1234", name: "محمدعلی هادی زاده", class: "نهم ۱", points: 915, present: true, behavior: "عالی", absences: [] },
    { id: 9111, phone: "09100009111", pass: "1234", name: "محمدسبحان یعقوب زاده", class: "نهم ۱", points: 955, present: true, behavior: "عالی", absences: [] },

    { id: 9201, phone: "09100009201", pass: "1234", name: "محمدمهدی اکبری باصری", class: "نهم ۲", points: 975, present: true, behavior: "عالی", absences: [] },
    { id: 9202, phone: "09100009202", pass: "1234", name: "محمدطاها امیری", class: "نهم ۲", points: 890, present: true, behavior: "خوب", absences: [] },
    { id: 9203, phone: "09100009203", pass: "1234", name: "امیرمحمد پوربشیری", class: "نهم ۲", points: 860, present: true, behavior: "عالی", absences: [] },
    { id: 9204, phone: "09100009204", pass: "1234", name: "بنیامین ترابی", class: "نهم ۲", points: 940, present: true, behavior: "عالی", absences: [] },
    { id: 9205, phone: "09100009205", pass: "1234", name: "پرهام توفیقی", class: "نهم ۲", points: 915, present: true, behavior: "عالی", absences: [] },
    { id: 9206, phone: "09100009206", pass: "1234", name: "محمدعرفان ثابت", class: "نهم ۲", points: 885, present: true, behavior: "عالی", absences: [] },
    { id: 9207, phone: "09100009207", pass: "1234", name: "سیدمهدی حسینی", class: "نهم ۲", points: 930, present: true, behavior: "عالی", absences: [] },
    { id: 9208, phone: "09100009208", pass: "1234", name: "امیرمهدی زارعی", class: "نهم ۲", points: 905, present: true, behavior: "خوب", absences: [] },
    { id: 9209, phone: "09100009209", pass: "1234", name: "مجتبی شکیبا", class: "نهم ۲", points: 950, present: true, behavior: "عالی", absences: [] },
    { id: 9210, phone: "09100009210", pass: "1234", name: "رضا کاوسی", class: "نهم ۲", points: 875, present: true, behavior: "عالی", absences: [] },
    { id: 9211, phone: "09100009211", pass: "1234", name: "حمیدرضا لامع", class: "نهم ۲", points: 925, present: true, behavior: "عالی", absences: [] },
    { id: 9212, phone: "09100009212", pass: "1234", name: "محمدحسین محبی", class: "نهم ۲", points: 895, present: true, behavior: "عالی", absences: [] },
    { id: 9213, phone: "09100009213", pass: "1234", name: "سیدامیرعلی نبوی زاده", class: "نهم ۲", points: 965, present: true, behavior: "عالی", absences: [] },
    { id: 9214, phone: "09100009214", pass: "1234", name: "مهیار نیکونام نظامی", class: "نهم ۲", points: 910, present: true, behavior: "خوب", absences: [] },
    { id: 9215, phone: "09100009215", pass: "1234", name: "امیرحسین واقعی", class: "نهم ۲", points: 855, present: true, behavior: "عالی", absences: [] },
    { id: 9216, phone: "09100009216", pass: "1234", name: "محمدطه هلالی", class: "نهم ۲", points: 935, present: true, behavior: "عالی", absences: [] }
];

if (!localStorage.getItem('smart_school_db_loaded_massive')) {
    db = fullSchoolData;
    localStorage.setItem('smart_school_db', JSON.stringify(db));
    localStorage.setItem('smart_school_db_loaded_massive', 'true');
}

function removeDuplicateStudents() {
    if (!db || !Array.isArray(db)) return;
    const uniqueStudents = [];
    const seenNames = new Set();
    
    for (let i = db.length - 1; i >= 0; i--) {
        const student = db[i];
        if (student && student.name) {
            const cleanName = student.name.trim();
            if (!seenNames.has(cleanName)) {
                seenNames.add(cleanName);
                if (!student.absences || !Array.isArray(student.absences)) {
                    student.absences = [];
                }
                uniqueStudents.unshift(student);
            }
        }
    }
    db = uniqueStudents;
    saveDB();
}

function toggleTheme() {
    const toggle = document.getElementById('theme-toggle');
    if (!toggle) return;
    if (toggle.checked) {
        document.body.classList.add('dark-mode');
        localStorage.setItem('theme', 'dark');
    } else {
        document.body.classList.remove('dark-mode');
        localStorage.setItem('theme', 'light');
    }
}

// چک کردن دیتابیس ابری زنده
window.addEventListener('DOMContentLoaded', () => {
    removeDuplicateStudents();
    syncFromCloud(); // خواندن زنده از اینترنت
    
    // هماهنگی زنده هر ۳ ثانیه یکبار (Auto Live-Sync)
    setInterval(syncFromCloud, 3000);
    
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
        const toggle = document.getElementById('theme-toggle');
        if (toggle) toggle.checked = true;
    }
    
    if (currentUser) {
        enterApp();
    } else {
        const authScreen = document.getElementById('auth-screen');
        const mainApp = document.getElementById('main-app');
        if (authScreen) authScreen.classList.remove('hidden');
        if (mainApp) mainApp.classList.add('hidden');
    }
});
