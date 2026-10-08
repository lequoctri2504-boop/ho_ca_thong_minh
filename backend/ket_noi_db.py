import mysql.connector
from mysql.connector import pooling
import os

# ============================================================
# BẢNG ĐIỀU KHIỂN CHẾ ĐỘ CHẠY (LOCAL / ONLINE)
# ============================================================
# - Điền "LOCAL" nếu bạn muốn test trên máy tính (XAMPP).
# - Điền "ONLINE" nếu bạn muốn dùng Database trên mạng (Clever Cloud).
CHE_DO_CHAY = "LOCAL"

# 1. Cấu hình Database ở máy cá nhân (XAMPP)
DB_LOCAL = {
    "host": "localhost",
    "user": "root",
    "password": "",
    "database": "he_thong_ho_ca"
}

# 2. Cấu hình Database trên đám mây (Clever Cloud)
DB_ONLINE = {
    "host": "bjjc3sm3ulz6oznnzcu3-mysql.services.clever-cloud.com",
    "user": "uxsy2s29vub5koqh",
    "password": "bvJ9nD5ttLhGY3zvWocC",
    "database": "bjjc3sm3ulz6oznnzcu3"
}
# ============================================================

db_pool = None

def get_pool():
    global db_pool
    
    # TINH TẾ: Nếu phát hiện code đang chạy trên máy chủ Render, 
    # hệ thống sẽ tự động ép sang chế độ ONLINE dù bạn quên đổi chữ LOCAL ở trên!
    if os.getenv("RENDER"):
        config = DB_ONLINE
    else:
        config = DB_ONLINE if CHE_DO_CHAY == "ONLINE" else DB_LOCAL

    if db_pool is None:
        try:
            db_pool = mysql.connector.pooling.MySQLConnectionPool(
                pool_name="hoca_pool",
                pool_size=3,                 # Chỉ dùng 3 luồng để chống ngập Clever Cloud
                pool_reset_session=True,
                host=config["host"],
                user=config["user"],
                password=config["password"],
                database=config["database"]
            )
        except Exception as e:
            print("Lỗi tạo hồ chứa kết nối:", e)
            db_pool = None
    return db_pool

def lay_ket_noi():
    pool = get_pool()
    if pool:
        try:
            return pool.get_connection()
        except Exception as e:
            print("Lỗi lấy kết nối Database:", e)
            return None
    return None
