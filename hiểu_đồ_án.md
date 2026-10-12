# 📘 TÀI LIỆU TOÀN DIỆN: KIẾN TRÚC & NGHIỆP VỤ HỆ THỐNG HỒ CÁ THÔNG MINH (AQUAAI IOT)

> **Mục đích tài liệu:** Đây là "bộ nhớ dự án" (Single Source of Truth). Bất kỳ khi nào bắt đầu phiên làm việc mới, Agent AI chỉ cần đọc file này là nắm rõ 100% kiến trúc, công nghệ, thiết bị phần cứng, thuật toán AI, cơ sở dữ liệu và các quy tắc nghiệp vụ của toàn bộ hệ thống.

---

## 1. TỔNG QUAN ĐỀ TÀI & PHẠM VI NGHIÊN CỨU
* **Tên đề án / Luận văn:** Hệ thống Giám sát & Quản trị Hồ cá Thông minh Ứng dụng IoT, Hệ Chuyên Gia Mờ (Fuzzy Logic), Thị Giác Máy Tính (YOLOv8) và Trợ Lý Ảo Sinh Thái (RAG + Ollama).
* **Phạm vi ứng dụng:** Hồ cá cảnh nước ngọt nhiệt đới (Đặc thù tối ưu cho khí hậu Miền Nam Việt Nam - nước ấm 24°C - 30°C).
* **Mục tiêu chính:** 
  1. Tự động hóa toàn diện việc đo đạc môi trường, hẹn giờ thiết bị và thay nước tự động an toàn.
  2. Ứng dụng Trí tuệ Nhân tạo để nhận diện loài cá qua camera, tư vấn sinh thái 3 lớp (Môi trường - Mật độ Bioload - Tập tính xã hội) và giải đáp thắc mắc bằng Chatbot AI.
  3. Quản trị thiết bị IoT từ xa qua WiFi: Nạp Firmware OTA không dây không cần cắm cáp, điều khiển thiết bị không độ trễ.

---

## 2. KIẾN TRÚC TỔNG THỂ HỆ THỐNG (SYSTEM ARCHITECTURE)

```
       [ CẢM BIẾN ]                        [ THIẾT BỊ CHẤP HÀNH ]
  - DS18B20 (Nhiệt độ)                - Rơ-le 1: Đèn LED hồ cá
  - DIYMORE PH-4502C (pH)             - Rơ-le 2: Máy lọc nước chính
  - HC-SR04 (Siêu âm mực nước)        - Rơ-le 3: Máy bơm xả nước
  - 5 Nút bấm vật lý                  - Rơ-le 4: Máy bơm cấp nước
  - OLED 0.96" SSD1306                - Rơ-le 5: Thiết bị phụ trợ
                                      - Còi Buzzer (Báo động chu kỳ)
                     │                               ▲
                     ▼                               │
             ┌──────────────────────────────────────────────┐
             │       MẠCH VI ĐIỀU KHIỂN ESP32 (EDGE)        │
             │ - Lọc Median siêu âm  - Watchdog Timer (20s) │
             │ - Zero-Latency AutoStop  - Fail-Safe ngắt rơ-le│
             │ - WiFiManager (AP)    - ElegantOTA (Port 80) │
             └──────────────────────────────────────────────┘
                                     │
                     Giao thức MQTT (JSON Payloads)
                   Broker: broker.emqx.io (Port 1883)
                                     │
                                     ▼
             ┌──────────────────────────────────────────────┐
             │            BACKEND SERVER (PYTHON)           │
             │ - Framework: FastAPI + Uvicorn (Port 8000)   │
             │ - Lập lịch: APScheduler (Quét hẹn giờ 1 phút)│
             │ - AI Vision: YOLOv8 PyTorch (best.pt)        │
             │ - Hệ chuyên gia: Fuzzy Logic Scikit-Fuzzy    │
             │ - Tư vấn 3 lớp: Môi trường, Bioload, Xã hội  │
             │ - Chatbot Sinh thái: RAG + Ollama Qwen2.5:3b │
             │ - CSDL: MySQL (Clever Cloud / Localhost)     │
             └──────────────────────────────────────────────┘
                                     ▲
                     HTTP RESTful API / WebSocket
                                     │
             ┌──────────────────────────────────────────────┐
             │           FRONTEND GIAO DIỆN NGƯỜI DÙNG      │
             │ - Giao diện Khách: index.html + script.js    │
             │   (Giám sát IoT, Đàn cá, AI Scan, Chat RAG)  │
             │ - Giao diện Quản trị: admin.html + admin.js  │
             │   (Từ điển 21 loài cá, Quản lý OTA, MLOps,   │
             │    Giám sát máy chủ, Dọn dẹp dữ liệu)        │
             │ - 100% Responsive cho PC & Điện thoại (LAN) │
             └──────────────────────────────────────────────┘
```

---

## 3. CHI TIẾT PHẦN CỨNG & XỬ LÝ TẠI BIÊN (ESP32 FIRMWARE)

### 3.1. Sơ đồ đấu nối chân (Pinout Mapping)
* **Cảm biến nhiệt độ nước:** `DS18B20` nối chân `GPIO 4` (giao tiếp 1-Wire, có trở treo 4.7kΩ).
* **Cảm biến siêu âm mực nước:** `HC-SR04` (hoặc JSN-SR04T chống nước) - `TRIG: GPIO 5`, `ECHO: GPIO 18`.
* **Cảm biến đo độ pH:** `DIYMORE PH-4502C` - ngõ Analog out nối chân `GPIO 35` (ADC1).
* **Màn hình hiển thị:** `OLED 0.96 inch I2C SSD1306` - `SDA: GPIO 21`, `SCL: GPIO 22`.
* **Còi báo động:** `Active Buzzer` nối chân `GPIO 2`.
* **5 Rơ-le điều khiển thiết bị:**
  * Rơ-le 1 (Đèn): `GPIO 13`
  * Rơ-le 2 (Bơm lọc chính): `GPIO 12`
  * Rơ-le 3 (Bơm xả nước): `GPIO 14`
  * Rơ-le 4 (Bơm cấp nước): `GPIO 27`
  * Rơ-le 5 (Thiết bị mở rộng): `GPIO 26`
* **5 Nút bấm vật lý (Kéo trở nội PULLUP):**
  * Nút 1: `GPIO 32` (Nhấn giữ 3s lúc khởi động để xóa cấu hình WiFi)
  * Nút 2: `GPIO 33`
  * Nút 3: `GPIO 25`
  * Nút 4: `GPIO 19`
  * Nút 5: `GPIO 23` (Nhấn nhả đảo Relay 5; **Nhấn giữ 1.5s để Tắt còi khẩn cấp - Snooze 5 phút**)

### 3.2. Các thuật toán & Cơ chế bảo vệ an toàn tại biên (Edge Fail-Safe)
1. **Bộ lọc Trung vị (Median Filter) chống nhiễu sóng siêu âm:**
   * HC-SR04 trong không gian hẹp hồ kính dễ bị phản xạ tiếng vang bề mặt gợn sóng.
   * ESP32 lấy mẫu liên tục 9 lần, sắp xếp thuật toán Bubble Sort, loại bỏ giá trị cực đại và cực tiểu, lấy trung bình các giá trị ổn định ở giữa.
2. **Cơ chế ngắt bơm độ trễ bằng 0 (Zero-Latency Edge Auto-Stop):**
   * Khi thay nước, Server gửi lệnh kèm mục tiêu: `BOMXA_TARGET_<pct>` hoặc `BOMCAP_TARGET_<pct>`.
   * ESP32 tự động tăng tốc độ đọc siêu âm lên **250ms/lần (4 lần/giây)**.
   * Vừa chạm ngưỡng phần trăm mục tiêu (có trừ hao 0.5% quán tính dòng chảy), ESP32 **TỰ ĐỘNG NGẮT RƠ-LE TẠI CHỖ**, không phụ thuộc mạng, triệt tiêu 100% lỗi hút lố nước.
3. **Bảo vệ ngắt khẩn cấp (Fail-Safe Hardware Interlocks):**
   * Chống cháy bơm xả: Nếu cột nước rút sát đáy (`<= 2.5cm`), ESP32 cưỡng bức tắt Bơm Xả ngay lập tức.
   * Chống tràn bơm cấp: Nếu cột nước dâng sát trần cảm biến (`<= 2.5cm` hoặc `pt >= 96%`), ESP32 cưỡng bức tắt Bơm Cấp.
   * Mất mạng (Link-Loss Fail-Safe): Nếu đang bơm nước mà đứt mạng WiFi hoặc mất kết nối MQTT, mạch tự động ngắt cả 2 bơm xả/cấp để phòng ngừa rủi ro.
4. **Còi báo động chu kỳ & Nút Snooze:**
   * Còi không kêu liên tục gây chói tai mà hú theo chu kỳ (Hú 10s -> Nghỉ 30s -> Lặp lại).
   * Giữ nút cứng số 5 trong 1.5 giây hoặc bấm nút trên Web để tạm ngưng còi 5 phút (Snooze).
5. **Cơ chế chống treo chip Watchdog Timer (WDT 20 giây):**
   * Sử dụng `<esp_task_wdt.h>`. Nếu chip bị đơ hoặc kẹt vòng lặp quá 20s, WDT sẽ tự động khởi động lại phần cứng (Hardware Reboot).
6. **Cập nhật Firmware không dây (ElegantOTA) & WiFiManager:**
   * Web Server nội bộ mở cổng 80 tại `http://<IP_ESP32>/update` cho phép nạp file `.bin` qua WiFi.
   * WiFiManager tự phát AP `HO_CA_THONG_MINH_CONFIG` (192.168.4.1) khi đổi mạng mới.

---

## 4. HẠ TẦNG TRUYỀN THÔNG & GIAO THỨC MQTT
* **MQTT Broker:** `broker.emqx.io` (Cổng TCP `1883`, miễn phí, ổn định cao).
* **Topic cảm biến (`hoca_test/sensors`):** ESP32 publish định kỳ (bình thường: 60s, khi đang bơm nước: 1s):
  ```json
  {"nhiet_do": 28.5, "do_ph": 7.2, "muc_nuoc": 12.4, "ip": "192.168.1.15"}
  ```
* **Topic trạng thái rơ-le (`hoca_test/status`):** ESP32 báo cáo khi có thay đổi trạng thái nút bấm:
  ```json
  {"trang_thai_den": 1, "trang_thai_bom": 1, "trang_thai_bom_xa": 0, "trang_thai_bom_cap": 0, "trang_thai_relay_5": 0, "ip": "192.168.1.15"}
  ```
* **Topic lệnh điều khiển (`hoca_test/commands`):** Server publish xuống ESP32:
  * Thiết bị: `DEN_ON`, `DEN_OFF`, `BOM_ON`, `BOM_OFF`, `BOM5_ON`, `BOM5_OFF`
  * Thay nước: `BOMXA_TARGET_<pct>`, `BOMCAP_TARGET_<pct>`, `BOMXA_OFF`, `BOMCAP_OFF`
  * Đồng bộ thông số hồ: `CFG_W_<day>_<tran>` (chiều cao hồ), `CFG_PH_<offset>`, `CFG_ALARM_<en>_<on>_<off>_<sn>`
  * Hệ thống: `ESP_RESTART` (Khởi động lại chip từ xa), `GET_STATUS`

---

## 5. BACKEND PYTHON (FASTAPI + AI CORE)

### 5.1. Ngăn xếp công nghệ Backend
* **Runtime:** Python 3.11 (môi trường ảo idf5.5_py3.11_env).
* **Framework:** FastAPI, Uvicorn ASGI Server (Port `8000`, lắng nghe `0.0.0.0` hỗ trợ mạng LAN).
* **Thư viện chính:** `paho-mqtt` (chuẩn Callback VERSION2), `mysql-connector-python`, `apscheduler` (BackgroundScheduler quét lịch hẹn giờ mỗi 1 phút), `ultralytics` (YOLOv8), `scikit-fuzzy`, `requests`, `python-multipart`.

### 5.2. Các phân hệ Trí tuệ Nhân tạo (AI Core)

#### Lớp 1: Thị giác máy tính nhận diện loài cá (YOLOv8)
* File model: `backend/best.pt`.
* Người dùng chụp ảnh hoặc tải ảnh lên -> FastAPI lưu vào `uploads/` -> Gọi hàm `nhan_dien_ca()` trả về mã loài cá và độ tin cậy `%`.
* Dữ liệu nhận diện được lưu vào bảng `lich_su_ai` phục vụ quy trình MLOps thu thập Dataset.

#### Lớp 2: Hệ chuyên gia Fuzzy Logic (Độ mờ sinh thái)
* Đầu vào: Nhiệt độ nước thực tế và độ pH thực tế từ cảm biến.
* **Quy chuẩn miền Nam Việt Nam:** Khí hậu nhiệt đới nước ấm, ngưỡng nhiệt độ yêu cầu của sách vở được tự động bù `+2.0°C` để phù hợp với thực tế sinh thái bản địa.
* Hàm `tinh_toan_fuzzy()` tính toán độ dốc hình thang/tam giác trả về Điểm phù hợp (0 - 100 điểm) và cảnh báo độ lệch.

#### Lớp 3: Thuật toán Siêu tư vấn 3 lớp chuyên sâu
1. **Lớp Môi Trường (Fuzzy Logic):** Đánh giá nhiệt độ & pH có làm cá bị sốc nước không.
2. **Lớp Mật Độ (Tải trọng sinh học Bioload):**
   * Tính thể tích nước thực tế của hồ: `(Dài * Rộng * Cao) / 1000 * 0.88` (trừ hao 12% phân nền, kính, đá lũa).
   * Nhân hệ số loại lọc (Lọc thác = 1.0, lọc vi sinh = 0.8, lọc thùng = 1.3) và cây thủy sinh (+20% sức chứa).
   * Tính tổng Bioload của đàn cá cũ kết hợp cá định mua thêm: `∑ (Kích_thước³ * Hệ_số_bioload * Số_lượng * 0.05)`.
   * Phân loại: `<= 100%`: Lý tưởng; `100 - 250%`: Nuôi đông (cần thay nước 30%/tuần); `> 250%`: Quá tải độc hại, cảnh báo tử vong do Amoniac.
3. **Lớp Xã Hội & Tập Tính Bầy Đàn:**
   * Tập tính bầy đàn tối thiểu: Các loài như Neon, Sọc ngựa, Tam giác bắt buộc thả `>= 6 con` để tránh stress suy kiệt.
   * Xung đột vây & săn mồi: Cảnh báo cá hung dữ (La Hán, Cá Rồng, Betta) hoặc cá hay rỉa vây (Tứ Vân, Hồng Nhung) khi nuôi chung với cá vây dài (Ba Đuôi, Bảy Màu, Thiên Thần).
   * Tầng bơi sinh thái: Cảnh báo cạnh tranh thức ăn nếu thả trùng cá ở Tầng Mặt, Tầng Giữa hoặc Tầng Đáy.

#### Lớp 4: Trợ lý ảo AI Chatbot RAG + Ollama LLM
* Mô hình sử dụng: `qwen2.5:3b` chạy trên Ollama máy tính nội bộ.
* **RAG (Retrieval-Augmented Generation):** Backend tự động trích xuất thông số cảm biến mới nhất (Nhiệt độ, pH hiện tại) cùng danh sách cá đang nuôi trong hồ để tiêm vào System Prompt của LLM.
* Kết quả: Chatbot giải đáp tự nhiên, sát thực tế hồ cá, tuyệt đối không bị ảo giác số liệu.

---

## 6. CƠ SỞ DỮ LIỆU MYSQL SCHEMA

Hệ thống sử dụng cơ sở dữ liệu `he_thong_ho_ca` với các bảng dữ liệu cốt lõi:

| Tên Bảng | Vai Trò & Mô Tả Nghiệp Vụ | Các Cột Dữ Liệu Quan Trọng |
| :--- | :--- | :--- |
| `cai_dat_ho` | Lưu cấu hình hồ, ngưỡng cảnh báo, lịch hẹn giờ và cờ trạng thái chu trình | `id`, `nhiet_do_min/max`, `ph_min/max`, `muc_nuoc_min`, `chieu_dai/rong/cao`, `chu_ky_gui_data`, `trang_thai_den/bom`, `hen_gio_...`, `sieu_am_day/tran`, `phan_tram_thay`, `lich_thay_nuoc_gio/thu`, `dang_thay_nuoc`, `muc_tieu_xa`, `tu_dong_cap_lai`, `coi_enable/on_sec/off_sec/snooze_min`, `ph_offset` |
| `du_lieu_cam_bien` | Lịch sử đo đạc từ ESP32 | `id`, `nhiet_do`, `do_ph`, `muc_nuoc`, `thoi_gian_tao` |
| `loai_ca` | Từ điển chuẩn 21 loài cá dùng cho AI Fuzzy & Bioload | `id`, `ma_loai`, `ten_hien_thi`, `ten_tieng_anh`, `ten_khoa_hoc`, `nhiet_do_min/max`, `ph_min/max`, `the_tich_yeu_cau`, `tinh_cach`, `kich_thuoc_adult`, `he_so_bioload`, `kieu_vay`, `tang_boi`, `so_luong_bay_min`, `nguon_trich_dan`, `mo_ta` |
| `ca_dang_nuoi` | Danh sách đàn cá thực tế đang bơi trong hồ của người dùng | `id`, `id_loai_ca`, `so_luong`, `ngay_tha` |
| `lich_su_ai` | Dữ liệu hình ảnh chụp nhận diện cá (phục vụ MLOps) | `id`, `duong_dan_anh`, `id_loai_ca`, `do_chinh_xac`, `phu_hop_khong`, `thoi_gian_tao` |
| `lich_su_canh_bao` | Nhật ký các lần cảnh báo bất thường (có cơ chế chống spam 1h) | `id`, `loai_canh_bao`, `noi_dung`, `thoi_gian_tao` |
| `yeu_cau_them_ca` | Danh sách loài cá khách tìm kiếm chưa có trong từ điển | `id`, `ten_ca_khach_nhap`, `trang_thai`, `thoi_gian_tao` |

---

## 7. GIAO DIỆN NGƯỜI DÙNG (FRONTEND ARCHITECTURE)

### 7.1. Trang Khách hàng (`frontend/index.html` & `script.js`)
* **Tổng quan IoT:** Thẻ cảm biến Nhiệt độ, pH, Mực nước (OLED & Progress bar sinh động); Biểu đồ Chart.js lịch sử; Bảng cảnh báo môi trường kèm nút tắt còi tạm thời (Snooze).
* **Tư vấn cá thông minh:**
  * Chế độ AI Camera: Kéo thả/chụp ảnh -> Nhận diện loài cá -> Đánh giá 3 lớp môi trường/mật độ/tập tính.
  * Chế độ Tra cứu thủ công: Chọn loài cá và số lượng định thả -> Trả kết quả tức thì.
  * Đề xuất cá phù hợp: AI tự động phân tích hồ hiện tại và gợi ý top 3 loài cá thích hợp nhất để mua thêm.
* **Quản lý Đàn cá:** Thống kê tổng số cá, tỷ lệ tải sinh học Bioload (%); Thêm/bớt/xóa cá đang nuôi.
* **Điều khiển & Hẹn giờ Thiết bị:**
  * Công tắc Rơ-le Đèn, Bơm lọc, Bơm xả, Bơm cấp kèm phản hồi trạng thái từ ESP32.
  * Hẹn giờ Đèn & Bơm theo nhiều mốc thời gian và ngày trong tuần.
  * Hẹn giờ thay nước tự động chuẩn 24 Giờ: Chọn giờ (00-23h), phút (00-55p), chu kỳ lặp lại hằng ngày hoặc theo thứ.
  * Thay nước thủ công: Tùy chọn rút % nước (Bơm xả ngắt tại biên); Tùy chọn xả cạn 2.5cm dọn hồ; Tùy chọn tự động bơm cấp bù lại.
  * Hiệu chuẩn cảm biến pH theo dung dịch mẫu 7.0 (tự tính offset).
* **Trợ lý ảo AI Chatbot (Widget nổi góc phải):** Chatbot tương tác tự nhiên, trả lời dựa trên RAG dữ liệu hồ thực tế.

### 7.2. Trang Quản trị viên (`frontend/admin.html` & `admin.js`)
* **Tab 1: Quản lý Từ điển Sinh thái Cá (Knowledge Base):**
  * Bảng dữ liệu hiển thị toàn bộ 17 trường sinh học của 21 loài cá.
  * Ô tìm kiếm Live Search (theo tên tiếng Việt, tiếng Anh, tên Latin, mã loài).
  * Bộ lọc nhanh theo Tính cách (Hòa bình, Hung dữ, Rỉa vây) và Tầng bơi (Mặt, Giữa, Đáy).
  * Modal Thêm/Sửa cá đầy đủ các trường Kích thước, Bioload, Bầy đàn, Kiểu vây, Nguồn trích dẫn.
* **Tab 2: Quản lý ESP32 & Nạp OTA Không Dây:**
  * Tự động nhận diện IP của ESP32 qua MQTT, huy hiệu Online/Offline thời gian thực.
  * Nút **Khởi động lại ESP32 từ xa** (`ESP_RESTART`).
  * Vùng kéo thả file `.bin` nạp Firmware OTA trực tiếp từ trình duyệt, có thanh tiến trình % và Log Console.
  * Link mở giao diện ElegantOTA trực tiếp `http://<IP_ESP32>/update`.
  * Hướng dẫn từng bước biên dịch file `.bin` trong Arduino IDE (`Ctrl + Alt + S`).
* **Tab 3: MLOps & Lịch sử Nhận diện AI:**
  * Xem danh sách ảnh người dùng tải lên kèm tên cá dự đoán, độ tin cậy và Thumbnail phóng to.
  * Nút "Tải về Dataset" để Admin thu thập ảnh phục vụ tái huấn luyện (Re-train) mô hình YOLOv8.
* **Tab 4: Trạng thái Hệ thống & Dọn dẹp CSDL:**
  * Giám sát kết nối Broker EMQX, CSDL MySQL, tổng bản ghi cảm biến.
  * Công cụ dọn dẹp dữ liệu cảm biến cũ (>7, >15, >30, >60 ngày) bằng 1 click để giải phóng bộ nhớ.
* **Tab 5: Yêu cầu từ Khách hàng:**
  * Xem danh sách loài cá khách gõ nhưng chưa có.
  * Nút "Thêm vào DB" tự động điền sẵn tên và tạo mã slug (VD: `ca_ping_pong`).

### 7.3. Thiết kế Responsive & Mạng Nội Bộ (LAN)
* Header cố định (Mobile Topbar) kèm logo và nút Hamburger mở ngăn kéo (Off-canvas Drawer & Backdrop blur).
* Tự động thích ứng đa màn hình (Desktop, Tablet, Smartphone).
* Cơ chế tự động giải quyết URL thông minh (`API_BASE_URL`): Hoạt động hoàn hảo dù mở qua `http://localhost:8000`, qua IP mạng WiFi nội bộ `http://192.168.x.x:8000/frontend/...`, hoặc nhấp đúp file từ ổ đĩa `file:///`.

---

## 8. HƯỚNG DẪN KHỞI CHẠY & VẬN HÀNH HỆ THỐNG

### 8.1. Khởi chạy Server Python Backend
Mở Command Prompt hoặc PowerShell tại thư mục `backend`:
```powershell
cd e:\IOT\luan_van_ho_ca\ho_ca_thong_minh\backend
python chay_server.py
```
*Server sẽ mở tại `http://0.0.0.0:8000`, tự động kết nối MQTT broker.emqx.io, kích hoạt APScheduler và mount thư mục frontend.*

### 8.2. Mở Giao diện Web
* **Trên máy tính (Localhost):**
  * Trang Khách: [http://localhost:8000/frontend/index.html](http://localhost:8000/frontend/index.html)
  * Trang Quản trị: [http://localhost:8000/frontend/admin.html](http://localhost:8000/frontend/admin.html)
* **Trên điện thoại di động (Cùng mạng WiFi):**
  * Lấy IP máy tính bằng lệnh `ipconfig` (VD: `192.168.1.25`).
  * Mở trình duyệt trên điện thoại truy cập: `http://192.168.1.25:8000/frontend/index.html`

### 8.3. Nạp Code cho ESP32
* **Lần đầu (Cắm cáp USB):** Nạp qua Arduino IDE cổng COM thông thường.
* **Các lần sau (Nạp không dây OTA):** 
  1. Trong Arduino IDE, nhấn `Sketch -> Export Compiled Binary` (hoặc `Ctrl + Alt + S`).
  2. Vào trang Admin -> Tab **Quản lý ESP32 (OTA)**.
  3. Kéo file `.bin` vừa xuất vào ô nạp và nhấn **Bắt đầu Nạp Firmware OTA**.

---
*Tài liệu được khởi tạo và đồng bộ tự động bởi Antigravity Pair Programmer.*
