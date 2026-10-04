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
    });
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
        const response = await fetch('http://localhost:8000/api/nhan_dien_anh', { method: 'POST', body: formData });
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
        const response = await fetch(`http://localhost:8000/api/tu_van?ma_loai_ca=${encodeURIComponent(ma_loai_ca)}&so_luong=${qty}`);
        if (!response.ok) throw new Error('Lỗi Server');
        const data = await response.json();
        
        if (data.id_loai_ca === null) {
            alert(data.loi_khuyen);
            loading.classList.add('hidden'); document.getElementById('manual-analyze-btn').classList.remove('hidden');
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
    adviceEl.textContent = loi_khuyen_tong_the;
    
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
}

// ---- LOGIC BIỂU ĐỒ TỔNG QUAN ----
// ---- LOGIC BIỂU ĐỒ TỔNG QUAN ----
let waterChart, tempChart, phChart;

async function renderChart(ngay = 0) {
    try {
        const res = await fetch(`http://localhost:8000/api/bieu_do?ngay=${ngay}`);
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

// Lắng nghe gạt công tắc thủ công (Bật/Tắt tức thời bằng API riêng)
['light', 'pump', 'bomxa', 'bomcap', 'relay5'].forEach(thiet_bi => {
    const toggle = document.getElementById(`${thiet_bi}-toggle`);
    if(toggle) {
        toggle.addEventListener('change', async (e) => {
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
                await fetch('http://localhost:8000/api/dieu_khien_thiet_bi', {
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
if(btnQuickWater) {
    btnQuickWater.addEventListener('click', async () => {
        const pct = parseFloat(document.getElementById('quick-water-percent').value);
        if(!pct || pct <= 0 || pct >= 100) { alert("Nhập % cần thay không hợp lệ!"); return; }
        if(!confirm(`Xác nhận rút ${pct}% nước hồ ngay lập tức? Máy Lọc sẽ tạm ngắt an toàn.`)) return;
        
        try {
            const res = await fetch('http://localhost:8000/api/thay_nuoc_ngay', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phan_tram: pct })
            });
            if(res.ok) {
                const s = document.getElementById('quick-water-status');
                s.classList.remove('hidden');
                setTimeout(() => s.classList.add('hidden'), 5000);
            }
        } catch(e) {}
    });
}

// Hàm Load dữ liệu cài đặt từ Backend
async function loadSettings() {
    try {
        const res = await fetch('http://localhost:8000/api/cai_dat');
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
            if(data.lich_thay_nuoc_gio) document.getElementById('set-lich-gio').value = data.lich_thay_nuoc_gio.substring(0, 5);
            document.getElementById('set-lich-thu').value = data.lich_thay_nuoc_thu || '';
            
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
        lich_thay_nuoc_gio: document.getElementById('set-lich-gio').value || '',
        lich_thay_nuoc_thu: document.getElementById('set-lich-thu').value || ''
    };
    
    // Ràng buộc lại Mực nước Max trước khi lưu
    if (reqData.sieu_am_tran > reqData.chieu_cao - 2) {
        reqData.sieu_am_tran = reqData.chieu_cao - 2;
    }
    
    try {
        const res = await fetch('http://localhost:8000/api/cai_dat', {
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
        const res = await fetch('http://localhost:8000/api/canh_bao');
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
        const res = await fetch('http://localhost:8000/api/ca_dang_nuoi');
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
                    await fetch(`http://localhost:8000/api/ca_dang_nuoi/${id}`, { 
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
                    await fetch(`http://localhost:8000/api/ca_dang_nuoi/${id}`, { method: 'DELETE' });
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
        const res = await fetch('http://localhost:8000/api/ca_dang_nuoi', {
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
        const resCaiDat = await fetch('http://localhost:8000/api/cai_dat');
        if (resCaiDat.ok) {
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
            const resCb = await fetch('http://localhost:8000/api/cam_bien_moi_nhat');
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
                        alertBox.innerHTML = cb.canh_bao.map(msg => 
                            `<div style="background: rgba(239, 68, 68, 0.15); border-left: 4px solid #ef4444; padding: 12px 20px; margin-bottom: 10px; border-radius: 6px; display: flex; align-items: center; color: #ef4444; font-size: 1.05rem;">
                                <i class="fa-solid fa-triangle-exclamation" style="margin-right: 15px; font-size: 1.4rem;"></i>
                                <span style="font-weight: 600;">${msg}</span>
                            </div>`
                        ).join('');
                    } else {
                        alertBox.innerHTML = '';
                    }
                }
            }
        }
    } catch (e) {
        // Bỏ qua lỗi kết nối để tránh spam console khi server sập
    }
}, 300); // Rút ngắn từ 2000ms xuống 300ms để siêu mượt

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
