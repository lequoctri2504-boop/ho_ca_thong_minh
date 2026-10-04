import sys
sys.path.append('e:/IOT/ho_ca_test/backend')
from ket_noi_db import lay_ket_noi

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
        "ALTER TABLE cai_dat_ho ADD COLUMN trang_thai_relay_5 BOOLEAN DEFAULT FALSE"
    ]
    for q in queries:
        try:
            cursor.execute(q)
            print("Chạy thành công:", q)
        except Exception as e:
            print("Đã tồn tại hoặc lỗi:", e)
    
    conn.commit()
    cursor.close()
    conn.close()
    print("Hoàn tất cập nhật DB.")
