import mysql.connector
from mysql.connector import pooling
import os
from dotenv import load_dotenv

load_dotenv()

db_pool = None

def get_pool():
    global db_pool
    if db_pool is None:
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
            print("Lỗi tạo pool kết nối:", e)
            db_pool = None
    return db_pool

def lay_ket_noi():
    pool = get_pool()
    try:
        if pool:
            return pool.get_connection()
        else:
            # Fallback: Nếu Pool sập, thử kết nối trực tiếp
            return mysql.connector.connect(
                host=os.getenv("DB_HOST", "localhost"),
                user=os.getenv("DB_USER", "root"),
                password=os.getenv("DB_PASSWORD", ""), 
                database=os.getenv("DB_NAME", "he_thong_ho_ca")
            )
    except Exception as e:
        print("Lỗi kết nối CSDL:", e)
        return None
