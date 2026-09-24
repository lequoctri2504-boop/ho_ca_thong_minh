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
const ctx = document.getElementById('envChart').getContext('2d');
let envChart;
async function renderChart(ngay = 0) {
    try {
        const res = await fetch(`http://localhost:8000/api/bieu_do?ngay=${ngay}`);
        if (!res.ok) return;
        const du_lieu = await res.json();
        
        // Chuẩn bị mảng dữ liệu rỗng
        const labels = [];
        const temp_data = [];
        const ph_data = [];
        const water_data = [];
        
        // Nhồi data từ DB vào mảng
        du_lieu.forEach(item => {
            labels.push(item.gio);
            temp_data.push(item.nhiet_do_tb.toFixed(1));
            ph_data.push(item.do_ph_tb.toFixed(1));
            water_data.push(item.muc_nuoc_tb.toFixed(1));
        });

        if (envChart) {
            envChart.destroy(); // Hủy chart cũ trước khi vẽ lại chart mới
        }
        
        envChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels.length > 0 ? labels : ['Chưa có dữ liệu'],
                datasets: [
                    {
                        label: 'Nhiệt độ (°C)',
                        data: temp_data.length > 0 ? temp_data : [0],
                        borderColor: '#fbbf24',
                        tension: 0.4,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Độ pH',
                        data: ph_data.length > 0 ? ph_data : [0],
                        borderColor: '#38bdf8',
                        tension: 0.4,
                        yAxisID: 'y1'
                    },
                    {
                        label: 'Mực nước (%)',
                        data: water_data.length > 0 ? water_data : [0],
                        borderColor: '#a78bfa',
                        borderDash: [5, 5],
                        tension: 0.4,
                        yAxisID: 'y2'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { type: 'linear', display: true, position: 'left', title: {display: true, text: 'Nhiệt độ'} },
                    y1: { type: 'linear', display: true, position: 'right', title: {display: true, text: 'pH'}, grid: { drawOnChartArea: false } },
                    y2: { type: 'linear', display: false, position: 'right', min: 0, max: 100 }
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
document.getElementById('set-che-do-den').addEventListener('change', (e) => {
    const mode = e.target.value;
    document.getElementById('den-manual-group').classList.toggle('hidden', mode !== 'manual');
    document.getElementById('den-timer-group').classList.toggle('hidden', mode !== 'timer');
});

// Lắng nghe thay đổi chế độ Bơm
document.getElementById('set-che-do-bom').addEventListener('change', (e) => {
    const mode = e.target.value;
    document.getElementById('bom-manual-group').classList.toggle('hidden', mode !== 'manual');
    document.getElementById('bom-timer-group').classList.toggle('hidden', mode !== 'timer');
});

// Lắng nghe gạt công tắc thủ công
document.getElementById('light-toggle').addEventListener('change', (e) => {
    document.getElementById('light-status').textContent = e.target.checked ? "Đang sáng" : "Đang tắt";
    document.getElementById('light-status').className = e.target.checked ? "text-yellow" : "";
});
document.getElementById('pump-toggle').addEventListener('change', (e) => {
    document.getElementById('pump-status').textContent = e.target.checked ? "Đang chạy" : "Đang tắt";
    document.getElementById('pump-status').className = e.target.checked ? "text-blue" : "";
});

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
            document.getElementById('set-den-bat').value = data.hen_gio_den_bat;
            document.getElementById('set-den-tat').value = data.hen_gio_den_tat;
            
            document.getElementById('set-che-do-bom').value = data.che_do_bom;
            document.getElementById('pump-toggle').checked = Boolean(data.trang_thai_bom);
            document.getElementById('set-bom-bat').value = data.hen_gio_bom_bat;
            document.getElementById('set-bom-tat').value = data.hen_gio_bom_tat;
            
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
        hen_gio_den_bat: document.getElementById('set-den-bat').value || '18:00',
        hen_gio_den_tat: document.getElementById('set-den-tat').value || '22:00',
        
        che_do_bom: document.getElementById('set-che-do-bom').value,
        trang_thai_bom: document.getElementById('pump-toggle').checked,
        hen_gio_bom_bat: document.getElementById('set-bom-bat').value || '06:00',
        hen_gio_bom_tat: document.getElementById('set-bom-tat').value || '18:00'
    };
    
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
