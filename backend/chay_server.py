# Cài đặt thư viện: pip install fastapi uvicorn python-multipart mysql-connector-python
from fastapi import FastAPI, File, UploadFile
import uvicorn
from fastapi.middleware.cors import CORSMiddleware
from ket_noi_db import lay_ket_noi
from xu_ly_ai import nhan_dien_ca
import os
import datetime
import json
import paho.mqtt.client as mqtt
from apscheduler.schedulers.background import BackgroundScheduler

app = FastAPI()

# Bật tính năng CORS để Web có thể gửi request đến Server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def kiem_tra_server():
    return {"thong_bao": "Server FastAPI dang hoat dong tot!"}

@app.post("/api/nhan_dien_anh")
async def api_nhan_dien(anh_upload: UploadFile = File(...)):
    os.makedirs("uploads", exist_ok=True)
    thoi_gian_hien_tai = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    ten_file_moi = f"{thoi_gian_hien_tai}_{anh_upload.filename}"
    duong_dan_luu = os.path.join("uploads", ten_file_moi)
    
    with open(duong_dan_luu, "wb") as buffer:
        buffer.write(await anh_upload.read())
        
    ma_loai_ca, do_chinh_xac = nhan_dien_ca(duong_dan_luu)
    
    # GỌI HÀM TƯ VẤN SIÊU CẤP ĐỂ LẤY KẾT QUẢ ĐỐI CHIẾU
    ket_qua_tu_van = tu_van_tuong_thich(ma_loai_ca)
    
    # Lưu lại lịch sử
    conn = lay_ket_noi()
    if conn and ket_qua_tu_van["id_loai_ca"] is not None:
        cursor = conn.cursor()
        sql_ghi = "INSERT INTO lich_su_ai (duong_dan_anh, id_loai_ca, do_chinh_xac, phu_hop_khong) VALUES (%s, %s, %s, %s)"
        cursor.execute(sql_ghi, (duong_dan_luu, ket_qua_tu_van["id_loai_ca"], float(do_chinh_xac), ket_qua_tu_van["an_toan_tong_the"]))
        conn.commit()
        cursor.close()
        conn.close()
        
    return {
        "loai_ca": ma_loai_ca,
        "do_chinh_xac": do_chinh_xac,
        "tu_van": ket_qua_tu_van["loi_khuyen"],
        "chi_tiet": ket_qua_tu_van,
        "duong_dan_anh": duong_dan_luu
    }

# --- API CHO TÍNH NĂNG CHỌN CÁ THỦ CÔNG ---
from pydantic import BaseModel
class CaThuCongRequest(BaseModel):
    ma_loai_ca: str

@app.get("/api/tu_van")
def api_tu_van(ma_loai_ca: str, so_luong: int = 1):
    ket_qua_tu_van = tu_van_tuong_thich(ma_loai_ca, so_luong)
    return ket_qua_tu_van

# --- HÀM LOGIC SIÊU TƯ VẤN 3 LỚP (MÔI TRƯỜNG - MẬT ĐỘ - XÃ HỘI) ---
def tu_van_tuong_thich(ma_loai_ca, so_luong=1):
    conn = lay_ket_noi()
    ket_qua = {
        "id_loai_ca": None,
        "ten_ca": "Không rõ",
        "an_toan_tong_the": False,
        "loi_khuyen": "Không thể tra cứu thông tin.",
        "chi_tiet_nhiet": "Không rõ",
        "chi_tiet_ph": "Không rõ",
        "chi_tiet_bay_dan": "Không rõ",
        "chi_tiet_mat_do": "Không rõ"
    }
    
    if not conn: return ket_qua
    cursor = conn.cursor(dictionary=True)
    
    # Lấy thông tin cá muốn thả
    cursor.execute("SELECT * FROM loai_ca WHERE ma_loai = %s OR ten_hien_thi = %s", (ma_loai_ca, ma_loai_ca))
    ca_moi = cursor.fetchone()
    if not ca_moi:
        ket_qua["loi_khuyen"] = f"Không tìm thấy thông tin của loài '{ma_loai_ca}'."
        cursor.close(); conn.close(); return ket_qua
        
    ket_qua["id_loai_ca"] = ca_moi['id']
    ket_qua["ten_ca"] = ca_moi['ten_hien_thi']
    
    # LỚP 1: MÔI TRƯỜNG (Nhiệt độ, pH)
    cursor.execute("SELECT * FROM du_lieu_cam_bien ORDER BY id DESC LIMIT 1")
    cam_bien = cursor.fetchone()
    nhiet_hien_tai = cam_bien['nhiet_do'] if cam_bien else 27.0
    ph_hien_tai = cam_bien['do_ph'] if cam_bien else 7.2
    
    hop_nhiet = ca_moi['nhiet_do_min'] <= nhiet_hien_tai <= ca_moi['nhiet_do_max']
    ket_qua["chi_tiet_nhiet"] = "An toàn" if hop_nhiet else f"Nguy hiểm: Yêu cầu {ca_moi['nhiet_do_min']}-{ca_moi['nhiet_do_max']}°C (Hiện tại: {nhiet_hien_tai}°C)"
    
    hop_ph = ca_moi['ph_min'] <= ph_hien_tai <= ca_moi['ph_max']
    ket_qua["chi_tiet_ph"] = "An toàn" if hop_ph else f"Nguy hiểm: Yêu cầu pH {ca_moi['ph_min']}-{ca_moi['ph_max']} (Hiện tại: {ph_hien_tai})"
    
    # LỚP 2: MẬT ĐỘ (Không gian sinh tồn)
    cursor.execute("SELECT * FROM cai_dat_ho WHERE id = 1")
    ho_ca = cursor.fetchone()
    the_tich_ho = (ho_ca['chieu_dai'] * ho_ca['chieu_rong'] * ho_ca['chieu_cao']) / 1000 # Lít
    
    cursor.execute("""
        SELECT SUM(cdn.so_luong * lc.the_tich_yeu_cau) as the_tich_da_dung 
        FROM ca_dang_nuoi cdn 
        JOIN loai_ca lc ON cdn.id_loai_ca = lc.id
    """)
    the_tich_da_dung = cursor.fetchone()['the_tich_da_dung'] or 0
    the_tich_du = the_tich_ho - the_tich_da_dung
    
    the_tich_can_thiet = ca_moi['the_tich_yeu_cau'] * so_luong
    hop_mat_do = the_tich_du >= the_tich_can_thiet
    
    if hop_mat_do:
        ket_qua["chi_tiet_mat_do"] = f"Hồ rộng rãi (Thể tích dư: {the_tich_du:.1f}L / Bầy {so_luong} con cần: {the_tich_can_thiet}L)"
    else:
        ket_qua["chi_tiet_mat_do"] = f"Quá tải! Hồ chỉ dư {the_tich_du:.1f}L nhưng {so_luong} con cần tới {the_tich_can_thiet}L."
        
    # LỚP 3: XÃ HỘI (Tính cách, xung đột)
    cursor.execute("""
        SELECT lc.ten_hien_thi, lc.tinh_cach FROM ca_dang_nuoi cdn 
        JOIN loai_ca lc ON cdn.id_loai_ca = lc.id
    """)
    danh_sach_ca_cu = cursor.fetchall()
    
    hop_bay = True
    ket_qua["chi_tiet_bay_dan"] = "Hòa bình"
    
    for ca_cu in danh_sach_ca_cu:
        if ca_moi['tinh_cach'] == 'Hung dữ' and ca_cu['tinh_cach'] == 'Hòa bình':
            ket_qua["chi_tiet_bay_dan"] = f"Cảnh báo: {ca_moi['ten_hien_thi']} hung dữ có thể cắn {ca_cu['ten_hien_thi']}."
            hop_bay = False
            break
        elif ca_moi['tinh_cach'] == 'Hòa bình' and ca_cu['tinh_cach'] == 'Hung dữ':
            ket_qua["chi_tiet_bay_dan"] = f"Nguy hiểm: {ca_moi['ten_hien_thi']} có thể bị {ca_cu['ten_hien_thi']} trong hồ cắn chết."
            hop_bay = False
            break
            
    # TỔNG KẾT
    ket_qua["an_toan_tong_the"] = hop_nhiet and hop_ph and hop_mat_do and hop_bay
    
    if ket_qua["an_toan_tong_the"]:
        ket_qua["loi_khuyen"] = "TUYỆT VỜI! 3 Lớp sinh thái đều an toàn. Có thể thả cá."
    else:
        ket_qua["loi_khuyen"] = "KHÔNG AN TOÀN! Hệ thống phát hiện xung đột sinh thái. Xem chi tiết bên dưới."
        
    cursor.close()
    conn.close()
    return ket_qua

# --- API CHO TÍNH NĂNG ĐIỀU KHIỂN & CÀI ĐẶT THÔNG MINH ---
class CaiDatRequest(BaseModel):
    nhiet_do_min: float
    nhiet_do_max: float
    ph_min: float
    ph_max: float
    muc_nuoc_min: float
    chieu_dai: float
    chieu_rong: float
    chieu_cao: float
    chu_ky_gui_data: int
    che_do_den: str
    trang_thai_den: bool
    hen_gio_den_bat: str
    hen_gio_den_tat: str
    che_do_bom: str
    trang_thai_bom: bool
    hen_gio_bom_bat: str
    hen_gio_bom_tat: str

@app.get("/api/cai_dat")
def api_lay_cai_dat():
    conn = lay_ket_noi()
    if not conn: return {}
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM cai_dat_ho WHERE id = 1")
    cai_dat = cursor.fetchone()
    
    # Chuyển đổi định dạng TIME sang chuỗi (String) để FastAPI có thể render thành JSON
    for key in ['hen_gio_den_bat', 'hen_gio_den_tat', 'hen_gio_bom_bat', 'hen_gio_bom_tat']:
        if cai_dat and cai_dat[key]:
            cai_dat[key] = str(cai_dat[key])
            
    cursor.close()
    conn.close()
    return cai_dat

@app.post("/api/cai_dat")
def api_luu_cai_dat(req: CaiDatRequest):
    conn = lay_ket_noi()
    cursor = conn.cursor()
    sql = """
    UPDATE cai_dat_ho SET 
        nhiet_do_min=%s, nhiet_do_max=%s, ph_min=%s, ph_max=%s, muc_nuoc_min=%s, 
        chieu_dai=%s, chieu_rong=%s, chieu_cao=%s, chu_ky_gui_data=%s,
        che_do_den=%s, trang_thai_den=%s, hen_gio_den_bat=%s, hen_gio_den_tat=%s,
        che_do_bom=%s, trang_thai_bom=%s, hen_gio_bom_bat=%s, hen_gio_bom_tat=%s
    WHERE id = 1
    """
    cursor.execute(sql, (
        req.nhiet_do_min, req.nhiet_do_max, req.ph_min, req.ph_max, req.muc_nuoc_min,
        req.chieu_dai, req.chieu_rong, req.chieu_cao, req.chu_ky_gui_data,
        req.che_do_den, req.trang_thai_den, req.hen_gio_den_bat, req.hen_gio_den_tat,
        req.che_do_bom, req.trang_thai_bom, req.hen_gio_bom_bat, req.hen_gio_bom_tat
    ))
    conn.commit()
    cursor.close()
    conn.close()
    
    # Kích hoạt lệnh điều khiển MQTT NGAY LẬP TỨC nếu ở chế độ Manual
    if req.che_do_den == 'manual':
        lenh_den = "DEN_ON" if req.trang_thai_den else "DEN_OFF"
        mqtt_client.publish("hoca_test/commands", lenh_den)
        
    if req.che_do_bom == 'manual':
        lenh_bom = "BOM_ON" if req.trang_thai_bom else "BOM_OFF"
        mqtt_client.publish("hoca_test/commands", lenh_bom)
        
    # Phát luôn tần suất gửi cảm biến mới
    mqtt_client.publish("hoca_test/commands", f"CHU_KY_{req.chu_ky_gui_data}")
    
    return {"message": "Đã lưu cài đặt thành công và gửi lệnh MQTT"}

@app.get("/api/canh_bao")
def api_lay_canh_bao():
    conn = lay_ket_noi()
    if not conn: return []
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM lich_su_canh_bao ORDER BY id DESC LIMIT 50")
    canh_bao = cursor.fetchall()
    for row in canh_bao:
        if row.get('thoi_gian_tao'):
            row['thoi_gian_tao'] = row['thoi_gian_tao'].strftime("%Y-%m-%d %H:%M:%S")
    cursor.close()
    conn.close()
    return canh_bao

# --- API QUẢN LÝ DANH SÁCH CÁ ĐANG NUÔI ---
class ThemCaRequest(BaseModel):
    ten_ca: str # Chấp nhận 'Cá Bảy Màu' hoặc 'ca_bay_mau'
    so_luong: int

@app.get("/api/ca_dang_nuoi")
def api_lay_ca_dang_nuoi():
    conn = lay_ket_noi()
    if not conn: return []
    cursor = conn.cursor(dictionary=True)
    cursor.execute("""
        SELECT cdn.id, lc.ten_hien_thi, cdn.so_luong, lc.the_tich_yeu_cau 
        FROM ca_dang_nuoi cdn 
        JOIN loai_ca lc ON cdn.id_loai_ca = lc.id
    """)
    ds_ca = cursor.fetchall()
    cursor.close(); conn.close()
    return ds_ca

@app.post("/api/ca_dang_nuoi")
def api_them_ca(req: ThemCaRequest):
    conn = lay_ket_noi()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT id FROM loai_ca WHERE ma_loai = %s OR ten_hien_thi = %s", (req.ten_ca, req.ten_ca))
    ca = cursor.fetchone()
    if not ca:
        cursor.close(); conn.close()
        return {"error": "Không tìm thấy loài cá này trong từ điển AI."}
        
    cursor.execute("INSERT INTO ca_dang_nuoi (id_loai_ca, so_luong) VALUES (%s, %s)", (ca['id'], req.so_luong))
    conn.commit()
    cursor.close(); conn.close()
    return {"message": "Đã thêm cá vào hồ."}

@app.delete("/api/ca_dang_nuoi/{id}")
def api_xoa_ca(id: int):
    conn = lay_ket_noi()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM ca_dang_nuoi WHERE id = %s", (id,))
    conn.commit()
    cursor.close(); conn.close()
    return {"message": "Đã xóa cá."}

class SuaCaRequest(BaseModel):
    so_luong: int

@app.put("/api/ca_dang_nuoi/{id}")
def api_sua_ca(id: int, req: SuaCaRequest):
    conn = lay_ket_noi()
    cursor = conn.cursor()
    cursor.execute("UPDATE ca_dang_nuoi SET so_luong = %s WHERE id = %s", (req.so_luong, id))
    conn.commit()
    cursor.close(); conn.close()
    return {"message": "Đã cập nhật số lượng cá."}

@app.get("/api/bieu_do")
def api_lay_bieu_do(ngay: int = 0):
    # ngay = 0: 24h qua
    # ngay = 1: Hôm qua
    # ngay = 2: Hôm kia
    conn = lay_ket_noi()
    if not conn: return []
    cursor = conn.cursor(dictionary=True)
    
    # Query gom nhóm dữ liệu theo từng GIỜ để tối ưu lượng Data (tránh quá tải Chart.js)
    # Lấy giá trị Trung bình (AVG) của Nhiệt độ, pH, Mực nước trong giờ đó
    sql = """
        SELECT 
            DATE_FORMAT(thoi_gian_tao, '%%H:00') as gio,
            AVG(nhiet_do) as nhiet_do_tb,
            AVG(do_ph) as do_ph_tb,
            AVG(muc_nuoc) as muc_nuoc_tb
        FROM du_lieu_cam_bien
        WHERE DATE(thoi_gian_tao) = DATE(NOW() - INTERVAL %s DAY)
        GROUP BY HOUR(thoi_gian_tao)
        ORDER BY HOUR(thoi_gian_tao) ASC
    """
    if ngay == 0:
        # Nếu là 24h qua thì truy vấn từ NOW() - 24h
        sql = """
            SELECT 
                DATE_FORMAT(thoi_gian_tao, '%%H:00') as gio,
                AVG(nhiet_do) as nhiet_do_tb,
                AVG(do_ph) as do_ph_tb,
                AVG(muc_nuoc) as muc_nuoc_tb
            FROM du_lieu_cam_bien
            WHERE thoi_gian_tao >= NOW() - INTERVAL 24 HOUR
            GROUP BY HOUR(thoi_gian_tao)
            ORDER BY thoi_gian_tao ASC
        """
        cursor.execute(sql)
    else:
        cursor.execute(sql, (ngay,))
        
    du_lieu = cursor.fetchall()
    cursor.close()
    conn.close()
    return du_lieu

# ==========================================
# PHÂN HỆ MQTT VÀ HẸN GIỜ TỰ ĐỘNG (BACKGROUND)
# ==========================================

# 1. Khởi tạo MQTT Client
mqtt_client = mqtt.Client(client_id="PythonServer_HoCa")

def on_connect(client, userdata, flags, rc):
    print("✅ Đã kết nối thành công tới Trạm trung chuyển MQTT (EMQX)!")
    client.subscribe("hoca_test/sensors")

def on_message(client, userdata, msg):
    # Lắng nghe dữ liệu cảm biến từ ESP32 gửi lên
    payload = msg.payload.decode()
    print(f"📡 Nhận dữ liệu MQTT từ ESP32: {payload}")
    try:
        data = json.loads(payload)
        nhiet_do = data.get('nhiet_do', 0)
        do_ph = data.get('do_ph', 0)
        muc_nuoc = data.get('muc_nuoc', 100)
        
        # Lưu vào MySQL
        conn = lay_ket_noi()
        if conn:
            cursor = conn.cursor(dictionary=True)
            cursor.execute("INSERT INTO du_lieu_cam_bien (nhiet_do, do_ph, muc_nuoc) VALUES (%s, %s, %s)", (nhiet_do, do_ph, muc_nuoc))
            
            # --- LOGIC CẢNH BÁO THÔNG MINH ---
            cursor.execute("SELECT * FROM cai_dat_ho WHERE id = 1")
            cai_dat = cursor.fetchone()
            if cai_dat:
                canh_bao_list = []
                
                if nhiet_do > cai_dat['nhiet_do_max']: canh_bao_list.append(("Nhiệt độ", f"Nhiệt độ quá cao: {nhiet_do}°C"))
                if nhiet_do < cai_dat['nhiet_do_min']: canh_bao_list.append(("Nhiệt độ", f"Nhiệt độ quá thấp: {nhiet_do}°C"))
                if do_ph > cai_dat['ph_max']: canh_bao_list.append(("Độ pH", f"Độ pH quá cao: {do_ph}"))
                if do_ph < cai_dat['ph_min']: canh_bao_list.append(("Độ pH", f"Độ pH quá thấp: {do_ph}"))
                # Note: Nếu muc_nuoc_min chưa tồn tại trong DB cũ, giả sử lấy 30.0 nếu None
                muc_nuoc_min = cai_dat.get('muc_nuoc_min', 30.0) 
                if muc_nuoc < muc_nuoc_min: canh_bao_list.append(("Mực nước", f"Cạn nước! Mực nước hiện tại: {muc_nuoc}%"))
                
                if len(canh_bao_list) > 0:
                    # Ghi nhận vào Lịch sử cảnh báo
                    for cb in canh_bao_list:
                        cursor.execute("INSERT INTO lich_su_canh_bao (loai_canh_bao, noi_dung) VALUES (%s, %s)", (cb[0], cb[1]))
                    # Bắn còi MQTT
                    print("🚨 CÓ CẢNH BÁO! Đang rú còi...")
                    mqtt_client.publish("hoca_test/commands", "ALARM_ON")
                else:
                    # An toàn, tắt còi nếu đang kêu
                    mqtt_client.publish("hoca_test/commands", "ALARM_OFF")

            conn.commit()
            cursor.close()
            conn.close()
    except Exception as e:
        print("Lỗi phân tích dữ liệu MQTT:", e)

mqtt_client.on_connect = on_connect
mqtt_client.on_message = on_message

# 2. Vòng lặp Hẹn giờ tự động (Chạy mỗi 1 phút)
def kiem_tra_hen_gio():
    conn = lay_ket_noi()
    if not conn: return
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM cai_dat_ho WHERE id = 1")
    cai_dat = cursor.fetchone()
    cursor.close()
    conn.close()
    
    if not cai_dat: return
    
    gio_hien_tai = datetime.datetime.now().strftime("%H:%M")
    
    # Kiểm tra hẹn giờ đèn
    if cai_dat['che_do_den'] == 'timer':
        gio_bat_den = str(cai_dat['hen_gio_den_bat'])[:5] # Lấy HH:MM
        gio_tat_den = str(cai_dat['hen_gio_den_tat'])[:5]
        
        if gio_hien_tai == gio_bat_den:
            print("⏰ Đã tới giờ BẬT ĐÈN! Gửi lệnh MQTT...")
            mqtt_client.publish("hoca_test/commands", "DEN_ON")
        elif gio_hien_tai == gio_tat_den:
            print("⏰ Đã tới giờ TẮT ĐÈN! Gửi lệnh MQTT...")
            mqtt_client.publish("hoca_test/commands", "DEN_OFF")
            
    # Kiểm tra hẹn giờ Bơm
    if cai_dat['che_do_bom'] == 'timer':
        gio_bat_bom = str(cai_dat['hen_gio_bom_bat'])[:5]
        gio_tat_bom = str(cai_dat['hen_gio_bom_tat'])[:5]
        
        if gio_hien_tai == gio_bat_bom:
            print("⏰ Đã tới giờ BẬT BƠM! Gửi lệnh MQTT...")
            mqtt_client.publish("hoca_test/commands", "BOM_ON")
        elif gio_hien_tai == gio_tat_bom:
            print("⏰ Đã tới giờ TẮT BƠM! Gửi lệnh MQTT...")
            mqtt_client.publish("hoca_test/commands", "BOM_OFF")

# Khởi động MQTT và Scheduler khi ứng dụng chạy
@app.on_event("startup")
def startup_event():
    # Bật MQTT kết nối ngầm
    mqtt_client.connect("broker.emqx.io", 1883, 60)
    mqtt_client.loop_start()
    
    # Bật đồng hồ Hẹn giờ
    scheduler = BackgroundScheduler()
    scheduler.add_job(kiem_tra_hen_gio, 'interval', minutes=1)
    scheduler.start()

@app.on_event("shutdown")
def shutdown_event():
    mqtt_client.loop_stop()
    mqtt_client.disconnect()

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
