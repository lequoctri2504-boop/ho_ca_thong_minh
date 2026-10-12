// --- CẤU HÌNH KẾT NỐI SERVER THÔNG MINH ---
// Tự động nhận diện IP máy chủ (Dù truy cập qua file://, localhost hay IP mạng LAN từ điện thoại)
let API_BASE_URL = 'http://localhost:8000';
if (window.location.protocol.startsWith('http')) {
    if (window.location.port === '8000') {
        API_BASE_URL = window.location.origin;
    } else if (window.location.hostname) {
        API_BASE_URL = `${window.location.protocol}//${window.location.hostname}:8000`;
    }
}

console.log("🔗 Admin API Base URL:", API_BASE_URL);

// ---- ĐIỀU HƯỚNG DRAWER TRÊN MOBILE ----
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const sidebarCloseBtn = document.getElementById('sidebar-close-btn');
const sidebarBackdrop = document.getElementById('sidebar-backdrop');
const mainSidebar = document.getElementById('main-sidebar');

function openSidebar() {
    if (mainSidebar) mainSidebar.classList.add('mobile-open');
    if (sidebarBackdrop) sidebarBackdrop.classList.add('active');
}
function closeSidebar() {
    if (mainSidebar) mainSidebar.classList.remove('mobile-open');
    if (sidebarBackdrop) sidebarBackdrop.classList.remove('active');
}

if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', openSidebar);
if (sidebarCloseBtn) sidebarCloseBtn.addEventListener('click', closeSidebar);
if (sidebarBackdrop) sidebarBackdrop.addEventListener('click', closeSidebar);

// ---- LOGIC CHUYỂN TAB (SPA) ----
const navBtns = document.querySelectorAll('.nav-btn');
const tabPanes = document.querySelectorAll('.tab-pane');

navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-tab');
        if (!targetId) return;

        navBtns.forEach(b => b.classList.remove('active'));
        tabPanes.forEach(t => t.classList.remove('active'));
        
        btn.classList.add('active');
        const targetSection = document.getElementById(targetId);
        if (targetSection) targetSection.classList.add('active');
        
        // Đóng menu nếu đang mở trên mobile
        closeSidebar();

        // Tự động tải dữ liệu cho từng tab tương ứng
        if (targetId === 'tab-fish-db') loadFishDB();
        else if (targetId === 'tab-esp32') loadEsp32Status();
        else if (targetId === 'tab-ai-history') loadAiHistory();
        else if (targetId === 'tab-system-health') loadSystemHealth();
        else if (targetId === 'tab-user-requests') loadUserRequests();
    });
});

// ========================================================
// TAB 1: QUẢN LÝ TỪ ĐIỂN CÁ (CRUD & TÌM KIẾM BỘ LỌC)
// ========================================================
let allFishes = [];
let editFishId = null;

const fishSearchInput = document.getElementById('fish-search-input');
const fishFilterBehavior = document.getElementById('fish-filter-behavior');
const fishFilterLayer = document.getElementById('fish-filter-layer');
const fishCountBadge = document.getElementById('fish-count-badge');

if (fishSearchInput) fishSearchInput.addEventListener('input', filterAndRenderFishes);
if (fishFilterBehavior) fishFilterBehavior.addEventListener('change', filterAndRenderFishes);
if (fishFilterLayer) fishFilterLayer.addEventListener('change', filterAndRenderFishes);

async function loadFishDB() {
    const tbody = document.getElementById('admin-fish-tbody');
    try {
        const res = await fetch(API_BASE_URL + '/api/admin/loai_ca');
        if (!res.ok) throw new Error("Mã lỗi: " + res.status);
        const fishList = await res.json();
        allFishes = fishList;
        filterAndRenderFishes();
    } catch (err) {
        console.error("Lỗi tải từ điển cá:", err);
        tbody.innerHTML = `<tr><td colspan="8" class="text-center text-red" style="padding: 25px;">Lỗi kết nối máy chủ: ${err.message}</td></tr>`;
        if (fishCountBadge) fishCountBadge.textContent = "Lỗi kết nối";
    }
}

function filterAndRenderFishes() {
    const tbody = document.getElementById('admin-fish-tbody');
    const keyword = fishSearchInput ? fishSearchInput.value.toLowerCase().trim() : '';
    const behavior = fishFilterBehavior ? fishFilterBehavior.value : '';
    const layer = fishFilterLayer ? fishFilterLayer.value : '';

    const filtered = allFishes.filter(f => {
        const matchKeyword = !keyword || 
            (f.ten_hien_thi && f.ten_hien_thi.toLowerCase().includes(keyword)) ||
            (f.ma_loai && f.ma_loai.toLowerCase().includes(keyword)) ||
            (f.ten_tieng_anh && f.ten_tieng_anh.toLowerCase().includes(keyword)) ||
            (f.ten_khoa_hoc && f.ten_khoa_hoc.toLowerCase().includes(keyword));

        const matchBehavior = !behavior || f.tinh_cach === behavior;
        const matchLayer = !layer || (f.tang_boi && f.tang_boi.includes(layer));

        return matchKeyword && matchBehavior && matchLayer;
    });

    if (fishCountBadge) {
        fishCountBadge.textContent = `Đang hiển thị ${filtered.length}/${allFishes.length} loài cá`;
    }

    tbody.innerHTML = '';
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center" style="padding: 30px; color: #94a3b8;">Không tìm thấy loài cá nào phù hợp với bộ lọc.</td></tr>';
        return;
    }

    filtered.forEach(fish => {
        let colorClass = 'text-green';
        if (fish.tinh_cach === 'Hung dữ') colorClass = 'text-red';
        else if (fish.tinh_cach === 'Rỉa vây') colorClass = 'text-yellow';

        // Nguồn trích dẫn format
        let nguonHtml = '<span style="color: #64748b;">--</span>';
        if (fish.nguon_trich_dan && fish.nguon_trich_dan !== 'Chưa rõ') {
            if (fish.nguon_trich_dan.startsWith('http')) {
                nguonHtml = `<a href="${fish.nguon_trich_dan}" target="_blank" style="color: #38bdf8; text-decoration: none;" title="${fish.nguon_trich_dan}"><i class="fa-solid fa-arrow-up-right-from-square"></i> Xem link</a>`;
            } else {
                nguonHtml = `<small style="color: #94a3b8;" title="${fish.nguon_trich_dan}">${fish.nguon_trich_dan}</small>`;
            }
        }

        tbody.innerHTML += `
            <tr>
                <td><strong>${fish.id}</strong></td>
                <td>
                    <strong style="color: #f8fafc; font-size: 15px;">${fish.ten_hien_thi}</strong>
                    <br><small style="color: #94a3b8">${fish.ten_tieng_anh ? fish.ten_tieng_anh + ' | ' : ''}<em>${fish.ten_khoa_hoc || ''}</em></small>
                    <br><code style="font-size: 11px; color: #38bdf8; background: rgba(56, 189, 248, 0.1); padding: 1px 6px; border-radius: 4px;">${fish.ma_loai}</code>
                </td>
                <td>
                    <span class="text-orange" style="font-weight: 600;"><i class="fa-solid fa-temperature-half"></i> ${fish.nhiet_do_min} - ${fish.nhiet_do_max} °C</span>
                    <br><span class="text-blue" style="font-weight: 600;"><i class="fa-solid fa-droplet"></i> pH ${fish.ph_min} - ${fish.ph_max}</span>
                </td>
                <td>
                    <span style="background: rgba(14, 165, 233, 0.2); border: 1px solid #0ea5e9; color: #38bdf8; padding: 2px 7px; border-radius: 10px; font-size: 11px; font-weight: 600;">Tầng ${fish.tang_boi || 'Giữa'}</span>
                    <br><span style="background: rgba(168, 85, 247, 0.2); border: 1px solid #a855f7; color: #c084fc; padding: 1px 7px; border-radius: 10px; font-size: 11px; margin-top: 3px; display: inline-block;">Vây ${fish.kieu_vay || 'Ngắn'}</span>
                </td>
                <td>
                    <strong>📏 ${fish.kich_thuoc_adult || 5} cm</strong> | 💧 ${fish.the_tich_yeu_cau || 5}L
                    <br><small style="color: #94a3b8;">Bầy đàn ≥ ${fish.so_luong_bay_min || 1} con | Bioload: ${fish.he_so_bioload || 1.0}</small>
                </td>
                <td><span class="${colorClass}" style="font-weight: 600;">${fish.tinh_cach}</span></td>
                <td>${nguonHtml}</td>
                <td>
                    <button class="btn-edit" data-id="${fish.id}" style="background:none; border:none; color:#38bdf8; cursor:pointer; margin-right: 12px; font-size: 15px;" title="Chỉnh sửa chi tiết"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button class="btn-delete" data-id="${fish.id}" style="background:none; border:none; color:#f87171; cursor:pointer; font-size: 15px;" title="Xóa loài cá"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `;
    });

    // Gắn sự kiện Xóa
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const targetFish = allFishes.find(f => f.id == id);
            const fishName = targetFish ? targetFish.ten_hien_thi : `ID ${id}`;
            if (confirm(`Bạn có chắc chắn muốn xóa loài cá "${fishName}" khỏi cơ sở dữ liệu?`)) {
                try {
                    const delRes = await fetch(`${API_BASE_URL}/api/admin/loai_ca/${id}`, { method: 'DELETE' });
                    const resData = await delRes.json();
                    alert(resData.message || "Đã xóa thành công!");
                    loadFishDB();
                } catch (err) {
                    alert("Lỗi khi xóa: " + err.message);
                }
            }
        });
    });

    // Gắn sự kiện Sửa
    document.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.currentTarget.getAttribute('data-id'));
            const fish = allFishes.find(f => f.id === id);
            if (fish) moFormSuaCa(fish);
        });
    });
}

const btnRefreshFish = document.getElementById('btn-refresh-fish');
if (btnRefreshFish) btnRefreshFish.addEventListener('click', loadFishDB);

// Modal Thêm/Sửa cá
const modal = document.getElementById('fish-modal');
const btnOpenModal = document.getElementById('btn-open-add-modal');
const btnCloseModal = document.querySelector('.close-modal');
const btnCancel = document.getElementById('btn-cancel');
const modalTitle = document.getElementById('modal-title');

if (btnOpenModal) {
    btnOpenModal.addEventListener('click', () => {
        editFishId = null;
        document.getElementById('fish-form').reset();
        document.getElementById('frm-ma-loai').disabled = false;
        document.getElementById('frm-kich-thuoc').value = 5.0;
        document.getElementById('frm-the-tich').value = 5.0;
        document.getElementById('frm-he-so-bioload').value = 1.0;
        document.getElementById('frm-bay-min').value = 1;
        document.getElementById('frm-tang-boi').value = "Giữa";
        document.getElementById('frm-kieu-vay').value = "Ngắn";
        document.getElementById('frm-tinh-cach').value = "Hòa bình";
        modalTitle.textContent = "Thêm Loài Cá Mới vào Database";
        modal.style.display = 'block';
    });
}
if (btnCloseModal) btnCloseModal.addEventListener('click', () => modal.style.display = 'none');
if (btnCancel) btnCancel.addEventListener('click', () => modal.style.display = 'none');
window.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

function moFormSuaCa(fish) {
    editFishId = fish.id;
    document.getElementById('frm-ma-loai').value = fish.ma_loai;
    document.getElementById('frm-ma-loai').disabled = true;
    document.getElementById('frm-ten-hien-thi').value = fish.ten_hien_thi;
    document.getElementById('frm-ten-tieng-anh').value = fish.ten_tieng_anh || '';
    document.getElementById('frm-ten-khoa-hoc').value = fish.ten_khoa_hoc || '';
    document.getElementById('frm-nhiet-min').value = fish.nhiet_do_min;
    document.getElementById('frm-nhiet-max').value = fish.nhiet_do_max;
    document.getElementById('frm-ph-min').value = fish.ph_min;
    document.getElementById('frm-ph-max').value = fish.ph_max;
    document.getElementById('frm-kich-thuoc').value = fish.kich_thuoc_adult || 5.0;
    document.getElementById('frm-the-tich').value = fish.the_tich_yeu_cau || 5.0;
    document.getElementById('frm-he-so-bioload').value = fish.he_so_bioload || 1.0;
    document.getElementById('frm-bay-min').value = fish.so_luong_bay_min || 1;
    document.getElementById('frm-tang-boi').value = fish.tang_boi || "Giữa";
    document.getElementById('frm-kieu-vay').value = fish.kieu_vay || "Ngắn";
    document.getElementById('frm-tinh-cach').value = fish.tinh_cach || "Hòa bình";
    document.getElementById('frm-nguon').value = fish.nguon_trich_dan || '';
    document.getElementById('frm-mo-ta').value = fish.mo_ta || '';
    
    modalTitle.textContent = `Cập nhật Toàn diện Loài Cá: ${fish.ten_hien_thi} (ID: ${fish.id})`;
    modal.style.display = 'block';
}

document.getElementById('fish-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const reqData = {
        ma_loai: document.getElementById('frm-ma-loai').value.trim(),
        ten_hien_thi: document.getElementById('frm-ten-hien-thi').value.trim(),
        ten_tieng_anh: document.getElementById('frm-ten-tieng-anh').value.trim(),
        ten_khoa_hoc: document.getElementById('frm-ten-khoa-hoc').value.trim(),
        nhiet_do_min: parseFloat(document.getElementById('frm-nhiet-min').value),
        nhiet_do_max: parseFloat(document.getElementById('frm-nhiet-max').value),
        ph_min: parseFloat(document.getElementById('frm-ph-min').value),
        ph_max: parseFloat(document.getElementById('frm-ph-max').value),
        kich_thuoc_adult: parseFloat(document.getElementById('frm-kich-thuoc').value) || 5.0,
        the_tich_yeu_cau: parseFloat(document.getElementById('frm-the-tich').value) || 5.0,
        he_so_bioload: parseFloat(document.getElementById('frm-he-so-bioload').value) || 1.0,
        so_luong_bay_min: parseInt(document.getElementById('frm-bay-min').value) || 1,
        tang_boi: document.getElementById('frm-tang-boi').value,
        kieu_vay: document.getElementById('frm-kieu-vay').value,
        tinh_cach: document.getElementById('frm-tinh-cach').value,
        nguon_trich_dan: document.getElementById('frm-nguon').value.trim(),
        mo_ta: document.getElementById('frm-mo-ta').value.trim()
    };
    
    const url = editFishId ? `${API_BASE_URL}/api/admin/loai_ca/${editFishId}` : `${API_BASE_URL}/api/admin/loai_ca`;
    const method = editFishId ? 'PUT' : 'POST';
    
    try {
        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reqData)
        });
        
        const data = await res.json();
        if (data.error) {
            alert("Lỗi: " + data.error);
        } else {
            alert(data.message || (editFishId ? "Đã cập nhật thành công!" : "Đã thêm loài cá mới thành công!"));
            modal.style.display = 'none';
            loadFishDB();
        }
    } catch (err) {
        alert("Không thể kết nối đến máy chủ: " + err.message);
    }
});

// ========================================================
// TAB 2: QUẢN LÝ ESP32 & NẠP OTA KHÔNG DÂY
// ========================================================
let currentEspIp = "";
let selectedOtaFile = null;

async function loadEsp32Status() {
    const badge = document.getElementById('esp-status-badge');
    const mobileBadge = document.getElementById('mobile-esp-badge');
    const displayIp = document.getElementById('esp-display-ip');
    const displayLastSeen = document.getElementById('esp-display-last-seen');
    const targetIpInput = document.getElementById('target-esp-ip');
    const otaLink = document.getElementById('btn-open-ota-page');

    try {
        const res = await fetch(API_BASE_URL + '/api/admin/esp32_status');
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data = await res.json();

        currentEspIp = data.ip && data.ip !== "Chưa kết nối" ? data.ip : "";
        displayIp.textContent = data.ip || "Chưa phát hiện";
        displayLastSeen.textContent = data.last_seen || "--";

        if (data.online) {
            badge.innerHTML = '<span class="pulse-dot"></span> <span class="text-green">HOẠT ĐỘNG (Online)</span>';
            if (mobileBadge) mobileBadge.innerHTML = '<span class="pulse-dot"></span> ESP32';
        } else {
            badge.innerHTML = '<span class="pulse-dot offline"></span> <span class="text-red">NGOẠI TUYẾN (Offline)</span>';
            if (mobileBadge) mobileBadge.innerHTML = '<span class="pulse-dot offline"></span> ESP32';
        }

        if (currentEspIp) {
            if (!targetIpInput.value) targetIpInput.value = currentEspIp;
            otaLink.href = `http://${currentEspIp}/update`;
            otaLink.style.display = 'inline-flex';
        } else {
            otaLink.style.display = 'none';
        }
    } catch (err) {
        console.error("Lỗi lấy trạng thái ESP32:", err);
        if (badge) badge.innerHTML = '<span class="pulse-dot offline"></span> Lỗi API';
    }
}

const btnRefreshEspStatus = document.getElementById('btn-refresh-esp-status');
if (btnRefreshEspStatus) btnRefreshEspStatus.addEventListener('click', loadEsp32Status);

// Nút Khởi động lại ESP32
const btnRestartEsp = document.getElementById('btn-restart-esp');
if (btnRestartEsp) {
    btnRestartEsp.addEventListener('click', async () => {
        if (!confirm("Bạn có chắc chắn muốn gửi lệnh khởi động lại (Reboot) tới mạch ESP32 qua mạng MQTT?")) return;
        btnRestartEsp.disabled = true;
        btnRestartEsp.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang gửi lệnh...';
        try {
            const res = await fetch(API_BASE_URL + '/api/admin/restart_esp32', { method: 'POST' });
            const data = await res.json();
            alert(data.message || data.error || "Đã gửi lệnh!");
            logOtaMessage("🔄 Đã gửi lệnh khởi động lại ESP32 (ESP_RESTART). Đang đợi kết nối lại...");
            setTimeout(loadEsp32Status, 4000);
        } catch (err) {
            alert("Lỗi: " + err.message);
        } finally {
            btnRestartEsp.disabled = false;
            btnRestartEsp.innerHTML = '<i class="fa-solid fa-power-off"></i> Khởi động lại ESP32 (MQTT)';
        }
    });
}

// Xử lý kéo thả và chọn file OTA .bin
const otaDropzone = document.getElementById('ota-dropzone');
const otaFileInput = document.getElementById('ota-file-input');
const otaFileName = document.getElementById('ota-file-name');
const btnStartOta = document.getElementById('btn-start-ota');
const otaLogConsole = document.getElementById('ota-log-console');
const otaProgressContainer = document.getElementById('ota-progress-container');
const otaProgressBar = document.getElementById('ota-progress-bar');
const otaProgressText = document.getElementById('ota-progress-text');

function logOtaMessage(msg) {
    const time = new Date().toLocaleTimeString();
    otaLogConsole.textContent += `\n[${time}] ${msg}`;
    otaLogConsole.scrollTop = otaLogConsole.scrollHeight;
}

if (otaDropzone && otaFileInput) {
    otaDropzone.addEventListener('click', () => otaFileInput.click());
    
    ['dragenter', 'dragover'].forEach(eventName => {
        otaDropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            otaDropzone.classList.add('dragover');
        }, false);
    });
    ['dragleave', 'drop'].forEach(eventName => {
        otaDropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            otaDropzone.classList.remove('dragover');
        }, false);
    });

    otaDropzone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        if (dt.files && dt.files.length > 0) {
            handleFileSelect(dt.files[0]);
        }
    });

    otaFileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFileSelect(e.target.files[0]);
        }
    });
}

function handleFileSelect(file) {
    if (!file.name.endsWith('.bin')) {
        alert("Vui lòng chọn file có định dạng .bin (được xuất từ Arduino IDE)");
        return;
    }
    selectedOtaFile = file;
    const sizeKb = (file.size / 1024).toFixed(1);
    otaFileName.innerHTML = `<span style="color: #38bdf8;"><i class="fa-solid fa-file-arrow-up"></i> ${file.name}</span> (${sizeKb} KB)`;
    btnStartOta.disabled = false;
    logOtaMessage(`📁 Đã nạp file chuẩn bị: ${file.name} (${sizeKb} KB)`);
}

// Bắt đầu Nạp Firmware OTA
if (btnStartOta) {
    btnStartOta.addEventListener('click', () => {
        if (!selectedOtaFile) {
            alert("Vui lòng chọn file .bin trước khi nạp!");
            return;
        }
        const targetIp = document.getElementById('target-esp-ip').value.trim();
        if (!targetIp) {
            alert("Vui lòng nhập địa chỉ IP của ESP32!");
            return;
        }

        if (!confirm(`Xác nhận nạp file "${selectedOtaFile.name}" tới ESP32 tại địa chỉ IP http://${targetIp}/update?\nQuá trình này mất khoảng 15-30 giây qua WiFi.`)) {
            return;
        }

        btnStartOta.disabled = true;
        btnStartOta.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang nạp Firmware...';
        otaProgressContainer.style.display = 'block';
        otaProgressBar.style.width = '0%';
        otaProgressText.textContent = '0%';

        logOtaMessage(`🚀 Bắt đầu quá trình nạp OTA tới ${targetIp}...`);

        const formData = new FormData();
        formData.append('file', selectedOtaFile);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${API_BASE_URL}/api/admin/ota_upload?esp_ip=${encodeURIComponent(targetIp)}`, true);

        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                otaProgressBar.style.width = percent + '%';
                otaProgressText.textContent = percent + '%';
                if (percent === 100) {
                    logOtaMessage("📦 File đã tải lên Server, Server đang truyền thẳng vào Flash ESP32...");
                }
            }
        };

        xhr.onload = () => {
            btnStartOta.disabled = false;
            btnStartOta.innerHTML = '<i class="fa-solid fa-bolt"></i> Bắt đầu Nạp Firmware OTA';
            
            try {
                const resp = JSON.parse(xhr.responseText);
                if (xhr.status === 200) {
                    otaProgressBar.style.width = '100%';
                    otaProgressText.textContent = '100% Hoàn tất!';
                    logOtaMessage("🎉 THÀNH CÔNG: " + (resp.message || "Đã nạp xong!"));
                    logOtaMessage("⏳ ESP32 đang tự động khởi động lại vào phiên bản Firmware mới...");
                    alert("Nạp Firmware OTA Thành công! ESP32 đang khởi động lại.");
                    setTimeout(loadEsp32Status, 6000);
                } else {
                    logOtaMessage("❌ LỖI NẠP OTA: " + (resp.error || xhr.statusText));
                    alert("Lỗi nạp OTA: " + (resp.error || xhr.statusText));
                }
            } catch (err) {
                logOtaMessage("❌ Lỗi phản hồi từ máy chủ: " + xhr.responseText);
            }
        };

        xhr.onerror = () => {
            btnStartOta.disabled = false;
            btnStartOta.innerHTML = '<i class="fa-solid fa-bolt"></i> Bắt đầu Nạp Firmware OTA';
            logOtaMessage("❌ Lỗi mạng hoặc không thể kết nối tới Server.");
            alert("Lỗi kết nối khi nạp Firmware.");
        };

        xhr.send(formData);
    });
}

// ========================================================
// TAB 3: MLOps & LỊCH SỬ AI
// ========================================================
async function loadAiHistory() {
    const tbody = document.getElementById('admin-ai-tbody');
    try {
        const res = await fetch(API_BASE_URL + '/api/admin/lich_su_ai');
        if (!res.ok) throw new Error("HTTP " + res.status);
        const list = await res.json();
        
        tbody.innerHTML = '';
        if (list.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="padding: 20px;">Chưa có lượt chụp ảnh nhận diện nào được lưu.</td></tr>';
            return;
        }

        list.forEach(item => {
            const imgSrc = item.url_anh ? `${API_BASE_URL}${item.url_anh}` : 'https://via.placeholder.com/60';
            const doChinhXac = item.do_chinh_xac ? (item.do_chinh_xac * 100).toFixed(1) + '%' : '--';
            const anToanBadge = item.phu_hop_khong 
                ? '<span class="text-green" style="font-weight: 600;"><i class="fa-solid fa-circle-check"></i> An toàn</span>'
                : '<span class="text-orange" style="font-weight: 600;"><i class="fa-solid fa-triangle-exclamation"></i> Nguy cơ</span>';

            tbody.innerHTML += `
                <tr>
                    <td>${item.thoi_gian_tao || '--'}</td>
                    <td>
                        <a href="${imgSrc}" target="_blank" title="Xem ảnh gốc">
                            <img src="${imgSrc}" alt="Ảnh cá" style="width: 55px; height: 55px; object-fit: cover; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2);">
                        </a>
                    </td>
                    <td><strong class="text-blue">${item.ten_hien_thi || item.ma_loai || 'Không rõ'}</strong></td>
                    <td style="font-weight: bold;">${doChinhXac}</td>
                    <td>${anToanBadge}</td>
                    <td>
                        <a href="${imgSrc}" download style="background: rgba(56, 189, 248, 0.15); border: 1px solid #38bdf8; color: #38bdf8; padding: 6px 10px; border-radius: 6px; font-size: 12px; text-decoration: none; margin-right: 6px; display: inline-flex; align-items: center; gap: 4px;" title="Tải về bổ sung Dataset">
                            <i class="fa-solid fa-download"></i> Dataset
                        </a>
                        <button class="btn-delete-ai" data-id="${item.id}" style="background: rgba(248, 113, 113, 0.15); border: 1px solid #f87171; color: #f87171; padding: 6px 10px; border-radius: 6px; cursor: pointer; font-size: 12px;" title="Xóa bản ghi">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });

        // Sự kiện xóa lịch sử AI
        document.querySelectorAll('.btn-delete-ai').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                if (confirm(`Xóa bản ghi nhận diện AI (ID: ${id})?`)) {
                    await fetch(`${API_BASE_URL}/api/admin/lich_su_ai/${id}`, { method: 'DELETE' });
                    loadAiHistory();
                }
            });
        });
    } catch (err) {
        console.error("Lỗi tải lịch sử AI:", err);
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-red" style="padding: 20px;">Lỗi: ${err.message}</td></tr>`;
    }
}

const btnRefreshAiHistory = document.getElementById('btn-refresh-ai-history');
if (btnRefreshAiHistory) btnRefreshAiHistory.addEventListener('click', loadAiHistory);

// ========================================================
// TAB 4: TRẠNG THÁI HỆ THỐNG & DỌN DẸP
// ========================================================
async function loadSystemHealth() {
    try {
        const res = await fetch(API_BASE_URL + '/api/admin/trang_thai_he_thong');
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data = await res.json();

        const statMqtt = document.getElementById('stat-mqtt-status');
        const statDb = document.getElementById('stat-db-status');
        const statSensors = document.getElementById('stat-sensors-count');
        const statFish = document.getElementById('stat-fish-count');

        if (statMqtt) {
            statMqtt.textContent = data.mqtt_connected ? "ĐANG HOẠT ĐỘNG" : "MẤT KẾT NỐI";
            statMqtt.className = data.mqtt_connected ? "text-green" : "text-red";
        }
        if (statDb) {
            statDb.textContent = data.db_connected ? "ĐÃ KẾT NỐI" : "LỖI KẾT NỐI";
            statDb.className = data.db_connected ? "text-green" : "text-red";
        }
        if (statSensors) statSensors.textContent = (data.so_ban_ghi_cam_bien || 0).toLocaleString() + " bản ghi";
        if (statFish) statFish.textContent = (data.so_loai_ca || 0) + " loài";
    } catch (err) {
        console.error("Lỗi lấy thông số hệ thống:", err);
    }
}

const btnRefreshHealth = document.getElementById('btn-refresh-health');
if (btnRefreshHealth) btnRefreshHealth.addEventListener('click', loadSystemHealth);

// Dọn dẹp dữ liệu cảm biến cũ
const btnRunCleanup = document.getElementById('btn-run-cleanup');
if (btnRunCleanup) {
    btnRunCleanup.addEventListener('click', async () => {
        const days = document.getElementById('cleanup-days').value;
        if (!confirm(`Bạn có chắc chắn muốn xóa toàn bộ dữ liệu cảm biến cũ hơn ${days} ngày?\nHành động này không thể hoàn tác.`)) {
            return;
        }

        btnRunCleanup.disabled = true;
        btnRunCleanup.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang dọn dẹp...';

        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/xoa_du_lieu_cu?so_ngay=${days}`, { method: 'POST' });
            const data = await res.json();
            alert(data.message || data.error || "Hoàn tất!");
            loadSystemHealth();
        } catch (err) {
            alert("Lỗi: " + err.message);
        } finally {
            btnRunCleanup.disabled = false;
            btnRunCleanup.innerHTML = '<i class="fa-solid fa-trash-can"></i> Dọn dẹp CSDL ngay';
        }
    });
}

// ========================================================
// TAB 5: YÊU CẦU TỪ KHÁCH HÀNG
// ========================================================
async function loadUserRequests() {
    const tbody = document.getElementById('admin-requests-tbody');
    const badge = document.getElementById('nav-request-badge');

    try {
        const res = await fetch(API_BASE_URL + '/api/admin/yeu_cau');
        if (!res.ok) throw new Error("HTTP " + res.status);
        const requests = await res.json();
        
        if (badge) {
            badge.textContent = requests.length;
            badge.style.display = requests.length > 0 ? 'inline-block' : 'none';
        }

        tbody.innerHTML = '';
        if (requests.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center" style="padding: 20px;">Không có yêu cầu cập nhật nào đang chờ.</td></tr>';
            return;
        }

        requests.forEach(req => {
            const tenCa = req.ten_ca_khach_nhap || req.ten_ca || 'Không rõ';
            tbody.innerHTML += `
                <tr>
                    <td>${req.thoi_gian_tao || '--'}</td>
                    <td><strong style="color: #38bdf8; font-size: 15px;">${tenCa}</strong></td>
                    <td><span style="color: #fbbf24;"><i class="fa-solid fa-clock"></i> Chờ duyệt</span></td>
                    <td>
                        <button class="btn-gradient" onclick="moFormThemCaTuYeuCau('${tenCa}')" style="padding: 6px 12px; font-size: 12px; margin-right: 8px; border-radius: 6px; width: auto;">
                            <i class="fa-solid fa-plus"></i> Thêm vào DB
                        </button>
                        <button class="btn-delete-request" data-id="${req.id}" style="background: rgba(248, 113, 113, 0.15); border: 1px solid #f87171; color: #f87171; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;">
                            <i class="fa-solid fa-xmark"></i> Bỏ qua
                        </button>
                    </td>
                </tr>
            `;
        });

        // Xóa yêu cầu
        document.querySelectorAll('.btn-delete-request').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                if (confirm(`Bạn muốn bỏ qua yêu cầu (ID: ${id}) này?`)) {
                    await fetch(`${API_BASE_URL}/api/admin/yeu_cau/${id}`, { method: 'DELETE' });
                    loadUserRequests();
                }
            });
        });
    } catch (err) {
        console.error("Lỗi tải yêu cầu:", err);
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-red" style="padding: 20px;">Lỗi: ${err.message}</td></tr>`;
    }
}

const btnRefreshRequests = document.getElementById('btn-refresh-requests');
if (btnRefreshRequests) btnRefreshRequests.addEventListener('click', loadUserRequests);

// Điền sẵn thông tin khi Admin bấm "Thêm vào DB" từ danh sách yêu cầu
function moFormThemCaTuYeuCau(tenCa) {
    editFishId = null;
    document.getElementById('fish-form').reset();
    document.getElementById('frm-ma-loai').disabled = false;
    document.getElementById('frm-ten-hien-thi').value = tenCa;
    
    // Tạo mã loài cá tự động: ca_ten_khong_dau
    let maLoai = tenCa.toLowerCase()
        .replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, 'a')
        .replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, 'e')
        .replace(/ì|í|ị|ỉ|ĩ/g, 'i')
        .replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, 'o')
        .replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, 'u')
        .replace(/ỳ|ý|ỵ|ỷ|ỹ/g, 'y')
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
    
    document.getElementById('frm-ma-loai').value = 'ca_' + maLoai;
    modalTitle.textContent = "Thêm Loài Cá từ Yêu cầu Khách hàng";
    modal.style.display = 'block';
}

// Khởi chạy khi load trang
loadFishDB();
loadEsp32Status();
loadUserRequests();
