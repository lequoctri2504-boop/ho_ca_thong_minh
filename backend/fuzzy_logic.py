import numpy as np
import skfuzzy as fuzz
from skfuzzy import control as ctrl

# 1. KHỞI TẠO CÁC BIẾN (Antecedents & Consequent)
# delta_temp: Độ chênh lệch nhiệt độ so với ngưỡng chuẩn (Đơn vị: °C)
# Ví dụ: Mức chuẩn là 22-28. Nếu bể 30°C -> delta_temp = +2. Nếu bể 20°C -> delta_temp = -2.
delta_temp = ctrl.Antecedent(np.arange(-10, 11, 1), 'delta_temp')

# delta_ph: Độ chênh lệch pH so với ngưỡng chuẩn
delta_ph = ctrl.Antecedent(np.arange(-3, 4, 0.1), 'delta_ph')

# do_phu_hop: Mức độ an toàn/phù hợp môi trường (0% đến 100%)
do_phu_hop = ctrl.Consequent(np.arange(0, 101, 1), 'do_phu_hop')

# 2. ĐỊNH NGHĨA CÁC TẬP MỜ (Membership Functions)

# Hàm liên thuộc cho Nhiệt độ
delta_temp['qua_lanh'] = fuzz.trapmf(delta_temp.universe, [-10, -10, -5, -3])
delta_temp['hoi_lanh'] = fuzz.trimf(delta_temp.universe, [-4, -2, 0])
delta_temp['chuan'] = fuzz.trapmf(delta_temp.universe, [-1, 0, 0, 1])
delta_temp['hoi_nong'] = fuzz.trimf(delta_temp.universe, [0, 2, 4])
delta_temp['qua_nong'] = fuzz.trapmf(delta_temp.universe, [3, 5, 10, 10])

# Hàm liên thuộc cho pH
delta_ph['qua_chua'] = fuzz.trapmf(delta_ph.universe, [-3, -3, -1.5, -1.0])
delta_ph['hoi_chua'] = fuzz.trimf(delta_ph.universe, [-1.2, -0.5, 0])
delta_ph['chuan'] = fuzz.trapmf(delta_ph.universe, [-0.2, 0, 0, 0.2])
delta_ph['hoi_kiem'] = fuzz.trimf(delta_ph.universe, [0, 0.5, 1.2])
delta_ph['qua_kiem'] = fuzz.trapmf(delta_ph.universe, [1.0, 1.5, 3, 3])

# Hàm liên thuộc cho Độ phù hợp (Output)
do_phu_hop['nguy_hiem'] = fuzz.trapmf(do_phu_hop.universe, [0, 0, 20, 40])
do_phu_hop['rui_ro'] = fuzz.trimf(do_phu_hop.universe, [30, 50, 70])
do_phu_hop['an_toan'] = fuzz.trapmf(do_phu_hop.universe, [60, 80, 100, 100])

# 3. THIẾT LẬP LUẬT MỜ (Fuzzy Rules)
# Một số quy tắc cơ bản (Bạn có thể tinh chỉnh hoặc thêm bớt sau)
rule1 = ctrl.Rule(delta_temp['chuan'] & delta_ph['chuan'], do_phu_hop['an_toan'])
rule2 = ctrl.Rule(delta_temp['qua_lanh'] | delta_temp['qua_nong'], do_phu_hop['nguy_hiem'])
rule3 = ctrl.Rule(delta_ph['qua_chua'] | delta_ph['qua_kiem'], do_phu_hop['nguy_hiem'])
rule4 = ctrl.Rule(delta_temp['hoi_nong'] & delta_ph['chuan'], do_phu_hop['rui_ro'])
rule5 = ctrl.Rule(delta_temp['chuan'] & delta_ph['hoi_chua'], do_phu_hop['rui_ro'])
rule6 = ctrl.Rule(delta_temp['hoi_lanh'] & delta_ph['hoi_kiem'], do_phu_hop['nguy_hiem']) # Cộng gộp 2 cái rủi ro -> Nguy hiểm

# Tạo Hệ thống điều khiển mờ
he_thong_tu_van = ctrl.ControlSystem([rule1, rule2, rule3, rule4, rule5, rule6])
bo_mo_phong = ctrl.ControlSystemSimulation(he_thong_tu_van)

def tinh_toan_fuzzy(nhiet_do_hien_tai, nhiet_min, nhiet_max, ph_hien_tai, ph_min, ph_max):
    """
    Hàm nhận dữ liệu thực tế và dữ liệu lý thuyết để tính toán % phù hợp.
    """
    # Tính Delta Nhiệt
    if nhiet_do_hien_tai < nhiet_min:
        d_temp = nhiet_do_hien_tai - nhiet_min
    elif nhiet_do_hien_tai > nhiet_max:
        d_temp = nhiet_do_hien_tai - nhiet_max
    else:
        d_temp = 0 # Nằm trong vùng chuẩn
        
    # Tính Delta pH
    if ph_hien_tai < ph_min:
        d_ph = ph_hien_tai - ph_min
    elif ph_hien_tai > ph_max:
        d_ph = ph_hien_tai - ph_max
    else:
        d_ph = 0 # Nằm trong vùng chuẩn

    # Truyền vào mô hình
    bo_mo_phong.input['delta_temp'] = d_temp
    bo_mo_phong.input['delta_ph'] = d_ph
    
    try:
        # Chạy thuật toán
        bo_mo_phong.compute()
        diem_phu_hop = bo_mo_phong.output['do_phu_hop']
    except Exception as e:
        diem_phu_hop = 0
        
    # Làm tròn điểm và ép kiểu về float thuần của Python để tránh lỗi JSON Serialize của FastAPI
    diem_phu_hop = float(round(diem_phu_hop, 1))
    
    # Kết luận bằng chữ
    if diem_phu_hop >= 70:
        danh_gia = "An Toàn"
    elif diem_phu_hop >= 40:
        danh_gia = "Rủi Ro / Chấp nhận được"
    else:
        danh_gia = "Nguy Hiểm"
        
    return {
        "diem_phu_hop": diem_phu_hop,
        "danh_gia": danh_gia,
        "delta_temp": float(round(d_temp, 2)),
        "delta_ph": float(round(d_ph, 2))
    }

# Code test chạy thử hàm
if __name__ == "__main__":
    # Test: Cá bảy màu (Nhiệt: 22-28, pH: 6.5-7.5)
    # Bể thực tế: Nhiệt 30 (nóng +2 độ), pH 7.0 (chuẩn)
    kq = tinh_toan_fuzzy(30, 22, 28, 7.0, 6.5, 7.5)
    print("Kết quả tính toán Fuzzy:", kq)
