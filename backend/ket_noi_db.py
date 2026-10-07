import mysql.connector
import os
from dotenv import load_dotenv

# Tải các biến môi trường từ file .env (nếu có)
load_dotenv()

def lay_ket_noi():
    try:
        conn = mysql.connector.connect(
            host=os.getenv("DB_HOST", "localhost"),
            user=os.getenv("DB_USER", "root"),
            password=os.getenv("DB_PASSWORD", ""), 
            database=os.getenv("DB_NAME", "he_thong_ho_ca")
        )
        return conn
    except Exception as e:
        print("Loi ket noi CSDL:", e)
        return None
