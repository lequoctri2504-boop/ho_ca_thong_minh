import mysql.connector
from mysql.connector import pooling
import os
from dotenv import load_dotenv

load_dotenv()

# Khởi tạo Hồ chứa kết nối (Connection Pool) siêu thông minh
# Chỉ cho phép tối đa 3 luồng kết nối chạy song song, ai đến sau phải đứng xếp hàng chờ!
try:
    db_pool = mysql.connector.pooling.MySQLConnectionPool(
        pool_name="hoca_pool",
        pool_size=3,
        pool_reset_session=True,
        host=os.getenv("DB_HOST", "localhost"),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASSWORD", ""), 
        database=os.getenv("DB_NAME", "he_thong_ho_ca")
    )
except Exception as e:
    print("Không thể khởi tạo Pool Kết nối:", e)
    db_pool = None

def lay_ket_noi():
    try:
        if db_pool:
            # Lấy 1 kết nối đang rảnh từ trong Pool ra xài
            return db_pool.get_connection()
        else:
            return None
    except Exception as e:
        print("Loi lay ket noi tu Pool (Hang doi qua tai):", e)
        return None
