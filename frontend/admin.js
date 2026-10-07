// CẤU HÌNH API TỰ ĐỘNG (Chạy được cả trên máy cá nhân và trên mạng)
const API_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:8000' 
    : 'https://ho-ca-thong-minh.onrender.com';

// ---- LOGIC CHUYỂN TAB (SPA) ----
const navBtns = document.querySelectorAll('.nav-btn');
const tabPanes = document.querySelectorAll('.tab-pane');

navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        // Bỏ qua nút Về trang Khách
        if (!btn.getAttribute('data-tab')) return;

        navBtns.forEach(b => b.classList.remove('active'));
        tabPanes.forEach(t => t.classList.remove('active'));
        
        btn.classList.add('active');
        const targetId = btn.getAttribute('data-tab');
        document.getElementById(targetId).classList.add('active');
        
        if(targetId === 'tab-fish-db') loadFishDB();
        if(targetId === 'tab-user-requests') loadUserRequests();
    });
});

// ---- TAB 1: QUẢN LÝ TỪ ĐIỂN CÁ ----
let allFishes = [];
let editFishId = null;

async function loadFishDB() {
    try {
        const res = await fetch(API_BASE_URL + '/api/admin/loai_ca');
        if (!res.ok) return;
        const fishList = await res.json();
        allFishes = fishList;
        
        const tbody = document.getElementById('admin-fish-tbody');
        tbody.innerHTML = '';
        
        if (fishList.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">Chưa có dữ liệu loài cá.</td></tr>';
            return;
        }
        
        fishList.forEach(fish => {
            let colorClass = 'text-green';
            if (fish.tinh_cach === 'Hung dữ') colorClass = 'text-red';
            else if (fish.tinh_cach === 'Rỉa vây') colorClass = 'text-yellow';
            
            tbody.innerHTML += `
                <tr>
                    <td>${fish.id}</td>
                    <td><strong>${fish.ten_hien_thi}</strong><br><small style="color: #94a3b8">${fish.ten_khoa_hoc || ''}</small></td>
                    <td>${fish.ten_tieng_anh || ''}</td>
                    <td class="text-orange">${fish.nhiet_do_min} - ${fish.nhiet_do_max} °C</td>
                    <td class="text-blue">${fish.ph_min} - ${fish.ph_max}</td>
                    <td class="${colorClass}">${fish.tinh_cach}</td>
                    <td>
                        <button class="btn-edit" data-id="${fish.id}" style="background:none; border:none; color:#38bdf8; cursor:pointer; margin-right: 10px;" title="Sửa"><i class="fa-solid fa-pen-to-square"></i></button>
                        <button class="btn-delete" data-id="${fish.id}" style="background:none; border:none; color:#f87171; cursor:pointer;" title="Xóa"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
        
        // Sự kiện xóa cá
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                if(confirm("Bạn có chắc chắn muốn xóa loài cá này khỏi cơ sở dữ liệu?")) {
                    await fetch(`${API_BASE_URL}/api/admin/loai_ca/${id}`, { method: 'DELETE' });
                    loadFishDB();
                }
            });
        });

        // Sự kiện sửa cá
        document.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.currentTarget.getAttribute('data-id'));
                const fish = allFishes.find(f => f.id === id);
                if(fish) moFormSuaCa(fish);
            });
        });
    } catch (err) {
        console.error("Lỗi tải từ điển cá:", err);
    }
}

// ---- LOGIC MODAL THÊM/SỬA CÁ ----
const modal = document.getElementById('fish-modal');
const btnOpenModal = document.getElementById('btn-open-add-modal');
const btnCloseModal = document.querySelector('.close-modal');
const btnCancel = document.getElementById('btn-cancel');
const modalTitle = document.getElementById('modal-title');

btnOpenModal.addEventListener('click', () => {
    editFishId = null;
    document.getElementById('fish-form').reset();
    document.getElementById('frm-ma-loai').disabled = false;
    modalTitle.textContent = "Thêm Loài Cá Mới vào Database";
    modal.style.display = 'block';
});
btnCloseModal.addEventListener('click', () => modal.style.display = 'none');
btnCancel.addEventListener('click', () => modal.style.display = 'none');
window.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

function moFormSuaCa(fish) {
    editFishId = fish.id;
    document.getElementById('frm-ma-loai').value = fish.ma_loai;
    document.getElementById('frm-ma-loai').disabled = true; // Không cho sửa mã loài
    document.getElementById('frm-ten-hien-thi').value = fish.ten_hien_thi;
    document.getElementById('frm-ten-tieng-anh').value = fish.ten_tieng_anh || '';
    document.getElementById('frm-ten-khoa-hoc').value = fish.ten_khoa_hoc || '';
    document.getElementById('frm-nhiet-min').value = fish.nhiet_do_min;
    document.getElementById('frm-nhiet-max').value = fish.nhiet_do_max;
    document.getElementById('frm-ph-min').value = fish.ph_min;
    document.getElementById('frm-ph-max').value = fish.ph_max;
    document.getElementById('frm-the-tich').value = fish.the_tich_yeu_cau;
    document.getElementById('frm-tinh-cach').value = fish.tinh_cach;
    document.getElementById('frm-nguon').value = fish.nguon_trich_dan || '';
    
    modalTitle.textContent = "Cập nhật Thông tin Loài Cá";
    modal.style.display = 'block';
}

document.getElementById('fish-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const reqData = {
        ma_loai: document.getElementById('frm-ma-loai').value,
        ten_hien_thi: document.getElementById('frm-ten-hien-thi').value,
        ten_tieng_anh: document.getElementById('frm-ten-tieng-anh').value,
        ten_khoa_hoc: document.getElementById('frm-ten-khoa-hoc').value,
        nhiet_do_min: parseFloat(document.getElementById('frm-nhiet-min').value),
        nhiet_do_max: parseFloat(document.getElementById('frm-nhiet-max').value),
        ph_min: parseFloat(document.getElementById('frm-ph-min').value),
        ph_max: parseFloat(document.getElementById('frm-ph-max').value),
        the_tich_yeu_cau: parseFloat(document.getElementById('frm-the-tich').value),
        tinh_cach: document.getElementById('frm-tinh-cach').value,
        nguon_trich_dan: document.getElementById('frm-nguon').value
    };
    
    const url = editFishId ? `${API_BASE_URL}/api/admin/loai_ca/${editFishId}` : API_BASE_URL + '/api/admin/loai_ca';
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
            alert(editFishId ? "Đã cập nhật thành công!" : "Đã thêm thành công!");
            document.getElementById('fish-form').reset();
            modal.style.display = 'none';
            loadFishDB();
        }
    } catch (err) {
        alert("Không thể kết nối đến máy chủ.");
    }
});

// ---- TAB YÊU CẦU TỪ KHÁCH ----
async function loadUserRequests() {
    try {
        const res = await fetch(API_BASE_URL + '/api/admin/yeu_cau');
        if (!res.ok) return;
        const requests = await res.json();
        
        // Cập nhật số đếm trên thanh điều hướng
        const badge = document.querySelector('button[data-tab="tab-user-requests"] span');
        if (badge) {
            badge.textContent = requests.length;
            badge.style.display = requests.length > 0 ? 'inline-block' : 'none';
        }
        
        const tbody = document.querySelector('#tab-user-requests tbody');
        tbody.innerHTML = '';
        
        if (requests.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center">Không có yêu cầu nào.</td></tr>';
            return;
        }
        
        requests.forEach(req => {
            tbody.innerHTML += `
                <tr>
                    <td>${req.thoi_gian_tao}</td>
                    <td><strong>${req.ten_ca_khach_nhap}</strong></td>
                    <td><span style="color: #fbbf24;"><i class="fa-solid fa-clock"></i> Chờ xử lý</span></td>
                    <td>
                        <button class="btn-gradient" onclick="moFormThemCaTuYeuCau('${req.ten_ca_khach_nhap}')" style="padding: 5px 10px; font-size: 12px; margin-right: 5px;"><i class="fa-solid fa-plus"></i> Thêm vào DB</button>
                    </td>
                </tr>
            `;
        });
    } catch (err) {
        console.error("Lỗi tải yêu cầu:", err);
    }
}

// Hàm hỗ trợ khi click "Thêm vào DB" từ danh sách yêu cầu
function moFormThemCaTuYeuCau(tenCa) {
    document.getElementById('frm-ten-hien-thi').value = tenCa;
    // Tự generate mã loại cơ bản (bỏ dấu tiếng Việt, thay khoảng trắng thành _)
    let maLoai = tenCa.toLowerCase()
        .replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, 'a')
        .replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, 'e')
        .replace(/ì|í|ị|ỉ|ĩ/g, 'i')
        .replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, 'o')
        .replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, 'u')
        .replace(/ỳ|ý|ỵ|ỷ|ỹ/g, 'y')
        .replace(/đ/g, 'd')
        .replace(/\\s+/g, '_');
    
    document.getElementById('frm-ma-loai').value = 'ca_' + maLoai;
    modal.style.display = 'block';
}

// Khởi chạy
loadFishDB();
loadUserRequests();
