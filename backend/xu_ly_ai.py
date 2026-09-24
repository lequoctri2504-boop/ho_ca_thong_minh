from ultralytics import YOLO

# Khởi tạo mô hình (Yêu cầu phải có file best.pt nằm cùng thư mục này)
mo_hinh = YOLO("best.pt")

def nhan_dien_ca(duong_dan_anh):
    # AI đọc ảnh
    ket_qua = mo_hinh(duong_dan_anh)
    
    boxes = ket_qua[0].boxes
    if len(boxes) == 0:
        return "Khong nhan dien duoc", 0.0
        
    # Rút trích kết quả (Mô hình Object Detection - Vẽ khung)
    # Lấy con cá đầu tiên (YOLO mặc định đã sắp xếp theo độ tự tin giảm dần)
    top_class_id = int(boxes.cls[0].item())
    ten_loai = ket_qua[0].names[top_class_id]
    do_chinh_xac = round(boxes.conf[0].item(), 2)
    
    return ten_loai, do_chinh_xac
