import mysql.connector

def lay_ket_noi():
    try:
        conn = mysql.connector.connect(
            host="localhost",
            user="root",
            password="", # Mặc định XAMPP không có mật khẩu
            database="he_thong_ho_ca"
        )
        return conn
    except Exception as e:
        print("Loi ket noi CSDL:", e)
        return None
