// ---- LOGIC ĐIỀU HƯỚNG MOBILE & DRAWER ----
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const sidebarCloseBtn = document.getElementById('sidebar-close-btn');
const mainSidebar = document.getElementById('main-sidebar');
const sidebarBackdrop = document.getElementById('sidebar-backdrop');

function openMobileSidebar() {
    if (mainSidebar && sidebarBackdrop) {
        mainSidebar.classList.add('active');
        sidebarBackdrop.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeMobileSidebar() {
    if (mainSidebar && sidebarBackdrop) {
        mainSidebar.classList.remove('active');
        sidebarBackdrop.classList.remove('active');
        document.body.style.overflow = '';
    }
}

if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', openMobileSidebar);
if (sidebarCloseBtn) sidebarCloseBtn.addEventListener('click', closeMobileSidebar);
if (sidebarBackdrop) sidebarBackdrop.addEventListener('click', closeMobileSidebar);

// ---- LOGIC CHUYỂN TAB (SPA) ----
const navBtns = document.querySelectorAll('.nav-btn');
const tabPanes = document.querySelectorAll('.tab-pane');

navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        navBtns.forEach(b => b.classList.remove('active'));
        tabPanes.forEach(t => t.classList.remove('active'));
        
        btn.classList.add('active');
        const targetId = btn.getAttribute('data-tab');
        document.getElementById(targetId).classList.add('active');

        if(targetId === 'tab-overview') renderChart();

        // Tự động đóng menu trên màn hình điện thoại khi chọn tab
        if (window.innerWidth <= 992) {
            closeMobileSidebar();
        }
    });
});

// Hỗ trợ chạm để bật/tắt Tooltip giải thích trên màn hình cảm ứng điện thoại
document.addEventListener('click', (e) => {
    const isIcon = e.target.classList.contains('tooltip-icon');
    document.querySelectorAll('.tooltip-box').forEach(box => {
        if (!isIcon || box.previousElementSibling !== e.target) {
            box.style.visibility = '';
            box.style.opacity = '';
        }
    });
    if (isIcon) {
        const box = e.target.nextElementSibling;
        if (box && box.classList.contains('tooltip-box')) {
            const isVisible = box.style.visibility === 'visible';
            box.style.visibility = isVisible ? 'hidden' : 'visible';
            box.style.opacity = isVisible ? '0' : '1';
        }
    }
});

// ---- LOGIC CHUYỂN MODE TƯ VẤN (AI / MANUAL) ----
const btnModeAi = document.getElementById('btn-mode-ai');
const btnModeManual = document.getElementById('btn-mode-manual');
const aiSection = document.getElementById('ai-section');
const manualSection = document.getElementById('manual-section');
const aiResultBox = document.getElementById('ai-result-box');

btnModeAi.addEventListener('click', () => {
    btnModeAi.classList.add('active'); btnModeManual.classList.remove('active');
    aiSection.classList.remove('hidden'); manualSection.classList.add('hidden');
    resultSection.classList.add('hidden');
});

btnModeManual.addEventListener('click', () => {
    btnModeManual.classList.add('active'); btnModeAi.classList.remove('active');
    manualSection.classList.remove('hidden'); aiSection.classList.add('hidden');
    resultSection.classList.add('hidden');
});

// ---- LOGIC NHẬN DIỆN AI ----
const uploadZone = document.getElementById('upload-zone');
const fileInput = document.getElementById('file-input');
const previewImg = document.getElementById('preview-image');
const analyzeBtn = document.getElementById('analyze-btn');

// --- CẤU HÌNH KẾT NỐI SERVER (TỰ ĐỘNG THÍCH ỨNG TRÊN PC / ĐIỆN THOẠI) ---
let API_BASE_URL = 'http://localhost:8000';
if (window.location.protocol.startsWith('http')) {
    if (window.location.port === '8000') {
        API_BASE_URL = window.location.origin;
    } else if (window.location.hostname) {
        API_BASE_URL = `${window.location.protocol}//${window.location.hostname}:8000`;
    }
}

const loading = document.getElementById('loading');
const resultSection = document.getElementById('result-section');
let currentFile = null;

uploadZone.addEventListener('click', () => fileInput.click());
uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('dragover'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
uploadZone.addEventListener('drop', (e) => {
    e.preventDefault(); uploadZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) handleFile(e.target.files[0]);
});

function handleFile(file) {
    if (!file.type.startsWith('image/')) { alert('Vui lòng chọn file hình ảnh!'); return; }
    currentFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
        previewImg.src = e.target.result;
        previewImg.style.display = 'block';
        analyzeBtn.disabled = false;
        resultSection.classList.add('hidden');
    };
    reader.readAsDataURL(file);
}

analyzeBtn.addEventListener('click', async () => {
    if (analyzeBtn.textContent === "Nhận diện ảnh khác") {
        previewImg.style.display = 'none'; previewImg.src = ''; currentFile = null;
        resultSection.classList.add('hidden'); analyzeBtn.textContent = "Nhận diện & Đánh giá";
        analyzeBtn.disabled = true; fileInput.value = ''; return; 
    }
    if (!currentFile) return;

    analyzeBtn.classList.add('hidden'); loading.classList.remove('hidden');
    resultSection.classList.add('hidden'); aiResultBox.classList.remove('hidden');

    const formData = new FormData(); formData.append('anh_upload', currentFile);
    try {
        const response = await fetch(API_BASE_URL + '/api/nhan_dien_anh', { method: 'POST', body: formData });
        if (!response.ok) throw new Error('Lỗi Server');
        const data = await response.json();
        
        // Render Kết quả AI
        document.getElementById('res-species').textContent = data.loai_ca;
        document.getElementById('res-confidence').textContent = (data.do_chinh_xac * 100).toFixed(1) + '%';
        
        // Render Báo cáo Tương thích
        renderTuVan(data.chi_tiet, data.tu_van);

        loading.classList.add('hidden'); resultSection.classList.remove('hidden');
        analyzeBtn.classList.remove('hidden'); analyzeBtn.textContent = "Nhận diện ảnh khác";
    } catch (error) {
        alert('Lỗi kết nối tới Backend Python!');
        loading.classList.add('hidden'); analyzeBtn.classList.remove('hidden');
    }
});

// ---- LOGIC CHỌN THỦ CÔNG ----
document.getElementById('manual-analyze-btn').addEventListener('click', async () => {
    const ma_loai_ca = document.getElementById('manual-fish-name').value.trim();
    const qty = parseInt(document.getElementById('manual-fish-qty').value) || 1;
    
    if (!ma_loai_ca) {
        alert("Vui lòng nhập tên loài cá dự định nuôi!");
        return;
    }
    
    document.getElementById('manual-analyze-btn').classList.add('hidden');
    loading.classList.remove('hidden');
    resultSection.classList.add('hidden');
    aiResultBox.classList.add('hidden');

    try {
        const response = await fetch(`${API_BASE_URL}/api/tu_van?ma_loai_ca=${encodeURIComponent(ma_loai_ca)}&so_luong=${qty}`);
        if (!response.ok) throw new Error('Lỗi Server');
        const data = await response.json();
        
        if (data.id_loai_ca === null) {
            loading.classList.add('hidden'); document.getElementById('manual-analyze-btn').classList.remove('hidden');
            if (confirm(data.loi_khuyen + "\n\nLoài cá này chưa có trong Từ điển. Bạn có muốn gửi yêu cầu cho Admin cập nhật không?")) {
                fetch(`${API_BASE_URL}/api/yeu_cau_ca`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ten_ca: ma_loai_ca })
                }).then(r => r.json()).then(res => {
                    alert(res.message);
                    loadYeuCauCa();
                });
            }
            return;
        }
        
        // Render Báo cáo Tương thích
        renderTuVan(data, data.loi_khuyen);

        loading.classList.add('hidden'); resultSection.classList.remove('hidden');
        document.getElementById('manual-analyze-btn').classList.remove('hidden');
    } catch (error) {
        alert('Lỗi kết nối tới Backend Python!');
        loading.classList.add('hidden'); document.getElementById('manual-analyze-btn').classList.remove('hidden');
    }
});

// Hàm dùng chung để in ra Báo cáo chi tiết 3 tiêu chí
function renderTuVan(chi_tiet, loi_khuyen_tong_the) {
    const adviceEl = document.getElementById('res-advice');
    adviceEl.innerHTML = loi_khuyen_tong_the;
    
    const setHtml = (id, text) => {
        const el = document.getElementById(id);
        if (el) {
            el.innerHTML = text;
            el.className = text.includes("Nguy hiểm") || text.includes("Xung đột") || text.includes("Không an toàn") ? "text-red" : "text-green";
        }
    };

    // Đổi màu tuỳ theo độ an toàn
    const resBox = document.getElementById('res-advice');
    if (chi_tiet.an_toan_tong_the) {
        resBox.className = "text-green";
        setHtml('res-overall', "Tương thích Tốt");
    } else {
        resBox.className = "text-red";
        setHtml('res-overall', "Không an toàn");
    }
    setHtml('res-detail', `Nhiệt độ: ${chi_tiet.chi_tiet_nhiet} <br> Độ pH: ${chi_tiet.chi_tiet_ph}`);
    setHtml('res-detail-group', chi_tiet.chi_tiet_bay_dan);
    setHtml('res-detail-capacity', chi_tiet.chi_tiet_mat_do || "Không rõ");
    
    // Cập nhật cho bảng Tổng thể bên dưới
    setHtml('res-detail-temp', chi_tiet.chi_tiet_nhiet);
    setHtml('res-detail-ph', chi_tiet.chi_tiet_ph);
    setHtml('res-detail-fish', chi_tiet.chi_tiet_bay_dan);
}

// ---- LOGIC BIỂU ĐỒ TỔNG QUAN ----
// ---- LOGIC BIỂU ĐỒ TỔNG QUAN ----
let waterChart, tempChart, phChart;

async function renderChart(ngay = 0) {
    try {
        const res = await fetch(`${API_BASE_URL}/api/bieu_do?ngay=${ngay}`);
        if (!res.ok) return;
        const du_lieu = await res.json();
        
        // Chuẩn bị mảng nhãn 24 giờ (Hiển thị số thẳng thừng từ 0 đến 23)
        const xLabels = [];
        for (let i = 0; i < 24; i++) {
            xLabels.push(i.toString());
        }

        // Chuẩn bị mảng dữ liệu trống (24 phần tử rỗng)
        const temp_data = new Array(24).fill(null);
        const ph_data = new Array(24).fill(null);
        const water_data = new Array(24).fill(null);
        
        // Nhồi data từ DB vào mảng dựa trên đúng mốc giờ
        du_lieu.forEach(item => {
            const hour = parseInt(item.gio.split(":")[0]); // Lấy giờ từ chuỗi "14:00"
            if (hour >= 0 && hour < 24) {
                temp_data[hour] = item.nhiet_do_tb.toFixed(1);
                ph_data[hour] = item.do_ph_tb.toFixed(1);
                water_data[hour] = item.muc_nuoc_tb.toFixed(1);
            }
        });

        const commonOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { 
                    title: { display: true, text: 'Thời gian (Giờ)', color: '#94a3b8', font: {size: 13, weight: 'bold'} },
                    ticks: { color: '#cbd5e1', autoSkip: false, maxRotation: 0 }, 
                    grid: { color: 'rgba(255,255,255,0.1)' } 
                },
                y: { 
                    ticks: { color: '#cbd5e1' }, 
                    grid: { color: 'rgba(255,255,255,0.1)' } 
                }
            }
        };

        // 1. Biểu đồ Mực Nước
        if (waterChart) waterChart.destroy();
        const ctxWater = document.getElementById('waterChart').getContext('2d');
        waterChart = new Chart(ctxWater, {
            type: 'line',
            data: {
                labels: xLabels,
                datasets: [{ label: 'Mực nước (%)', data: water_data.length > 0 ? water_data : [0], borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.2)', borderWidth: 2, fill: true, tension: 0.4, spanGaps: true, pointRadius: 4 }]
            },
            options: { 
                ...commonOptions, 
                plugins: { title: { display: true, text: 'Lượng Nước Trong Hồ (%)', color: '#60a5fa', font: { size: 14 } } }, 
                scales: { 
                    ...commonOptions.scales, 
                    y: { ...commonOptions.scales.y, min: 0, max: 100, title: { display: true, text: 'Mực nước (%)', color: '#3b82f6', font: {size: 13, weight: 'bold'} } } 
                } 
            }
        });

        // 2. Biểu đồ Nhiệt độ
        if (tempChart) tempChart.destroy();
        const ctxTemp = document.getElementById('tempChart').getContext('2d');
        tempChart = new Chart(ctxTemp, {
            type: 'line',
            data: {
                labels: xLabels,
                datasets: [{ label: 'Nhiệt độ (°C)', data: temp_data.length > 0 ? temp_data : [0], borderColor: '#f97316', backgroundColor: 'rgba(249, 115, 22, 0.2)', borderWidth: 2, fill: true, tension: 0.4, spanGaps: true, pointRadius: 4 }]
            },
            options: { 
                ...commonOptions, 
                plugins: { title: { display: true, text: 'Nhiệt độ Môi trường (°C)', color: '#fb923c', font: { size: 14 } } }, 
                scales: { 
                    ...commonOptions.scales, 
                    y: { ...commonOptions.scales.y, min: 20, max: 35, title: { display: true, text: 'Nhiệt độ (°C)', color: '#f97316', font: {size: 13, weight: 'bold'} } } 
                } 
            }
        });

        // 3. Biểu đồ pH
        if (phChart) phChart.destroy();
        const ctxPh = document.getElementById('phChart').getContext('2d');
        phChart = new Chart(ctxPh, {
            type: 'line',
            data: {
                labels: xLabels,
                datasets: [{ label: 'Độ pH', data: ph_data.length > 0 ? ph_data : [0], borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.2)', borderWidth: 2, fill: true, tension: 0.4, spanGaps: true, pointRadius: 4 }]
            },
            options: { 
                ...commonOptions, 
                plugins: { title: { display: true, text: 'Chỉ số pH', color: '#34d399', font: { size: 14 } } }, 
                scales: { 
                    ...commonOptions.scales, 
                    y: { ...commonOptions.scales.y, min: 0, max: 14, title: { display: true, text: 'Độ pH', color: '#10b981', font: {size: 13, weight: 'bold'} } } 
                } 
            }
        });

    } catch(err) {
        console.error("Lỗi vẽ biểu đồ:", err);
    }
}
renderChart(0); // Load mặc định 24h qua

// Sự kiện đổi ngày xem biểu đồ
document.getElementById('chart-time-filter').addEventListener('change', (e) => {
    const ngay = parseInt(e.target.value);
    renderChart(ngay);
});

// ---- LOGIC ĐIỀU KHIỂN & CÀI ĐẶT TRUNG TÂM ----
// Lắng nghe thay đổi chế độ Đèn
const denSelect = document.getElementById('set-che-do-den');
if(denSelect) {
    denSelect.addEventListener('change', (e) => {
        const mode = e.target.value;
        const toggle = document.getElementById('den-manual-toggle');
        const timer = document.getElementById('den-timer-group');
        if(toggle) toggle.classList.toggle('hidden', mode !== 'manual');
        if(timer) timer.classList.toggle('hidden', mode !== 'timer');
    });
}

// Lắng nghe thay đổi chế độ Bơm
const bomSelect = document.getElementById('set-che-do-bom');
if(bomSelect) {
    bomSelect.addEventListener('change', (e) => {
        const mode = e.target.value;
        const toggle = document.getElementById('bom-manual-toggle');
        const timer = document.getElementById('bom-timer-group');
        if(toggle) toggle.classList.toggle('hidden', mode !== 'manual');
        if(timer) timer.classList.toggle('hidden', mode !== 'timer');
    });
}
// Khóa tạm thời việc đồng bộ từ server để tránh tình trạng nút gạt bị giật ngược lại
let isToggling = false;
let toggleTimeout = null;

// Lắng nghe gạt công tắc thủ công (Bật/Tắt tức thời bằng API riêng)
['light', 'pump', 'bomxa', 'bomcap', 'relay5'].forEach(thiet_bi => {
    const toggle = document.getElementById(`${thiet_bi}-toggle`);
    if(toggle) {
        toggle.addEventListener('change', async (e) => {
            isToggling = true;
            clearTimeout(toggleTimeout);
            toggleTimeout = setTimeout(() => { isToggling = false; }, 3000); // Tạm khóa đồng bộ trong 3 giây
            
            const isChecked = e.target.checked;
            const statusEl = document.getElementById(`${thiet_bi}-status`);
            if (statusEl) {
                if (thiet_bi === 'light') statusEl.textContent = isChecked ? "Đang sáng" : "Đang tắt";
                if (thiet_bi === 'pump') statusEl.textContent = isChecked ? "Đang chạy" : "Đang tắt";
                if (thiet_bi === 'bomxa') statusEl.textContent = isChecked ? "Đang xả nước" : "Đang tắt";
                if (thiet_bi === 'bomcap') statusEl.textContent = isChecked ? "Đang cấp nước" : "Đang tắt";
                if (thiet_bi === 'relay5') statusEl.textContent = isChecked ? "Đang bật" : "Đang tắt";
            }
            
            // Gửi lệnh API tức thời
            const mapApi = { 'light': 'den', 'pump': 'bom', 'bomxa': 'bom_xa', 'bomcap': 'bom_cap', 'relay5': 'relay_5' };
            try {
                await fetch(API_BASE_URL + '/api/dieu_khien_thiet_bi', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ thiet_bi: mapApi[thiet_bi], trang_thai: isChecked })
                });
            } catch(e) {}
        });
    }
});

// Nút "Bắt đầu thay" (Thay nước ngay lập tức)
const btnQuickWater = document.getElementById('btn-quick-water');
const drainOnlyCb = document.getElementById('quick-water-drain-only');
const autoRefillCb = document.getElementById('quick-water-auto-refill');

if (drainOnlyCb && autoRefillCb) {
    drainOnlyCb.addEventListener('change', () => {
        if (drainOnlyCb.checked) {
            autoRefillCb.checked = false;
            autoRefillCb.disabled = true;
        } else {
            autoRefillCb.disabled = false;
        }
    });
}

if(btnQuickWater) {
    btnQuickWater.addEventListener('click', async () => {
        const pct = parseFloat(document.getElementById('quick-water-percent').value);
        const drainOnly = drainOnlyCb ? drainOnlyCb.checked : false;
        const autoRefill = autoRefillCb ? autoRefillCb.checked : false;
        
        if(!pct || pct <= 0 || pct > 100) { alert("Nhập % cần thay không hợp lệ (từ 5% đến 100%)!"); return; }
        
        let confirmMsg = `Xác nhận rút ${pct}% nước hồ ngay lập tức?\n` + (autoRefill ? "👉 Hệ thống sẽ TỰ ĐỘNG BƠM CẤP ĐẦY LẠI sau khi xả xong." : "👉 Hệ thống sẽ CHỈ RÚT NƯỚC rồi dừng hẳn (Không tự bơm bù).");
        if (drainOnly || pct >= 95) {
            confirmMsg = `⚠️ BẠN ĐANG CHỌN XẢ DỌN HỒ!\nHệ thống sẽ rút nước tới mức an toàn đáy (2.5cm) và KHÔNG tự bơm cấp lại.\nVui lòng đảm bảo CÁ ĐÃ ĐƯỢC VỚT RA NGOÀI an toàn.\n\nXác nhận bắt đầu xả?`;
        }
        if(!confirm(confirmMsg)) return;
        
        try {
            const res = await fetch(API_BASE_URL + '/api/thay_nuoc_ngay', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phan_tram: pct, chi_xa_can: drainOnly, tu_dong_cap_lai: autoRefill })
            });
            const data = await res.json();
            if(res.ok) {
                const s = document.getElementById('quick-water-status');
                if (s) {
                    s.innerText = data.message || "Đang chạy chu trình thay nước...";
                    s.classList.remove('hidden');
                    setTimeout(() => s.classList.add('hidden'), 10000);
                }
            } else {
                alert(data.error || "Lỗi khi kích hoạt thay nước!");
            }
        } catch(e) {
            alert("Lỗi kết nối khi gửi yêu cầu thay nước!");
        }
    });
}

// Đồng bộ hoá Giờ 24h & Chu kỳ thay nước tự động
const lichGioH = document.getElementById('set-lich-gio-h');
const lichGioM = document.getElementById('set-lich-gio-m');
const lichGioHidden = document.getElementById('set-lich-gio');
const lichChuKy = document.getElementById('set-lich-chu-ky');
const lichThuInput = document.getElementById('set-lich-thu');
const lichThuWrap = document.getElementById('lich-thu-wrap');

function updateLichGio() {
    if (lichGioH && lichGioM && lichGioHidden) {
        lichGioHidden.value = `${lichGioH.value}:${lichGioM.value}`;
    }
}

if (lichGioH && lichGioM) {
    lichGioH.addEventListener('change', updateLichGio);
    lichGioM.addEventListener('change', updateLichGio);
}

if (lichChuKy && lichThuInput && lichThuWrap) {
    lichChuKy.addEventListener('change', () => {
        if (lichChuKy.value === 'daily') {
            lichThuInput.value = '2,3,4,5,6,7,8';
            lichThuWrap.classList.add('hidden');
        } else {
            lichThuWrap.classList.remove('hidden');
            if (lichThuInput.value === '2,3,4,5,6,7,8' || !lichThuInput.value) {
                lichThuInput.value = '2,4,6';
            }
        }
    });
}

// Hàm Load dữ liệu cài đặt từ Backend
async function loadSettings() {
    try {
        const res = await fetch(API_BASE_URL + '/api/cai_dat');
        if (!res.ok) return;
        const data = await res.json();
        
        if (data.id) {
            document.getElementById('set-temp-min').value = data.nhiet_do_min;
            document.getElementById('set-temp-max').value = data.nhiet_do_max;
            document.getElementById('set-ph-min').value = data.ph_min;
            document.getElementById('set-ph-max').value = data.ph_max;
            document.getElementById('set-water-min').value = data.muc_nuoc_min || 30;
            document.getElementById('set-chu-ky').value = data.chu_ky_gui_data;
            
            document.getElementById('set-tank-l').value = data.chieu_dai || 60;
            document.getElementById('set-tank-w').value = data.chieu_rong || 40;
            document.getElementById('set-tank-h').value = data.chieu_cao || 40;
            calcVolume();
            
            document.getElementById('set-che-do-den').value = data.che_do_den;
            document.getElementById('light-toggle').checked = Boolean(data.trang_thai_den);
            const bD = (data.hen_gio_den_bat || '18:00,,').split(',');
            const tD = (data.hen_gio_den_tat || '06:00,,').split(',');
            document.getElementById('set-den-bat-1').value = bD[0] || ''; document.getElementById('set-den-tat-1').value = tD[0] || '';
            document.getElementById('set-den-bat-2').value = bD[1] || ''; document.getElementById('set-den-tat-2').value = tD[1] || '';
            document.getElementById('set-den-bat-3').value = bD[2] || ''; document.getElementById('set-den-tat-3').value = tD[2] || '';
            document.getElementById('set-den-thu').value = data.lich_den_thu || '2,3,4,5,6,7,8';
            
            document.getElementById('set-che-do-bom').value = data.che_do_bom;
            document.getElementById('pump-toggle').checked = Boolean(data.trang_thai_bom);
            const bB = (data.hen_gio_bom_bat || '06:00,,').split(',');
            const tB = (data.hen_gio_bom_tat || '18:00,,').split(',');
            document.getElementById('set-bom-bat-1').value = bB[0] || ''; document.getElementById('set-bom-tat-1').value = tB[0] || '';
            document.getElementById('set-bom-bat-2').value = bB[1] || ''; document.getElementById('set-bom-tat-2').value = tB[1] || '';
            document.getElementById('set-bom-bat-3').value = bB[2] || ''; document.getElementById('set-bom-tat-3').value = tB[2] || '';
            document.getElementById('set-bom-thu').value = data.lich_bom_thu || '2,3,4,5,6,7,8';
            
            document.getElementById('set-sieu-am-day').value = data.sieu_am_day || 21;
            document.getElementById('set-sieu-am-tran').value = data.sieu_am_tran || 3;
            document.getElementById('set-phan-tram-thay').value = data.phan_tram_thay || 0;
            
            // Giờ kích hoạt thay nước (24h)
            if(data.lich_thay_nuoc_gio) {
                const timeStr = data.lich_thay_nuoc_gio.substring(0, 5);
                document.getElementById('set-lich-gio').value = timeStr;
                const parts = timeStr.split(':');
                if (parts.length === 2) {
                    if (lichGioH) lichGioH.value = parts[0];
                    if (lichGioM) {
                        let mVal = parts[1];
                        let foundM = false;
                        for (let opt of lichGioM.options) {
                            if (opt.value === mVal) { foundM = true; break; }
                        }
                        lichGioM.value = foundM ? mVal : '00';
                    }
                }
            }
            
            // Chu kỳ lặp lại (Mỗi 24 giờ vs Tùy chọn Thứ)
            const lThu = data.lich_thay_nuoc_thu || '2,3,4,5,6,7,8';
            document.getElementById('set-lich-thu').value = lThu;
            if (lichChuKy && lichThuWrap) {
                if (lThu === '2,3,4,5,6,7,8' || !lThu) {
                    lichChuKy.value = 'daily';
                    lichThuWrap.classList.add('hidden');
                } else {
                    lichChuKy.value = 'custom';
                    lichThuWrap.classList.remove('hidden');
                }
            }
            
            // Cấu hình Còi cảnh báo
            if(document.getElementById('set-coi-enable')) {
                document.getElementById('set-coi-enable').checked = (data.coi_enable !== undefined ? Boolean(data.coi_enable) : true);
            }
            if(document.getElementById('set-coi-on')) document.getElementById('set-coi-on').value = data.coi_on_sec || 10;
            if(document.getElementById('set-coi-off')) document.getElementById('set-coi-off').value = data.coi_off_sec || 30;
            if(document.getElementById('set-coi-snooze')) document.getElementById('set-coi-snooze').value = data.coi_snooze_min || 5;

            // Kích hoạt sự kiện change để ẩn/hiện đúng UI
            document.getElementById('set-che-do-den').dispatchEvent(new Event('change'));
            document.getElementById('set-che-do-bom').dispatchEvent(new Event('change'));
            document.getElementById('light-toggle').dispatchEvent(new Event('change'));
            document.getElementById('pump-toggle').dispatchEvent(new Event('change'));
        }
    } catch (error) {
        console.error('Không tải được cài đặt:', error);
    }
}

// Hàm Lưu cài đặt chung
async function saveSettings() {
    updateLichGio();
    const reqData = {
        nhiet_do_min: parseFloat(document.getElementById('set-temp-min').value) || 24,
        nhiet_do_max: parseFloat(document.getElementById('set-temp-max').value) || 28,
        ph_min: parseFloat(document.getElementById('set-ph-min').value) || 6.5,
        ph_max: parseFloat(document.getElementById('set-ph-max').value) || 7.5,
        muc_nuoc_min: parseFloat(document.getElementById('set-water-min').value) || 30,
        
        chieu_dai: parseFloat(document.getElementById('set-tank-l').value) || 60,
        chieu_rong: parseFloat(document.getElementById('set-tank-w').value) || 40,
        chieu_cao: parseFloat(document.getElementById('set-tank-h').value) || 40,
        
        chu_ky_gui_data: parseInt(document.getElementById('set-chu-ky').value) || 60,
        
        che_do_den: document.getElementById('set-che-do-den').value,
        trang_thai_den: document.getElementById('light-toggle').checked,
        hen_gio_den_bat: [document.getElementById('set-den-bat-1').value, document.getElementById('set-den-bat-2').value, document.getElementById('set-den-bat-3').value].join(','),
        hen_gio_den_tat: [document.getElementById('set-den-tat-1').value, document.getElementById('set-den-tat-2').value, document.getElementById('set-den-tat-3').value].join(','),
        lich_den_thu: document.getElementById('set-den-thu').value || '2,3,4,5,6,7,8',
        
        che_do_bom: document.getElementById('set-che-do-bom').value,
        trang_thai_bom: document.getElementById('pump-toggle').checked,
        hen_gio_bom_bat: [document.getElementById('set-bom-bat-1').value, document.getElementById('set-bom-bat-2').value, document.getElementById('set-bom-bat-3').value].join(','),
        hen_gio_bom_tat: [document.getElementById('set-bom-tat-1').value, document.getElementById('set-bom-tat-2').value, document.getElementById('set-bom-tat-3').value].join(','),
        lich_bom_thu: document.getElementById('set-bom-thu').value || '2,3,4,5,6,7,8',
        
        sieu_am_day: parseFloat(document.getElementById('set-sieu-am-day').value) || 21,
        sieu_am_tran: parseFloat(document.getElementById('set-sieu-am-tran').value) || 3,
        phan_tram_thay: parseFloat(document.getElementById('set-phan-tram-thay').value) || 0,
        lich_thay_nuoc_gio: document.getElementById('set-lich-gio').value || '08:00',
        lich_thay_nuoc_thu: (document.getElementById('set-lich-chu-ky')?.value === 'daily') ? '2,3,4,5,6,7,8' : (document.getElementById('set-lich-thu').value || '2,3,4,5,6,7,8'),
        
        coi_enable: document.getElementById('set-coi-enable') ? document.getElementById('set-coi-enable').checked : true,
        coi_on_sec: parseInt(document.getElementById('set-coi-on') ? document.getElementById('set-coi-on').value : 10) || 10,
        coi_off_sec: parseInt(document.getElementById('set-coi-off') ? document.getElementById('set-coi-off').value : 30) || 30,
        coi_snooze_min: parseInt(document.getElementById('set-coi-snooze') ? document.getElementById('set-coi-snooze').value : 5) || 5
    };
    
    // Ràng buộc lại Mực nước Max trước khi lưu
    if (reqData.sieu_am_tran > reqData.chieu_cao - 2) {
        reqData.sieu_am_tran = reqData.chieu_cao - 2;
    }
    
    try {
        const res = await fetch(API_BASE_URL + '/api/cai_dat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reqData)
        });
        
        if (res.ok) {
            const status = document.getElementById('save-status');
            if(status) {
                status.classList.remove('hidden');
                setTimeout(() => status.classList.add('hidden'), 3000);
            }
        }
    } catch (error) {
        console.error("Lỗi khi lưu cài đặt! Kiểm tra Server Python.", error);
    }
}

// Lưu cài đặt từ nút Tab 3
document.getElementById('btn-save-settings').addEventListener('click', async () => {
    await saveSettings();
});

// Hàm Load Lịch sử Cảnh báo Hệ thống
async function loadAlertHistory() {
    try {
        const res = await fetch(API_BASE_URL + '/api/canh_bao');
        if (!res.ok) return;
        const alerts = await res.json();
        
        const tbody = document.getElementById('alert-history-tbody');
        tbody.innerHTML = '';
        
        if (alerts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center text-green">Hệ thống đang hoạt động ổn định, không có cảnh báo nào.</td></tr>';
            return;
        }
        
        alerts.forEach(item => {
            let colorClass = 'text-yellow';
            if (item.loai_canh_bao === 'Mực nước') colorClass = 'text-red';
            
            tbody.innerHTML += `
                <tr>
                    <td>${item.thoi_gian_tao}</td>
                    <td class="${colorClass}"><i class="fa-solid fa-triangle-exclamation"></i> ${item.loai_canh_bao}</td>
                    <td>${item.noi_dung}</td>
                </tr>
            `;
        });
    } catch (error) {
        console.error('Không tải được lịch sử cảnh báo:', error);
    }
}

// Gọi hàm loadAlertHistory khi bấm sang Tab Lịch sử
document.querySelectorAll('.sidebar-nav li').forEach(li => {
    li.addEventListener('click', () => {
        if (li.dataset.tab === 'tab-history') {
            loadAlertHistory();
        }
    });
});

// ---- TAB 5: QUẢN LÝ ĐÀN CÁ & THỂ TÍCH ----
function calcVolume() {
    const l = parseFloat(document.getElementById('set-tank-l').value) || 0;
    const w = parseFloat(document.getElementById('set-tank-w').value) || 0;
    const h = parseFloat(document.getElementById('set-tank-h').value) || 0;
    const vol = (l * w * h) / 1000;
    document.getElementById('tank-volume').innerText = vol.toFixed(1);
}
document.getElementById('set-tank-l').addEventListener('input', calcVolume);
document.getElementById('set-tank-w').addEventListener('input', calcVolume);
document.getElementById('set-tank-h').addEventListener('input', calcVolume);

document.getElementById('btn-save-tank').addEventListener('click', async () => {
    await saveSettings();
    alert("Đã cập nhật Kích thước Hồ vào Cơ sở dữ liệu!");
});

async function loadFishList() {
    try {
        const res = await fetch(API_BASE_URL + '/api/ca_dang_nuoi');
        if (!res.ok) return;
        const fishList = await res.json();
        const tbody = document.getElementById('fish-list-tbody');
        tbody.innerHTML = '';
        
        if (fishList.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center">Hồ đang trống.</td></tr>';
            return;
        }
        
        fishList.forEach(fish => {
            const tr = document.createElement('tr');
            const vol = fish.so_luong * fish.the_tich_yeu_cau;
            tr.innerHTML = `
                <td>${fish.ten_hien_thi}</td>
                <td>
                    <input type="number" class="glass-input update-qty" data-id="${fish.id}" value="${fish.so_luong}" min="1" style="width: 70px; padding: 5px; height: auto; text-align: center;"> con
                </td>
                <td>${vol.toFixed(1)} Lít</td>
                <td><button class="btn-delete" data-id="${fish.id}" style="background:none; border:none; color:#f87171; cursor:pointer;" title="Xóa cá khỏi hồ"><i class="fa-solid fa-trash"></i> Xóa</button></td>
            `;
            tbody.appendChild(tr);
        });
        
        // Cập nhật số lượng khi sửa ô input
        document.querySelectorAll('.update-qty').forEach(input => {
            input.addEventListener('change', async (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const sl = parseInt(e.currentTarget.value);
                if (sl >= 1) {
                    await fetch(`${API_BASE_URL}/api/ca_dang_nuoi/${id}`, { 
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ so_luong: sl })
                    });
                    loadFishList(); // Cập nhật lại UI để hiển thị thể tích mới
                }
            });
        });

        // Xóa cá
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                if(confirm("Bạn có chắc chắn muốn xóa loài cá này khỏi hồ?")) {
                    await fetch(`${API_BASE_URL}/api/ca_dang_nuoi/${id}`, { method: 'DELETE' });
                    loadFishList();
                }
            });
        });
    } catch(err) {
        console.error("Lỗi tải danh sách cá:", err);
    }
}

document.getElementById('btn-add-fish').addEventListener('click', async () => {
    const ten = document.getElementById('add-fish-name').value;
    const sl = parseInt(document.getElementById('add-fish-qty').value);
    if (!ten || sl < 1) {
        alert("Vui lòng nhập tên cá và số lượng hợp lệ.");
        return;
    }
    
    try {
        const res = await fetch(API_BASE_URL + '/api/ca_dang_nuoi', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ten_ca: ten, so_luong: sl })
        });
        const data = await res.json();
        if (data.error) {
            alert(data.error);
        } else {
            document.getElementById('add-fish-name').value = '';
            document.getElementById('add-fish-qty').value = '1';
            loadFishList();
            saveSettings(); // Update tank dimensions in background if changed
        }
    } catch (err) {
        alert("Lỗi thêm cá");
    }
});

document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if (btn.dataset.tab === 'tab-fish') {
            loadFishList();
            calcVolume();
        }
    });
});

// Khởi chạy khi load web
loadSettings();

// Tự động đồng bộ trạng thái Relay và Cảm biến từ Backend mỗi 2 giây
setInterval(async () => {
    try {
        // 1. Đồng bộ trạng thái Nút gạt (Đèn/Bơm/Bơm Xả/Bơm Cấp)
        const resCaiDat = await fetch(API_BASE_URL + '/api/cai_dat');
        if (resCaiDat.ok && !isToggling) {
            const data = await resCaiDat.json();
            const lightToggle = document.getElementById('light-toggle');
            const pumpToggle = document.getElementById('pump-toggle');
            const bomxaToggle = document.getElementById('bomxa-toggle');
            const bomcapToggle = document.getElementById('bomcap-toggle');
            const relay5Toggle = document.getElementById('relay5-toggle');
            
            if (lightToggle && lightToggle.checked !== Boolean(data.trang_thai_den)) {
                lightToggle.checked = Boolean(data.trang_thai_den);
                const ls = document.getElementById('light-status');
                if(ls) { ls.textContent = data.trang_thai_den ? "Đang sáng" : "Đang tắt"; }
            }
            if (pumpToggle && pumpToggle.checked !== Boolean(data.trang_thai_bom)) {
                pumpToggle.checked = Boolean(data.trang_thai_bom);
                const ps = document.getElementById('pump-status');
                if(ps) { ps.textContent = data.trang_thai_bom ? "Đang chạy" : "Đang tắt"; }
            }
            if (bomxaToggle && bomxaToggle.checked !== Boolean(data.trang_thai_bom_xa)) {
                bomxaToggle.checked = Boolean(data.trang_thai_bom_xa);
                const xs = document.getElementById('bomxa-status');
                if(xs) { xs.textContent = data.trang_thai_bom_xa ? "Đang xả nước" : "Đang tắt"; }
            }
            if (bomcapToggle && bomcapToggle.checked !== Boolean(data.trang_thai_bom_cap)) {
                bomcapToggle.checked = Boolean(data.trang_thai_bom_cap);
                const cs = document.getElementById('bomcap-status');
                if(cs) { cs.textContent = data.trang_thai_bom_cap ? "Đang cấp nước" : "Đang tắt"; }
            }
            if (relay5Toggle && relay5Toggle.checked !== Boolean(data.trang_thai_relay_5)) {
                relay5Toggle.checked = Boolean(data.trang_thai_relay_5);
                const r5s = document.getElementById('relay5-status');
                if(r5s) { r5s.textContent = data.trang_thai_relay_5 ? "Đang bật" : "Đang tắt"; }
            }
        }
        
        // 2. Đồng bộ Dữ liệu Cảm biến Lên 3 Thẻ Thông tin
        if(document.getElementById('tab-overview').classList.contains('active')) {
            const resCb = await fetch(API_BASE_URL + '/api/cam_bien_moi_nhat');
            if (resCb.ok) {
                const cb = await resCb.json();
                const nhietDo = cb.nhiet_do !== null ? cb.nhiet_do : 0;
                const doPh = cb.do_ph !== null ? cb.do_ph : 0;
                const mucNuoc = cb.muc_nuoc !== null ? cb.muc_nuoc : 0;
                
                document.getElementById('current-temp').innerText = nhietDo.toFixed(1) + ' °C';
                document.getElementById('current-ph').innerText = doPh.toFixed(1);
                document.getElementById('current-water').innerText = mucNuoc.toFixed(0) + ' %';
                
                // Cập nhật Cảnh báo
                const alertBox = document.getElementById('system-alerts');
                if (alertBox && cb.canh_bao) {
                    if (cb.canh_bao.length > 0) {
                        const isSnoozing = Boolean(cb.coi_dang_snooze);
                        const remaining = cb.snooze_con_lai_giay || 0;
                        const snoozeBtnHtml = isSnoozing 
                            ? `<button class="btn-gradient" style="background: #64748b; padding: 6px 14px; font-size: 0.85rem; border-radius: 6px; border:none; cursor:default;" disabled><i class="fa-solid fa-bell-slash"></i> Đang tắt còi (${Math.ceil(remaining/60)}p)</button>`
                            : `<button onclick="tatCoiTamThoi()" class="btn-gradient" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); width: auto; padding: 6px 14px; font-size: 0.85rem; border-radius: 6px; cursor: pointer; border:none;"><i class="fa-solid fa-bell-slash"></i> Tắt còi tạm thời</button>`;

                        let html = cb.canh_bao.map(msg => 
                            `<div style="background: rgba(239, 68, 68, 0.15); border-left: 4px solid #ef4444; padding: 12px 20px; margin-bottom: 8px; border-radius: 6px; display: flex; align-items: center; color: #ef4444; font-size: 1.02rem;">
                                <i class="fa-solid fa-triangle-exclamation" style="margin-right: 15px; font-size: 1.3rem;"></i>
                                <span style="font-weight: 600; flex: 1;">${msg}</span>
                            </div>`
                        ).join('');
                        
                        html += `<div style="text-align: right; margin-top: 4px; margin-bottom: 12px;">${snoozeBtnHtml}</div>`;
                        alertBox.innerHTML = html;
                    } else {
                        alertBox.innerHTML = '';
                    }
                }
            }
        }
    } catch (e) {
        // Bỏ qua lỗi kết nối để tránh spam console khi server sập
    }
}, 2000); // Trả lại 2000ms (2 giây) để máy chủ không bị quá tải gây giật lag web

// ==========================================
// RÀNG BUỘC MỰC NƯỚC MAX BẰNG JS
// ==========================================
const maxWaterInput = document.getElementById('set-sieu-am-tran');
const tankHeightInput = document.getElementById('set-tank-h');
if(maxWaterInput && tankHeightInput) {
    maxWaterInput.addEventListener('change', () => {
        let maxAllowed = parseFloat(tankHeightInput.value) - 2;
        let currentVal = parseFloat(maxWaterInput.value);
        if(currentVal > maxAllowed) {
            alert(`Mực nước Max không được vượt quá Chiều cao hồ trừ đi 2cm (Tối đa: ${maxAllowed} cm)!`);
            maxWaterInput.value = maxAllowed;
        }
    });
    
    tankHeightInput.addEventListener('change', () => {
        let maxAllowed = parseFloat(tankHeightInput.value) - 2;
        let currentVal = parseFloat(maxWaterInput.value);
        if(currentVal > maxAllowed) {
            maxWaterInput.value = maxAllowed;
        }
    });
}

// ==========================================
// TÍNH NĂNG CHATBOT AI TƯ VẤN (RAG + OLLAMA)
// ==========================================
function toggleAIChat() {
    const chatBox = document.getElementById('ai-chat-box');
    const chatBtn = document.getElementById('ai-chat-btn');
    if (chatBox.classList.contains('hidden')) {
        chatBox.classList.remove('hidden');
        chatBtn.style.display = 'none';
        document.getElementById('ai-chat-input-text').focus();
    } else {
        chatBox.classList.add('hidden');
        chatBtn.style.display = 'block';
    }
}

async function sendAIChat(forcedMsg = null) {
    const inputEl = document.getElementById('ai-chat-input-text');
    const msg = forcedMsg || inputEl.value.trim();
    if(!msg) return;
    
    // Hiện tin nhắn user
    appendMessage(msg, 'user-msg');
    inputEl.value = '';
    
    // Hiện chữ đang gõ...
    const loadingId = appendMessage('<i class="fa-solid fa-ellipsis fa-fade"></i> AI đang phân tích...', 'ai-msg');
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/chat_tu_van`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tin_nhan: msg })
        });
        const data = await response.json();
        
        // Render kết quả (hỗ trợ xuống dòng)
        document.getElementById(loadingId).innerHTML = data.reply ? data.reply.replace(/\n/g, '<br>') : "Không có phản hồi.";
    } catch (error) {
        document.getElementById(loadingId).innerHTML = "<span class='text-red'>Lỗi kết nối máy chủ AI. Đảm bảo Ollama đang chạy!</span>";
    }
}

function appendMessage(text, className) {
    const chatBox = document.getElementById('ai-chat-messages');
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${className}`;
    msgDiv.innerHTML = text;
    const id = 'msg-' + Date.now();
    msgDiv.id = id;
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
    return id;
}

// ---- LOGIC LOAD YÊU CẦU CẬP NHẬT CÁ ----
async function loadYeuCauCa() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/yeu_cau_ca`);
        const data = await response.json();
        const tbody = document.getElementById('request-history-tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        data.forEach(item => {
            const statusClass = item.trang_thai.includes('chờ') ? 'text-yellow' : 'text-green';
            const statusIcon = item.trang_thai.includes('chờ') ? '<i class="fa-solid fa-clock"></i>' : '<i class="fa-solid fa-check"></i>';
            tbody.innerHTML += `
                <tr>
                    <td>${item.thoi_gian_tao}</td>
                    <td>${item.ten_ca}</td>
                    <td class="${statusClass}">${statusIcon} ${item.trang_thai}</td>
                </tr>
            `;
        });
    } catch (e) {
        console.error("Lỗi tải yêu cầu cá", e);
    }
}

// Tải bảng yêu cầu khi trang vừa load
document.addEventListener('DOMContentLoaded', () => {
    loadYeuCauCa();
    const btnCalibPH = document.getElementById('btn-calib-ph');
    if (btnCalibPH) {
        btnCalibPH.addEventListener('click', hieuChuanPH);
    }
});

// Hàm Tạm tắt còi (Snooze)
async function tatCoiTamThoi() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/tat_coi_tam_thoi`, { method: 'POST' });
        const data = await res.json();
        alert(data.message || 'Đã tạm ngưng còi!');
    } catch (e) {
        alert('Lỗi kết nối máy chủ khi tắt còi!');
    }
}

// Hàm Hiệu chuẩn pH theo dung dịch mẫu
async function hieuChuanPH() {
    const phChuan = parseFloat(document.getElementById('calib-ph-val').value) || 7.0;
    const msgEl = document.getElementById('calib-ph-msg');
    try {
        const res = await fetch(`${API_BASE_URL}/api/hieu_chuan_ph`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ph_chuan: phChuan })
        });
        const data = await res.json();
        if (msgEl) {
            msgEl.innerText = data.message || 'Đã hiệu chuẩn thành công!';
            msgEl.classList.remove('hidden');
            setTimeout(() => msgEl.classList.add('hidden'), 5000);
        }
    } catch (e) {
        alert('Lỗi khi gửi yêu cầu hiệu chuẩn pH!');
    }
}



