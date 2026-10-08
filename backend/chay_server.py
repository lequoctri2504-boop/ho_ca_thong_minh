# Cài đặt thư viện: pip install fastapi uvicorn python-multipart mysql-connector-python
from fastapi import FastAPI, File, UploadFile
import uvicorn
from fastapi.middleware.cors import CORSMiddleware
from ket_noi_db import lay_ket_noi
from xu_ly_ai import nhan_dien_ca
from fuzzy_logic import tinh_toan_fuzzy
import os
import datetime
import json
import paho.mqtt.client as mqtt
from apscheduler.schedulers.background import BackgroundScheduler
import difflib

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

@app.get("/api/khoi_tao_db")
def api_khoi_tao_db():
    conn = lay_ket_noi()
    if not conn: return {"error": "Không kết nối được Clever Cloud"}
    try:
        cursor = conn.cursor()
        # Tạo bảng Cài đặt
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS cai_dat_ho (
            id INT PRIMARY KEY,
            nhiet_do_min FLOAT DEFAULT 24.0, nhiet_do_max FLOAT DEFAULT 28.0,
            ph_min FLOAT DEFAULT 6.5, ph_max FLOAT DEFAULT 7.5,
            muc_nuoc_min FLOAT DEFAULT 30.0,
            chieu_dai FLOAT DEFAULT 60.0, chieu_rong FLOAT DEFAULT 40.0, chieu_cao FLOAT DEFAULT 40.0,
            loai_loc VARCHAR(50) DEFAULT 'lọc tràn', co_cay_thuy_sinh BOOLEAN DEFAULT FALSE,
            chu_ky_gui_data INT DEFAULT 5000,
            che_do_den VARCHAR(20) DEFAULT 'thu_cong', trang_thai_den BOOLEAN DEFAULT FALSE,
            hen_gio_den_bat TIME, hen_gio_den_tat TIME, lich_den_thu VARCHAR(50),
            che_do_bom VARCHAR(20) DEFAULT 'thu_cong', trang_thai_bom BOOLEAN DEFAULT FALSE,
            hen_gio_bom_bat TIME, hen_gio_bom_tat TIME, lich_bom_thu VARCHAR(50),
            sieu_am_day FLOAT DEFAULT 45.0, sieu_am_tran FLOAT DEFAULT 38.0,
            phan_tram_thay FLOAT DEFAULT 20.0, lich_thay_nuoc_gio TIME, lich_thay_nuoc_thu VARCHAR(50),
            dang_thay_nuoc BOOLEAN DEFAULT FALSE, muc_tieu_xa FLOAT DEFAULT 0.0,
            trang_thai_bom_xa BOOLEAN DEFAULT FALSE, trang_thai_bom_cap BOOLEAN DEFAULT FALSE,
            trang_thai_relay_5 BOOLEAN DEFAULT FALSE
        )
        """)
        # Tạo bảng Dữ liệu cảm biến
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS du_lieu_cam_bien (
            id INT AUTO_INCREMENT PRIMARY KEY,
            nhiet_do FLOAT, do_ph FLOAT, muc_nuoc FLOAT,
            thoi_gian_tao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)
        # Tạo bảng Cá
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS danh_sach_ca (
            id INT AUTO_INCREMENT PRIMARY KEY,
            ten_ca VARCHAR(100), so_luong INT
        )
        """)
        # Tạo bảng Cảnh báo
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS lich_su_canh_bao (
            id INT AUTO_INCREMENT PRIMARY KEY,
            loai_canh_bao VARCHAR(50), noi_dung TEXT,
            thoi_gian_tao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)
        
        # Chèn dòng cấu hình mặc định nếu chưa có
        cursor.execute("SELECT id FROM cai_dat_ho WHERE id=1")
        if not cursor.fetchone():
            cursor.execute("INSERT INTO cai_dat_ho (id) VALUES (1)")
            
        conn.commit()
        return {"message": "KHỞI TẠO DATABASE THÀNH CÔNG! HỆ THỐNG ĐÃ SẴN SÀNG."}
    except Exception as e:
        return {"error": str(e)}
    finally:
        cursor.close()
        conn.close()

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
    try:
        ket_qua_tu_van = tu_van_tuong_thich(ma_loai_ca, so_luong)
        return ket_qua_tu_van
    except Exception as e:
        import traceback
        return {
            "id_loai_ca": None,
            "loi_khuyen": f"Lỗi Python (Hãy chụp ảnh màn hình này gửi cho AI):\n{str(e)}\n{traceback.format_exc()}"
        }

@app.get("/api/ai_goi_y")
def api_ai_goi_y():
    conn = lay_ket_noi()
    if not conn: return []
    cursor = conn.cursor(dictionary=True)
    
    # Lấy toàn bộ mã cá trong DB
    cursor.execute("SELECT ma_loai FROM loai_ca")
    all_fishes = [row['ma_loai'] for row in cursor.fetchall()]
    
    goi_y = []
    # Test thử 1 con của từng loài
    for ma_loai in all_fishes:
        kq = tu_van_tuong_thich(ma_loai, 1) 
        # Nếu an toàn và điểm > 80 mới đề xuất
        if kq['an_toan_tong_the'] and kq.get('diem_phu_hop', 0) >= 80:
            goi_y.append({
                "ten_hien_thi": kq['ten_ca'],
                "diem_phu_hop": kq['diem_phu_hop'],
                "ly_do": f"{kq.get('chi_tiet_tang_boi','')} {kq.get('chi_tiet_bay_dan','')}"
            })
    
    cursor.close()
    conn.close()
    
    # Sắp xếp theo điểm phù hợp giảm dần và lấy top 3
    goi_y.sort(key=lambda x: x['diem_phu_hop'], reverse=True)
    return goi_y[:3]

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
    
    # --- LỚP BẢO VỆ NLP (Xử lý chuỗi & So khớp mờ difflib) ---
    cursor.execute("SELECT * FROM loai_ca")
    danh_sach_db = cursor.fetchall()
    
    ca_moi = None
    # 1. Chuẩn hóa chuỗi người dùng gõ
    keyword = str(ma_loai_ca).strip().lower()
    keyword = keyword.replace("7", "bảy").replace("3", "ba").replace("4", "tứ")
    
    # 2. Xây dựng Kho từ vựng (Corpus) từ Database
    ten_hien_thi_list = [c['ten_hien_thi'].lower() for c in danh_sach_db]
    ten_tieng_anh_list = [str(c['ten_tieng_anh']).lower() for c in danh_sach_db if c['ten_tieng_anh']]
    ma_loai_list = [c['ma_loai'].lower() for c in danh_sach_db]
    tu_khoa_tim_kiem = ten_hien_thi_list + ten_tieng_anh_list + ma_loai_list
    
    # 3. Thuật toán Pattern Matching (Ratcliff/Obershelp)
    # Lấy ra từ gần giống nhất, độ tin cậy tối thiểu 80% (cutoff=0.8) để tránh nhận nhầm (ví dụ 'cá chim' thành 'cá hồng kim')
    ket_qua_match = difflib.get_close_matches(keyword, tu_khoa_tim_kiem, n=1, cutoff=0.8)
    
    if ket_qua_match:
        tu_khoa_chuan = ket_qua_match[0]
        # Map ngược từ khóa chuẩn về dòng dữ liệu cá
        for c in danh_sach_db:
            if (c['ten_hien_thi'].lower() == tu_khoa_chuan or 
                str(c['ten_tieng_anh']).lower() == tu_khoa_chuan or 
                c['ma_loai'].lower() == tu_khoa_chuan):
                ca_moi = c
                break
                
    if not ca_moi:
        ket_qua["loi_khuyen"] = f"Hệ thống AI không thể nhận diện được loài cá '{ma_loai_ca}'. Vui lòng kiểm tra lại lỗi chính tả (Gợi ý: Bảy Màu, La Hán...)."
        cursor.close(); conn.close(); return ket_qua
        
    ket_qua["id_loai_ca"] = ca_moi['id']
    ket_qua["ten_ca"] = ca_moi['ten_hien_thi']
    
    # LỚP 1: MÔI TRƯỜNG (Fuzzy Logic: Nhiệt độ, pH)
    cursor.execute("SELECT * FROM du_lieu_cam_bien ORDER BY id DESC LIMIT 1")
    cam_bien = cursor.fetchone()
    nhiet_hien_tai = cam_bien['nhiet_do'] if cam_bien else 27.0
    ph_hien_tai = cam_bien['do_ph'] if cam_bien else 7.2
    
    # Bù nhiệt độ môi trường Miền Nam (Tăng 2 độ so với sách vở để phù hợp thực tế)
    nhiet_min_bu = ca_moi['nhiet_do_min'] + 2.0
    nhiet_max_bu = ca_moi['nhiet_do_max'] + 2.0
    
    kq_fuzzy = tinh_toan_fuzzy(
        nhiet_hien_tai, nhiet_min_bu, nhiet_max_bu,
        ph_hien_tai, ca_moi['ph_min'], ca_moi['ph_max']
    )
    diem_fuzzy = kq_fuzzy["diem_phu_hop"]
    danh_gia_fuzzy = kq_fuzzy["danh_gia"]
    
    ket_qua["diem_phu_hop"] = diem_fuzzy
    
    if kq_fuzzy['delta_temp'] == 0:
        ket_qua["chi_tiet_nhiet"] = "🟢 An toàn (Đã bù +2°C khí hậu miền Nam)"
    else:
        trang_thai = "Nóng hơn" if kq_fuzzy['delta_temp'] > 0 else "Lạnh hơn"
        ket_qua["chi_tiet_nhiet"] = f"{trang_thai} {abs(kq_fuzzy['delta_temp'])}°C so với ngưỡng (Chuẩn miền Nam: {nhiet_min_bu}-{nhiet_max_bu}°C, Hiện tại: {nhiet_hien_tai}°C)"
        
    if kq_fuzzy['delta_ph'] == 0:
        ket_qua["chi_tiet_ph"] = "An toàn"
    else:
        trang_thai = "Kiềm hơn" if kq_fuzzy['delta_ph'] > 0 else "Chua hơn"
        ket_qua["chi_tiet_ph"] = f"{trang_thai} {abs(kq_fuzzy['delta_ph'])} so với ngưỡng (Chuẩn: {ca_moi['ph_min']}-{ca_moi['ph_max']}, Hiện tại: {ph_hien_tai})"
    
    # LỚP 2: MẬT ĐỘ (Tải trọng sinh học - Bioload)
    cursor.execute("SELECT * FROM cai_dat_ho WHERE id = 1")
    ho_ca = cursor.fetchone()
    if not ho_ca:
        ho_ca = {'chieu_dai': 60.0, 'chieu_rong': 40.0, 'chieu_cao': 40.0, 'loai_loc': 'Thác', 'co_cay_thuy_sinh': False}
        
    the_tich_phu_bi = (ho_ca['chieu_dai'] * ho_ca['chieu_rong'] * ho_ca['chieu_cao']) / 1000 # Lít
    # Trừ hao 12% cho độ dày kính, phân nền, lũa, đá (để ra thể tích nước thực tế)
    the_tich_thuc_te = the_tich_phu_bi * 0.88 
    
    # Tính hệ số Lọc & Cây thủy sinh
    he_so_loc = 1.0
    if ho_ca.get('loai_loc') == 'Vi sinh': he_so_loc = 0.8
    elif ho_ca.get('loai_loc') == 'Thùng': he_so_loc = 1.3
    
    suc_chua_thuc_te = the_tich_thuc_te * he_so_loc
    if ho_ca.get('co_cay_thuy_sinh'):
        suc_chua_thuc_te *= 1.2 # Tăng 20%
        
    # Công thức Bioload
    cursor.execute("""
        SELECT lc.kich_thuoc_adult, lc.he_so_bioload, cdn.so_luong 
        FROM ca_dang_nuoi cdn 
        JOIN loai_ca lc ON cdn.id_loai_ca = lc.id
    """)
    ca_cu_list = cursor.fetchall()
    bioload_da_dung = 0
    for c in ca_cu_list:
        kich_thuoc = c.get('kich_thuoc_adult') or 5.0
        hs_bioload = c.get('he_so_bioload') or 1.0
        # Tính theo lập phương kích thước, chia hằng số để khớp thể tích
        bioload_da_dung += (kich_thuoc ** 3) * hs_bioload * c['so_luong'] * 0.05
        
    kich_thuoc_moi = ca_moi.get('kich_thuoc_adult') or 5.0
    hs_bioload_moi = ca_moi.get('he_so_bioload') or 1.0
    bioload_can_them = (kich_thuoc_moi ** 3) * hs_bioload_moi * so_luong * 0.05
    
    tong_bioload = bioload_da_dung + bioload_can_them
    phan_tram_bioload = (tong_bioload / suc_chua_thuc_te) * 100 if suc_chua_thuc_te > 0 else 100
    
    if phan_tram_bioload <= 100:
        hop_mat_do = True
        ket_qua["chi_tiet_mat_do"] = f"🟢 Lý tưởng ({phan_tram_bioload:.1f}%). Hệ thống Lọc {ho_ca.get('loai_loc','')} xử lý nhẹ nhàng, cá phát triển tốt."
    elif phan_tram_bioload <= 250:
        hop_mat_do = True
        ket_qua["chi_tiet_mat_do"] = f"🟡 Nuôi đông ({phan_tram_bioload:.1f}%). Vẫn có thể nuôi, nhưng hệ vi sinh chịu tải lớn. Bắt buộc thay nước 30% hàng tuần!"
    else:
        hop_mat_do = False
        ket_qua["chi_tiet_mat_do"] = f"🔴 Quá tải độc hại ({phan_tram_bioload:.1f}%)! Tuyệt đối không thả, cá sẽ chết vì ngộ độc Amoniac."
        
    # LỚP 3: XÃ HỘI (Xung đột sinh tồn, Tầng bơi & Bầy đàn)
    cursor.execute("""
        SELECT lc.ten_hien_thi, lc.tinh_cach, lc.kich_thuoc_adult, lc.kieu_vay, lc.tang_boi, cdn.so_luong 
        FROM ca_dang_nuoi cdn 
        JOIN loai_ca lc ON cdn.id_loai_ca = lc.id
    """)
    danh_sach_ca_cu = cursor.fetchall()
    
    hop_bay = True
    ket_qua["chi_tiet_bay_dan"] = "🟢 An toàn, không có xung đột nguy hiểm."
    
    # --- LUẬT BẦY ĐÀN TỐI THIỂU (Schooling Rule) ---
    cursor.execute("SELECT SUM(so_luong) as sl FROM ca_dang_nuoi WHERE id_loai_ca = %s", (ca_moi['id'],))
    row_sl = cursor.fetchone()
    sl_hien_co = int(row_sl['sl'] or 0) if row_sl else 0
    tong_loai_nay = sl_hien_co + so_luong
    bay_min = ca_moi.get('so_luong_bay_min') or 1
    
    if tong_loai_nay < bay_min:
        ket_qua["chi_tiet_bay_dan"] = f"🔴 Gây Stress: {ca_moi['ten_hien_thi']} tập tính bầy đàn. Cần thả ít nhất {bay_min} con (hồ bạn có {tong_loai_nay})."
        hop_bay = False
    # --- PHÂN TÍCH TẦNG BƠI (Water Column) ---
    tang_boi_hien_tai = [c.get('tang_boi') for c in danh_sach_ca_cu if c.get('tang_boi')]
    if ca_moi.get('tang_boi') in tang_boi_hien_tai:
        ket_qua["chi_tiet_tang_boi"] = f"🟡 Trùng lặp: Hồ đã có cá sống ở {ca_moi.get('tang_boi')}, có thể giành thức ăn."
    else:
        ket_qua["chi_tiet_tang_boi"] = f"🟢 Tuyệt vời: Cá bơi ở {ca_moi.get('tang_boi')} lấp đầy khoảng trống sinh thái."
    
    for ca_cu in danh_sach_ca_cu:
        # Luật Ăn thịt (Predation rule)
        size_cu = ca_cu.get('kich_thuoc_adult') or 5.0
        size_moi = ca_moi.get('kich_thuoc_adult') or 5.0
        if size_moi >= size_cu * 2.5:
            ket_qua["chi_tiet_bay_dan"] = f"🔴 Nuốt chửng: {ca_moi['ten_hien_thi']} ({size_moi}cm) sẽ ăn thịt {ca_cu['ten_hien_thi']} ({size_cu}cm)."
            hop_bay = False
            break
        if size_cu >= size_moi * 2.5:
            ket_qua["chi_tiet_bay_dan"] = f"🔴 Mồi nhậu: {ca_moi['ten_hien_thi']} ({size_moi}cm) sẽ bị {ca_cu['ten_hien_thi']} ({size_cu}cm) nuốt chửng."
            hop_bay = False
            break
            
        # Luật Rỉa vây (Fin-nipper)
        if ca_moi.get('tinh_cach') == 'Rỉa vây' and ca_cu.get('kieu_vay') == 'Dài':
            ket_qua["chi_tiet_bay_dan"] = f"🔴 Rỉa vây: {ca_moi['ten_hien_thi']} (Rỉa vây) sẽ cắn nát vây dài của {ca_cu['ten_hien_thi']}."
            hop_bay = False
            break
        if ca_cu.get('tinh_cach') == 'Rỉa vây' and ca_moi.get('kieu_vay') == 'Dài':
            ket_qua["chi_tiet_bay_dan"] = f"🔴 Rỉa vây: {ca_cu['ten_hien_thi']} trong hồ sẽ cắn nát vây dài của cá mới."
            hop_bay = False
            break
            
        # Luật Hung dữ
        if ca_moi['tinh_cach'] == 'Hung dữ' and ca_cu['tinh_cach'] != 'Hung dữ':
            ket_qua["chi_tiet_bay_dan"] = f"🔴 Tấn công: {ca_moi['ten_hien_thi']} (Hung dữ) sẽ cắn chết {ca_cu['ten_hien_thi']}."
            hop_bay = False
            break
        elif ca_cu['tinh_cach'] == 'Hung dữ' and ca_moi['tinh_cach'] != 'Hung dữ':
            ket_qua["chi_tiet_bay_dan"] = f"🔴 Bị bắt nạt: Cá mới sẽ bị {ca_cu['ten_hien_thi']} (Hung dữ) đánh chết."
            hop_bay = False
            break
            
    # TỔNG KẾT (Kết hợp Fuzzy Logic và Logic Tuyệt đối)
    hop_moi_truong = diem_fuzzy >= 40 # Ít nhất phải mức Rủi ro trở lên mới cho thả
    ket_qua["an_toan_tong_the"] = hop_moi_truong and hop_mat_do and hop_bay
    
    # --- TẠO CÂU TƯ VẤN CHUYÊN NGHIỆP ---
    tong_ca_cu = sum(c['so_luong'] for c in danh_sach_ca_cu)
    if tong_ca_cu > 0:
        danh_sach_ten = ", ".join([f"{c['so_luong']} {c['ten_hien_thi']}" for c in danh_sach_ca_cu])
        hien_trang_ho = f"Hồ {the_tich_phu_bi:.1f}L (nước thực tế ~{the_tich_thuc_te:.1f}L) đang nuôi {tong_ca_cu} con ({danh_sach_ten})"
    else:
        hien_trang_ho = f"Hồ {the_tich_phu_bi:.1f}L (nước thực tế ~{the_tich_thuc_te:.1f}L) hiện đang trống"
        
    if ket_qua["an_toan_tong_the"]:
        ket_qua["loi_khuyen"] = f"🟢 CÓ THỂ THẢ CÁ! {hien_trang_ho}. Việc thả thêm {so_luong} con {ca_moi['ten_hien_thi']} là hoàn toàn phù hợp. Môi trường (Nhiệt độ, pH, Mật độ) đều nằm trong ngưỡng lý tưởng."
    else:
        # Truy xuất nguyên nhân chính để báo cáo
        if not hop_mat_do:
            nguyen_nhan = "Hồ đã quá tải sinh học (Mật độ cá quá đông)"
        elif not hop_bay:
            nguyen_nhan = "Xung đột bầy đàn hoặc bị ăn thịt"
        else:
            nguyen_nhan = f"Điều kiện môi trường không phù hợp ({danh_gia_fuzzy})"
            
        ket_qua["loi_khuyen"] = f"🔴 KHÔNG NÊN THẢ! {hien_trang_ho}. Nếu bạn thả thêm {so_luong} con {ca_moi['ten_hien_thi']}, hệ sinh thái sẽ bị sụp đổ do: {nguyen_nhan}. Hãy đọc kỹ bảng phân tích bên dưới!"
        
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
    loai_loc: str = "Thác"
    co_cay_thuy_sinh: bool = False
    chu_ky_gui_data: int
    che_do_den: str
    trang_thai_den: bool
    hen_gio_den_bat: str
    hen_gio_den_tat: str
    lich_den_thu: str = "2,3,4,5,6,7,8"
    che_do_bom: str
    trang_thai_bom: bool
    hen_gio_bom_bat: str
    hen_gio_bom_tat: str
    lich_bom_thu: str = "2,3,4,5,6,7,8"
    sieu_am_day: float = 21.0
    sieu_am_tran: float = 3.0
    phan_tram_thay: float = 0.0
    lich_thay_nuoc_gio: str = ""
    lich_thay_nuoc_thu: str = ""
    trang_thai_relay_5: bool = False

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
        chieu_dai=%s, chieu_rong=%s, chieu_cao=%s, loai_loc=%s, co_cay_thuy_sinh=%s, chu_ky_gui_data=%s,
        che_do_den=%s, trang_thai_den=%s, hen_gio_den_bat=%s, hen_gio_den_tat=%s, lich_den_thu=%s,
        che_do_bom=%s, trang_thai_bom=%s, hen_gio_bom_bat=%s, hen_gio_bom_tat=%s, lich_bom_thu=%s,
        sieu_am_day=%s, sieu_am_tran=%s, phan_tram_thay=%s, lich_thay_nuoc_gio=%s, lich_thay_nuoc_thu=%s,
        trang_thai_relay_5=%s
    WHERE id = 1
    """
    cursor.execute(sql, (
        req.nhiet_do_min, req.nhiet_do_max, req.ph_min, req.ph_max, req.muc_nuoc_min,
        req.chieu_dai, req.chieu_rong, req.chieu_cao, req.loai_loc, req.co_cay_thuy_sinh, req.chu_ky_gui_data,
        req.che_do_den, req.trang_thai_den, req.hen_gio_den_bat, req.hen_gio_den_tat, req.lich_den_thu,
        req.che_do_bom, req.trang_thai_bom, req.hen_gio_bom_bat, req.hen_gio_bom_tat, req.lich_bom_thu,
        req.sieu_am_day, req.sieu_am_tran, req.phan_tram_thay, req.lich_thay_nuoc_gio, req.lich_thay_nuoc_thu,
        req.trang_thai_relay_5
    ))
    conn.commit()
    cursor.close()
    conn.close()
    
    # Bắn MQTT đồng bộ chiều cao bể xuống ESP32 để OLED hiển thị chính xác
    mqtt_client.publish("hoca_test/commands", f"CFG_W_{req.sieu_am_day}_{req.sieu_am_tran}")
    
    # Kích hoạt lệnh điều khiển MQTT NGAY LẬP TỨC 
    # (Dù đang ở chế độ nào, khi user bấm trên web thì ưu tiên chạy lệnh đó)
    lenh_den = "DEN_ON" if req.trang_thai_den else "DEN_OFF"
    mqtt_client.publish("hoca_test/commands", lenh_den)
        
    lenh_bom = "BOM_ON" if req.trang_thai_bom else "BOM_OFF"
    mqtt_client.publish("hoca_test/commands", lenh_bom)
        
    # Phát luôn tần suất gửi cảm biến mới
    mqtt_client.publish("hoca_test/commands", f"CHU_KY_{req.chu_ky_gui_data}")
    
    return {"message": "Đã lưu cài đặt thành công và gửi lệnh MQTT"}

class DieuKhienThietBiRequest(BaseModel):
    thiet_bi: str # 'den', 'bom', 'bom_xa', 'bom_cap'
    trang_thai: bool

@app.post("/api/dieu_khien_thiet_bi")
def api_dieu_khien_thiet_bi(req: DieuKhienThietBiRequest):
    cmd = ""
    if req.thiet_bi == 'den': cmd = "DEN_ON" if req.trang_thai else "DEN_OFF"
    elif req.thiet_bi == 'bom': cmd = "BOM_ON" if req.trang_thai else "BOM_OFF"
    elif req.thiet_bi == 'bom_xa': cmd = "BOMXA_ON" if req.trang_thai else "BOMXA_OFF"
    elif req.thiet_bi == 'bom_cap': cmd = "BOMCAP_ON" if req.trang_thai else "BOMCAP_OFF"
    elif req.thiet_bi == 'relay_5': cmd = "BOM5_ON" if req.trang_thai else "BOM5_OFF"
    
    if cmd:
        mqtt_client.publish("hoca_test/commands", cmd)
    return {"message": f"Đã gửi lệnh {cmd}"}

class ThayNuocNhanhRequest(BaseModel):
    phan_tram: float

@app.post("/api/thay_nuoc_ngay")
def api_thay_nuoc_ngay(req: ThayNuocNhanhRequest):
    conn = lay_ket_noi()
    if conn:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT muc_nuoc FROM du_lieu_cam_bien ORDER BY id DESC LIMIT 1")
        cb = cursor.fetchone()
        muc_nuoc_hien_tai = cb['muc_nuoc'] if cb else 100.0
        
        muc_tieu = max(0.0, float(muc_nuoc_hien_tai) - req.phan_tram)
        cursor.execute("UPDATE cai_dat_ho SET dang_thay_nuoc=1, muc_tieu_xa=%s WHERE id=1", (muc_tieu,))
        conn.commit()
        
        mqtt_client.publish("hoca_test/commands", "BOM_OFF") # Tắt máy lọc
        mqtt_client.publish("hoca_test/commands", "BOMXA_ON") # Bật bơm xả
        cursor.close(); conn.close()
        return {"message": "Đã kích hoạt chu trình thay nước thủ công."}
    return {"error": "Lỗi CSDL"}

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

@app.get("/api/cam_bien_moi_nhat")
def api_cam_bien_moi_nhat():
    conn = lay_ket_noi()
    if not conn: return {}
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT nhiet_do, do_ph, muc_nuoc FROM du_lieu_cam_bien ORDER BY id DESC LIMIT 1")
    data = cursor.fetchone()
    
    cursor.execute("SELECT * FROM cai_dat_ho WHERE id = 1")
    cai_dat = cursor.fetchone()
    cursor.close()
    conn.close()
    
    if not data: return {"nhiet_do": 0, "do_ph": 0, "muc_nuoc": 0, "canh_bao": []}
    
    canh_bao = []
    if cai_dat:
        t = float(data.get('nhiet_do') or 0)
        ph = float(data.get('do_ph') or 0)
        w = float(data.get('muc_nuoc') or 0)
        
        t_min = float(cai_dat.get('nhiet_do_min', 24))
        t_max = float(cai_dat.get('nhiet_do_max', 28))
        ph_min = float(cai_dat.get('ph_min', 6.5))
        ph_max = float(cai_dat.get('ph_max', 7.5))
        w_min = float(cai_dat.get('muc_nuoc_min', 30))
        dang_thay = cai_dat.get('dang_thay_nuoc', 0)
        
        if t < t_min: canh_bao.append(f"Nhiệt độ hồ quá thấp ({t:.1f}°C < {t_min}°C). Hãy kiểm tra sưởi.")
        elif t > t_max: canh_bao.append(f"Nhiệt độ hồ quá nóng ({t:.1f}°C > {t_max}°C). Hãy giảm nhiệt.")
        
        if ph < ph_min: canh_bao.append(f"Độ pH quá thấp ({ph:.1f} < {ph_min}). Môi trường bị axit.")
        elif ph > ph_max: canh_bao.append(f"Độ pH quá cao ({ph:.1f} > {ph_max}). Môi trường kiềm cao.")
        
        if w < w_min and dang_thay == 0:
            canh_bao.append(f"Cảnh báo: Mực nước bốc hơi hụt quá ngưỡng an toàn ({w:.0f}% < {w_min}%). Cần châm bù nước ngay!")
            
    data['canh_bao'] = canh_bao
    return data

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
    
    try:
        if ngay == 0:
            sql = """
                SELECT 
                    DATE_FORMAT(thoi_gian, '%H:00') as gio,
                    AVG(nhiet_do) as nhiet_do_tb,
                    AVG(do_ph) as do_ph_tb,
                    AVG(muc_nuoc) as muc_nuoc_tb
                FROM du_lieu_cam_bien
                WHERE thoi_gian >= NOW() - INTERVAL 24 HOUR
                GROUP BY HOUR(thoi_gian)
                ORDER BY thoi_gian ASC
            """
            cursor.execute(sql)
        else:
            sql = """
                SELECT 
                    DATE_FORMAT(thoi_gian, '%%H:00') as gio,
                    AVG(nhiet_do) as nhiet_do_tb,
                    AVG(do_ph) as do_ph_tb,
                    AVG(muc_nuoc) as muc_nuoc_tb
                FROM du_lieu_cam_bien
                WHERE DATE(thoi_gian) = DATE(NOW() - INTERVAL %s DAY)
                GROUP BY HOUR(thoi_gian)
                ORDER BY HOUR(thoi_gian) ASC
            """
            cursor.execute(sql, (ngay,))
            
        du_lieu = cursor.fetchall()
        cursor.close()
        conn.close()
        return du_lieu
    except Exception as e:
        print("LỖI API BIỂU ĐỒ:", e)
        # Nếu cột là thoi_gian_tao thay vì thoi_gian, thử lại:
        try:
            if ngay == 0:
                sql = """
                    SELECT 
                        DATE_FORMAT(thoi_gian_tao, '%H:00') as gio,
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
                cursor.execute(sql, (ngay,))
            du_lieu = cursor.fetchall()
            cursor.close()
            conn.close()
            return du_lieu
        except Exception as e2:
            print("LỖI LẦN 2 API BIỂU ĐỒ:", e2)
            cursor.close()
            conn.close()
            return []

# --- API CHO TRANG ADMIN (CRUD LOÀI CÁ) ---
class LoaiCaRequest(BaseModel):
    ma_loai: str
    ten_hien_thi: str
    ten_tieng_anh: str = ""
    ten_khoa_hoc: str = ""
    nhiet_do_min: float
    nhiet_do_max: float
    ph_min: float
    ph_max: float
    the_tich_yeu_cau: float
    tinh_cach: str
    nguon_trich_dan: str = ""

@app.get("/api/admin/loai_ca")
def get_tat_ca_loai_ca():
    conn = lay_ket_noi()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM loai_ca")
    data = cursor.fetchall()
    cursor.close(); conn.close()
    return data

@app.post("/api/admin/loai_ca")
def them_loai_ca_moi(req: LoaiCaRequest):
    conn = lay_ket_noi()
    cursor = conn.cursor()
    sql = """INSERT INTO loai_ca (ma_loai, ten_hien_thi, ten_tieng_anh, ten_khoa_hoc, 
             nhiet_do_min, nhiet_do_max, ph_min, ph_max, the_tich_yeu_cau, tinh_cach, nguon_trich_dan) 
             VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"""
    try:
        cursor.execute(sql, (req.ma_loai, req.ten_hien_thi, req.ten_tieng_anh, req.ten_khoa_hoc, 
                             req.nhiet_do_min, req.nhiet_do_max, req.ph_min, req.ph_max, 
                             req.the_tich_yeu_cau, req.tinh_cach, req.nguon_trich_dan))
        conn.commit()
    except Exception as e:
        return {"error": str(e)}
    finally:
        cursor.close(); conn.close()
    return {"message": "Đã thêm loài cá mới thành công!"}

@app.delete("/api/admin/loai_ca/{id}")
def xoa_loai_ca(id: int):
    conn = lay_ket_noi()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM loai_ca WHERE id = %s", (id,))
    conn.commit()
    cursor.close(); conn.close()
    return {"message": "Đã xóa loài cá!"}

@app.put("/api/admin/loai_ca/{id}")
def sua_loai_ca(id: int, req: LoaiCaRequest):
    conn = lay_ket_noi()
    cursor = conn.cursor()
    sql = """UPDATE loai_ca SET 
             ma_loai=%s, ten_hien_thi=%s, ten_tieng_anh=%s, ten_khoa_hoc=%s, 
             nhiet_do_min=%s, nhiet_do_max=%s, ph_min=%s, ph_max=%s, 
             the_tich_yeu_cau=%s, tinh_cach=%s, nguon_trich_dan=%s
             WHERE id=%s"""
    try:
        cursor.execute(sql, (req.ma_loai, req.ten_hien_thi, req.ten_tieng_anh, req.ten_khoa_hoc, 
                             req.nhiet_do_min, req.nhiet_do_max, req.ph_min, req.ph_max, 
                             req.the_tich_yeu_cau, req.tinh_cach, req.nguon_trich_dan, id))
        conn.commit()
    except Exception as e:
        return {"error": str(e)}
    finally:
        cursor.close(); conn.close()
    return {"message": "Đã cập nhật loài cá thành công!"}

# --- API YÊU CẦU THÊM CÁ TỪ USER ---
class YeuCauCaRequest(BaseModel):
    ten_ca: str

@app.post("/api/khach/yeu_cau_ca")
def gui_yeu_cau_them_ca(req: YeuCauCaRequest):
    conn = lay_ket_noi()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO yeu_cau_them_ca (ten_ca_khach_nhap) VALUES (%s)", (req.ten_ca,))
    conn.commit()
    cursor.close(); conn.close()
    return {"message": "Đã gửi yêu cầu thành công!"}

@app.get("/api/admin/yeu_cau")
def lay_danh_sach_yeu_cau():
    conn = lay_ket_noi()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM yeu_cau_them_ca ORDER BY id DESC")
    data = cursor.fetchall()
    for row in data:
        if row.get('thoi_gian_tao'):
            row['thoi_gian_tao'] = row['thoi_gian_tao'].strftime("%d/%m/%Y %H:%M")
    cursor.close(); conn.close()
    return data

# ==========================================
# PHÂN HỆ MQTT VÀ HẸN GIỜ TỰ ĐỘNG (BACKGROUND)
# ==========================================

# 1. Khởi tạo MQTT Client
mqtt_client = mqtt.Client(client_id="PythonServer_HoCa")

def on_connect(client, userdata, flags, rc):
    print("✅ Đã kết nối thành công tới Trạm trung chuyển MQTT (EMQX)!")
    client.subscribe("hoca_test/sensors")
    client.subscribe("hoca_test/status")
    
    # Ép tất cả các mạch ESP32 đang chạy phải báo cáo lại trạng thái Relay ngay lập tức
    client.publish("hoca_test/commands", "GET_STATUS")

def on_message(client, userdata, msg):
    payload = msg.payload.decode()
    topic = msg.topic
    print(f"📡 Nhận dữ liệu MQTT từ ESP32 [{topic}]: {payload}")
    
    try:
        data = json.loads(payload)
        conn = lay_ket_noi()
        if not conn: return
        cursor = conn.cursor(dictionary=True)
        
        # 1. Nếu là bản tin trạng thái nút bấm (Đèn/Bơm/Bơm Xả/Bơm Cấp)
        if topic == "hoca_test/status":
            den = data.get('trang_thai_den', 0)
            bom = data.get('trang_thai_bom', 0)
            bom_xa = data.get('trang_thai_bom_xa', 0)
            bom_cap = data.get('trang_thai_bom_cap', 0)
            relay_5 = data.get('trang_thai_relay_5', 0)
            cursor.execute("UPDATE cai_dat_ho SET trang_thai_den=%s, trang_thai_bom=%s, trang_thai_bom_xa=%s, trang_thai_bom_cap=%s, trang_thai_relay_5=%s WHERE id=1", (den, bom, bom_xa, bom_cap, relay_5))
            conn.commit()
            cursor.close(); conn.close()
            return

        # 2. Xử lý yêu cầu xin cấu hình từ ESP32 khi vừa khởi động
        if data.get('request') == 'GET_CONFIG':
            cursor.execute("SELECT sieu_am_day, sieu_am_tran FROM cai_dat_ho WHERE id=1")
            cd = cursor.fetchone()
            if cd:
                mqtt_client.publish("hoca_test/commands", f"CFG_W_{cd['sieu_am_day']}_{cd['sieu_am_tran']}")
            cursor.close(); conn.close()
            return
            
        # 3. Nếu là bản tin cảm biến định kỳ
        nhiet_do = data.get('nhiet_do', 0)
        do_ph = data.get('do_ph', 0)
        khoang_cach_do_duoc = data.get('muc_nuoc', 0) # Bản mới ESP32 gửi cm thô
        
        # Lưu vào MySQL
        conn = lay_ket_noi()
        if conn:
            cursor = conn.cursor(dictionary=True)
            cursor.execute("SELECT * FROM cai_dat_ho WHERE id = 1")
            cai_dat = cursor.fetchone()
            
            # --- CHUYỂN ĐỔI KHOẢNG CÁCH (CM) SANG PHẦN TRĂM (%) ---
            if cai_dat:
                day = cai_dat.get('sieu_am_day', 45.0)  # Khoảng cách từ siêu âm xuống đáy
                tran = cai_dat.get('sieu_am_tran', 38.0) # tran bây giờ lưu giá trị "Mực nước Max"
                
                chieu_cao_nuoc_hien_tai = day - khoang_cach_do_duoc
                if tran > 0:
                    muc_nuoc_pt = (chieu_cao_nuoc_hien_tai / tran) * 100.0
                else:
                    muc_nuoc_pt = 0
                muc_nuoc_pt = max(0.0, min(100.0, float(muc_nuoc_pt)))
            else:
                muc_nuoc_pt = 95.0
                
            cursor.execute("INSERT INTO du_lieu_cam_bien (nhiet_do, do_ph, muc_nuoc) VALUES (%s, %s, %s)", (nhiet_do, do_ph, muc_nuoc_pt))
            
            # --- LOGIC CHU TRÌNH THAY NƯỚC TỰ ĐỘNG ---
            if cai_dat:
                dang_thay = cai_dat.get('dang_thay_nuoc', 0)
                if dang_thay == 1:
                    muc_tieu_xa = cai_dat.get('muc_tieu_xa', 0.0)
                    bom_xa = cai_dat.get('trang_thai_bom_xa', 0)
                    bom_cap = cai_dat.get('trang_thai_bom_cap', 0)
                    
                    if bom_xa == 1 and (muc_nuoc_pt <= muc_tieu_xa):
                        print("✅ Đã xả đủ nước! Chuyển sang bơm cấp.")
                        mqtt_client.publish("hoca_test/commands", "BOMXA_OFF")
                        mqtt_client.publish("hoca_test/commands", "BOMCAP_ON")
                        cursor.execute("UPDATE cai_dat_ho SET trang_thai_bom_xa=0, trang_thai_bom_cap=1 WHERE id=1")
                        conn.commit()
                        
                    elif bom_cap == 1 and (muc_nuoc_pt >= 95.0):
                        print("✅ Đã cấp đầy nước! Hoàn tất chu trình thay nước.")
                        mqtt_client.publish("hoca_test/commands", "BOMCAP_OFF")
                        mqtt_client.publish("hoca_test/commands", "BOM_ON")
                        cursor.execute("UPDATE cai_dat_ho SET trang_thai_bom_cap=0, dang_thay_nuoc=0 WHERE id=1")
                        conn.commit()

            # --- LOGIC CẢNH BÁO THÔNG MINH ---
            if cai_dat:
                canh_bao_list = []
                dang_thay = cai_dat.get('dang_thay_nuoc', 0)
                
                if nhiet_do > cai_dat['nhiet_do_max']: canh_bao_list.append(("Nhiệt độ", f"Nhiệt độ hồ quá nóng ({nhiet_do}°C > {cai_dat['nhiet_do_max']}°C). Hãy giảm nhiệt."))
                elif nhiet_do < cai_dat['nhiet_do_min']: canh_bao_list.append(("Nhiệt độ", f"Nhiệt độ hồ quá thấp ({nhiet_do}°C < {cai_dat['nhiet_do_min']}°C). Hãy kiểm tra sưởi."))
                
                if do_ph > cai_dat['ph_max']: canh_bao_list.append(("Độ pH", f"Độ pH quá cao ({do_ph} > {cai_dat['ph_max']}). Môi trường kiềm cao."))
                elif do_ph < cai_dat['ph_min']: canh_bao_list.append(("Độ pH", f"Độ pH quá thấp ({do_ph} < {cai_dat['ph_min']}). Môi trường bị axit."))
                
                w_min = float(cai_dat.get('muc_nuoc_min', 30.0))
                if muc_nuoc_pt < w_min and dang_thay == 0: 
                    canh_bao_list.append(("Mực nước", f"Cảnh báo: Mực nước bốc hơi hụt quá ngưỡng an toàn ({muc_nuoc_pt:.0f}% < {w_min}%). Cần châm bù nước ngay!"))
                
                if len(canh_bao_list) > 0:
                    # Chống Spam CSDL: Lấy lịch sử 10 cảnh báo gần nhất trong 1 tiếng qua
                    cursor.execute("SELECT loai_canh_bao FROM lich_su_canh_bao WHERE thoi_gian_tao >= NOW() - INTERVAL 1 HOUR ORDER BY id DESC LIMIT 10")
                    cac_loai_da_canh_bao = [row['loai_canh_bao'] for row in cursor.fetchall()]
                    
                    for cb in canh_bao_list:
                        # Chỉ ghi DB nếu loại cảnh báo này chưa có trong 1 tiếng qua
                        if cb[0] not in cac_loai_da_canh_bao:
                            cursor.execute("INSERT INTO lich_su_canh_bao (loai_canh_bao, noi_dung) VALUES (%s, %s)", (cb[0], cb[1]))
                            
                    # Bắn còi MQTT
                    print("🚨 CÓ CẢNH BÁO MÔI TRƯỜNG! Đang rú còi...")
                    mqtt_client.publish("hoca_test/commands", "ALARM_ON")
                else:
                    # An toàn, tắt còi nếu đang kêu
                    mqtt_client.publish("hoca_test/commands", "ALARM_OFF")

            conn.commit()
    except Exception as e:
        print("Lỗi phân tích dữ liệu MQTT:", e)
    finally:
        # LUÔN LUÔN ĐÓNG KẾT NỐI ĐỂ KHÔNG LÀM TREO CLEVER CLOUD
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn:
            conn.close()

mqtt_client.on_connect = on_connect
mqtt_client.on_message = on_message

def is_in_time_range(start_str, end_str, current_str):
    if not start_str or not end_str: return False
    s = int(start_str.replace(":", ""))
    e = int(end_str.replace(":", ""))
    c = int(current_str.replace(":", ""))
    if s <= e:
        return s <= c < e
    else: # Qua nửa đêm
        return c >= s or c < e

# 2. Vòng lặp Hẹn giờ tự động (Chạy mỗi 1 phút)
def kiem_tra_hen_gio():
    conn = lay_ket_noi()
    if not conn: return
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM cai_dat_ho WHERE id = 1")
    cai_dat = cursor.fetchone()
    cursor.close(); conn.close()
    
    if not cai_dat: return
    
    gio_hien_tai = datetime.datetime.now().strftime("%H:%M")
    
    thu_hien_tai = str(datetime.datetime.now().weekday() + 2)
    if datetime.datetime.now().weekday() == 6: thu_hien_tai = "8" # Chủ nhật

    # Kiểm tra hẹn giờ đèn
    if cai_dat['che_do_den'] == 'auto_sensor':
        phut = datetime.datetime.now().hour * 60 + datetime.datetime.now().minute
        # 17h30 = 1050, 6h00 = 360
        phai_bat_den = (phut >= 1050 or phut < 360)
        if phai_bat_den and not cai_dat['trang_thai_den']:
            print("⏰ [Đèn] Đang trong khung giờ Auto (17h30-06h) -> BẬT!")
            mqtt_client.publish("hoca_test/commands", "DEN_ON")
        elif not phai_bat_den and cai_dat['trang_thai_den']:
            print("⏰ [Đèn] Ngoài khung giờ Auto (17h30-06h) -> TẮT!")
            mqtt_client.publish("hoca_test/commands", "DEN_OFF")

    elif cai_dat['che_do_den'] == 'timer':
        lich_thu = str(cai_dat.get('lich_den_thu', '2,3,4,5,6,7,8'))
        if thu_hien_tai in lich_thu:
            cac_moc_bat = str(cai_dat.get('hen_gio_den_bat', '')).split(',')
            cac_moc_tat = str(cai_dat.get('hen_gio_den_tat', '')).split(',')
            
            phai_bat_den = False
            for i in range(len(cac_moc_bat)):
                if i < len(cac_moc_tat) and cac_moc_bat[i] and cac_moc_tat[i]:
                    if is_in_time_range(cac_moc_bat[i][:5], cac_moc_tat[i][:5], gio_hien_tai):
                        phai_bat_den = True
                        break
            
            if phai_bat_den and not cai_dat['trang_thai_den']:
                print(f"⏰ [Đèn] Đang trong mốc giờ hẹn -> BẬT!")
                mqtt_client.publish("hoca_test/commands", "DEN_ON")
            elif not phai_bat_den and cai_dat['trang_thai_den']:
                print(f"⏰ [Đèn] Ngoài các mốc giờ hẹn -> TẮT!")
                mqtt_client.publish("hoca_test/commands", "DEN_OFF")
            
    # Kiểm tra hẹn giờ Bơm
    if cai_dat['che_do_bom'] == 'timer':
        lich_thu = str(cai_dat.get('lich_bom_thu', '2,3,4,5,6,7,8'))
        if thu_hien_tai in lich_thu:
            cac_moc_bat = str(cai_dat.get('hen_gio_bom_bat', '')).split(',')
            cac_moc_tat = str(cai_dat.get('hen_gio_bom_tat', '')).split(',')
            
            phai_bat_bom = False
            for i in range(len(cac_moc_bat)):
                if i < len(cac_moc_tat) and cac_moc_bat[i] and cac_moc_tat[i]:
                    if is_in_time_range(cac_moc_bat[i][:5], cac_moc_tat[i][:5], gio_hien_tai):
                        phai_bat_bom = True
                        break
            
            if phai_bat_bom and not cai_dat['trang_thai_bom']:
                print(f"⏰ [Bơm] Đang trong mốc giờ hẹn -> BẬT!")
                mqtt_client.publish("hoca_test/commands", "BOM_ON")
            elif not phai_bat_bom and cai_dat['trang_thai_bom']:
                print(f"⏰ [Bơm] Ngoài các mốc giờ hẹn -> TẮT!")
                mqtt_client.publish("hoca_test/commands", "BOM_OFF")
            
    # Kiểm tra Thay nước Tự động
    thu_hien_tai = str(datetime.datetime.now().weekday() + 2) # 0=Monday -> Thu 2
    
    lich_thu = str(cai_dat.get('lich_thay_nuoc_thu', ''))
    lich_gio = str(cai_dat.get('lich_thay_nuoc_gio', ''))[:5] if cai_dat.get('lich_thay_nuoc_gio') else ''
    phan_tram_thay = float(cai_dat.get('phan_tram_thay', 0))
    dang_thay = cai_dat.get('dang_thay_nuoc', 0)
    
    if (dang_thay == 0) and (phan_tram_thay > 0) and (thu_hien_tai in lich_thu) and (gio_hien_tai == lich_gio):
        print(f"⏰ ĐẾN GIỜ THAY NƯỚC TỰ ĐỘNG! Sẽ xả {phan_tram_thay}% nước.")
        
        cursor.execute("SELECT muc_nuoc FROM du_lieu_cam_bien ORDER BY id DESC LIMIT 1")
        cb = cursor.fetchone()
        muc_nuoc_hien_tai = cb['muc_nuoc'] if cb else 100.0
        
        muc_tieu = max(0.0, float(muc_nuoc_hien_tai) - phan_tram_thay)
        cursor.execute("UPDATE cai_dat_ho SET dang_thay_nuoc=1, muc_tieu_xa=%s WHERE id=1", (muc_tieu,))
        conn.commit()
        
        mqtt_client.publish("hoca_test/commands", "BOM_OFF") # Tắt máy lọc
        mqtt_client.publish("hoca_test/commands", "BOMXA_ON") # Bật bơm xả

# Khởi động MQTT và Scheduler khi ứng dụng chạy
@app.on_event("startup")
def startup_event():
    # Tự động cập nhật Database nếu thiếu cột
    conn = lay_ket_noi()
    if conn:
        cursor = conn.cursor()
        queries = [
            "ALTER TABLE cai_dat_ho ADD COLUMN sieu_am_day FLOAT DEFAULT 21.0",
            "ALTER TABLE cai_dat_ho ADD COLUMN sieu_am_tran FLOAT DEFAULT 3.0",
            "ALTER TABLE cai_dat_ho ADD COLUMN lich_thay_nuoc_thu VARCHAR(50) DEFAULT ''",
            "ALTER TABLE cai_dat_ho ADD COLUMN lich_thay_nuoc_gio TIME DEFAULT NULL",
            "ALTER TABLE cai_dat_ho ADD COLUMN phan_tram_thay FLOAT DEFAULT 0.0",
            "ALTER TABLE cai_dat_ho ADD COLUMN trang_thai_bom_xa BOOLEAN DEFAULT FALSE",
            "ALTER TABLE cai_dat_ho ADD COLUMN trang_thai_bom_cap BOOLEAN DEFAULT FALSE",
            "ALTER TABLE cai_dat_ho ADD COLUMN dang_thay_nuoc BOOLEAN DEFAULT FALSE",
            "ALTER TABLE cai_dat_ho ADD COLUMN muc_tieu_xa FLOAT DEFAULT 0.0",
            "ALTER TABLE cai_dat_ho ADD COLUMN lich_den_thu VARCHAR(50) DEFAULT '2,3,4,5,6,7,8'",
            "ALTER TABLE cai_dat_ho ADD COLUMN lich_bom_thu VARCHAR(50) DEFAULT '2,3,4,5,6,7,8'",
            "ALTER TABLE cai_dat_ho MODIFY COLUMN hen_gio_den_bat VARCHAR(50)",
            "ALTER TABLE cai_dat_ho MODIFY COLUMN hen_gio_den_tat VARCHAR(50)",
            "ALTER TABLE cai_dat_ho MODIFY COLUMN hen_gio_bom_bat VARCHAR(50)",
            "ALTER TABLE cai_dat_ho MODIFY COLUMN hen_gio_bom_tat VARCHAR(50)"
        ]
        for q in queries:
            try: cursor.execute(q)
            except: pass
        conn.commit()
        cursor.close(); conn.close()

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
