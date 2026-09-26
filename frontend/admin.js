// ---- LOGIC CHUYỂN TAB ----
const navBtns = document.querySelectorAll('.nav-btn');
const tabPanes = document.querySelectorAll('.tab-pane');

navBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        // Bỏ qua nút chuyển trang
        if (btn.hasAttribute('onclick')) return;
        
        navBtns.forEach(b => b.classList.remove('active'));
        tabPanes.forEach(t => t.classList.remove('active'));
        
        btn.classList.add('active');
        const targetId = btn.getAttribute('data-tab');
        document.getElementById(targetId).classList.add('active');
    });
});

// ---- LOGIC MODAL THÊM/SỬA CÁ ----
const modal = document.getElementById("fish-modal");
const btnOpen = document.getElementById("btn-open-add-modal");
const spanClose = document.getElementsByClassName("close-modal")[0];
const btnCancel = document.getElementById("btn-cancel");
const form = document.getElementById("fish-form");

// Mở Modal để Thêm mới
btnOpen.onclick = function() {
    document.getElementById("modal-title").innerText = "Thêm Loài Cá Mới vào Database";
    form.reset();
    modal.style.display = "block";
}

// Đóng Modal
function closeModal() {
    modal.style.display = "none";
}
spanClose.onclick = closeModal;
btnCancel.onclick = closeModal;
window.onclick = function(event) {
    if (event.target == modal) closeModal();
}

// Giả lập sự kiện Submit Form (Sau này sẽ gọi Fetch API POST/PUT lên Backend)
form.onsubmit = function(e) {
    e.preventDefault();
    const tenCa = document.getElementById("frm-ten-hien-thi").value;
    alert(`(Demo) Sẵn sàng lưu dữ liệu của cá: ${tenCa} vào Database!\nTính năng API sẽ được ráp ở bước sau.`);
    closeModal();
}

// Giả lập sự kiện bấm nút Xóa trên bảng
document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.onclick = function() {
        confirm("(Demo) Bạn có chắc chắn muốn xóa loài cá này khỏi Hệ chuyên gia?");
    }
});

// Giả lập sự kiện bấm nút Sửa trên bảng
document.querySelectorAll('.btn-edit').forEach(btn => {
    btn.onclick = function() {
        document.getElementById("modal-title").innerText = "Chỉnh sửa Thông số Loài Cá";
        modal.style.display = "block";
        // Sau này sẽ code tự động điền dữ liệu cũ vào các ô input tại đây
    }
});
