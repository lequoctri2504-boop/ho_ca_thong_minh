#include <WiFi.h>
#include <WiFiManager.h>      // Tự động phát AP cấu hình WiFi Captive Portal
#include <WebServer.h>        // WebServer nội bộ cho ESP32
#include <ElegantOTA.h>       // Cập nhật Firmware qua WiFi không cần cắm cáp
#include <esp_task_wdt.h>     // Watchdog Timer (WDT) chống treo vi điều khiển 24/7
#include <PubSubClient.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// ==========================================
// CẤU HÌNH THỜI GIAN WATCHDOG TIMER (WDT)
// ==========================================
#define WDT_TIMEOUT_SECONDS 20

// ==========================================
// THIẾT LẬP MẠNG WIFI & MQTT
// ==========================================
const char* mqtt_server = "broker.emqx.io";
const int mqtt_port = 1883;
const char* topic_sensors = "hoca_test/sensors";
const char* topic_commands = "hoca_test/commands";
const char* topic_status = "hoca_test/status";

WiFiClient espClient;
PubSubClient client(espClient);
WebServer server(80); // Server phục vụ ElegantOTA tại cổng 80

// ==========================================
// KHAI BÁO CHÂN (PINS) PHẦN CỨNG
// ==========================================

// 1. Màn hình OLED SSD1306 (I2C: SDA=21, SCL=22)
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

// 2. Cảm biến Môi trường
#define ONE_WIRE_BUS 4  // Nhiệt độ DS18B20
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);

#define TRIG_PIN 5      // Siêu âm HC-SR04
#define ECHO_PIN 18

#define PH_PIN 34       // Cảm biến pH PH-4502C (Chân Analog ADC1_CH6)

// 3. Còi Báo Động (Buzzer)
#define BUZZER_PIN 15

// 4. Module Relay
#define RELAY_BOM 23    // IN1 (Bơm/Lọc - Active HIGH)
#define RELAY_DEN 19    // IN2 (Đèn - Active HIGH)
#define RELAY_3   26    // IN3 (Bơm Xả - Active HIGH)
#define RELAY_4   27    // IN4 (Bơm Cấp - Active HIGH)
#define RELAY_5   25    // IN5 (Dự phòng 5 - Active LOW)

// 5. Nút bấm vật lý (5 Nút)
#define BTN_BOM 13      // Nút 1 (Bơm - kiêm nút Reset WiFi khi giữ lúc bật nguồn)
#define BTN_DEN 14      // Nút 2 (Đèn)
#define BTN_3   32      // Nút 3 (Bơm Xả)
#define BTN_4   33      // Nút 4 (Bơm Cấp)
#define BTN_5   16      // Nút 5 (Dự phòng 5 / Giữ 1.5s để Tắt còi Snooze)

// Mức kích hoạt Relay
#define RELAY_ON   HIGH
#define RELAY_OFF  LOW
#define RELAY5_ON  LOW
#define RELAY5_OFF HIGH

// ==========================================
// BIẾN TRẠNG THÁI & THÔNG SỐ VẬN HÀNH
// ==========================================
bool ttBom = false;
bool ttDen = false;
bool ttR3  = false;
bool ttR4  = false;
bool ttR5  = false;

// Điều khiển Bơm Xả / Cấp theo Mục tiêu % tại biên (Edge Fail-Safe & Auto-Stop)
float target_xa_pt = -1.0;   // Mục tiêu % dừng Bơm Xả (-1 nếu không đặt)
float target_cap_pt = -1.0;  // Mục tiêu % dừng Bơm Cấp (-1 nếu không đặt)

// Thông số Còi Báo Động Chu Kỳ
bool coi_enable = true;
int coi_on_sec = 10;          // Hú trong 10 giây
int coi_off_sec = 30;         // Nghỉ trong 30 giây
int coi_snooze_min = 5;       // Tạm hoãn 5 phút
bool alarm_trigger = false;   // Cờ có sự cố môi trường hay không
unsigned long snooze_until = 0;
unsigned long buzzer_cycle_start = 0;

// Thông số Hiệu chuẩn pH (DIYMORE PH-4502C)
float ph_offset = 0.0;

// Biến đo lường và chu kỳ
int chu_ky_gui = 60000;
unsigned long lastMsg = 0;
unsigned long lastOLED = 0;
unsigned long lastReconnectAttempt = 0;

// Chống dội phím (Debounce)
unsigned long lastDebounce[5] = {0, 0, 0, 0, 0};
bool lastBtnState[5] = {HIGH, HIGH, HIGH, HIGH, HIGH};
unsigned long btn5_press_time = 0;

// Cấu hình Chiều cao hồ (Nhận đồng bộ từ Web/Server)
float sieu_am_day = 26.5;   // Khoảng cách từ mắt cảm biến xuống ĐÁY hồ (cm)
float sieu_am_tran = 16.0;  // Mực nước Max mong muốn (cm)

// Giá trị cảm biến tức thời
float current_t = 26.5;
float current_ph = 7.0;
float current_muc_nuoc = 15.0;

// ==========================================
// HÀM HIỂN THỊ MÀN HÌNH OLED
// ==========================================
void capNhatOLED(float t, float ph, float khoang_cach_sieu_am) {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  
  // DÒNG 1: TRẠNG THÁI WIFI & SERVER THAY CHO TIÊU ĐỀ CŨ
  display.setCursor(0, 0);  
  if (WiFi.status() == WL_CONNECTED) {
    display.print("WIFI:OK");
  } else {
    display.print("WIFI:--");
  }
  display.print(" ");
  if (client.connected()) {
    display.print("SERVER:OK");
  } else {
    display.print("SERVER:--");
  }
  
  // Biểu tượng Còi Báo Động ở góc trên cùng bên phải
  if (alarm_trigger) {
    display.setCursor(105, 0);
    if (millis() < snooze_until) display.print("[Zz]");
    else display.print("[!]");
  }
  
  // DÒNG 2: NHIỆT ĐỘ
  display.setCursor(0, 16); 
  display.print("Nhiet do: "); display.print(t, 1); display.print(" C");
  
  // DÒNG 3: ĐỘ PH
  display.setCursor(0, 32); 
  display.print("Do pH   : "); display.print(ph, 1);
  
  // DÒNG 4: MỰC NƯỚC (%) KÈM SỐ CM THỰC TẾ TRONG NGOẶC ( )
  // Chiều cao nước thực tế = khoảng cách đáy - khoảng cách mặt nước
  float chieu_cao_nuoc = sieu_am_day - khoang_cach_sieu_am;
  if (chieu_cao_nuoc < 0) chieu_cao_nuoc = 0;
  
  float phan_tram_nuoc = 0.0;
  if (sieu_am_tran > 0) {
    phan_tram_nuoc = (chieu_cao_nuoc / sieu_am_tran) * 100.0;
  }
  phan_tram_nuoc = max(0.0f, min(100.0f, phan_tram_nuoc));
  
  display.setCursor(0, 48); 
  display.print("M.Nuoc: "); 
  display.print((int)phan_tram_nuoc); 
  display.print("% ("); 
  display.print(chieu_cao_nuoc, 1); 
  display.print("cm)");
  
  display.display();
}

// ==========================================
// BÁO CÁO ĐỒNG BỘ TRẠNG THÁI LÊN MQTT
// ==========================================
void guiTrangThaiRelay() {
  String payload = "{";
  payload += "\"trang_thai_den\":" + String(ttDen ? 1 : 0) + ",";
  payload += "\"trang_thai_bom\":" + String(ttBom ? 1 : 0) + ",";
  payload += "\"trang_thai_bom_xa\":" + String(ttR3 ? 1 : 0) + ",";
  payload += "\"trang_thai_bom_cap\":" + String(ttR4 ? 1 : 0) + ",";
  payload += "\"trang_thai_relay_5\":" + String(ttR5 ? 1 : 0) + ",";
  payload += "\"ip\":\"" + WiFi.localIP().toString() + "\"";
  payload += "}";
  client.publish(topic_status, payload.c_str());
}

// ==========================================
// XỬ LÝ LỆNH ĐIỀU KHIỂN TỪ MÁY CHỦ (MQTT)
// ==========================================
void callback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (int i = 0; i < length; i++) message += (char)payload[i];
  
  bool changed = false;
  
  if (message == "ESP_RESTART") {
    Serial.println("🔄 Nhan lenh khoi dong lai ESP32 tu xa qua MQTT!");
    delay(500);
    ESP.restart();
    return;
  }
  else if (message == "DEN_ON") { digitalWrite(RELAY_DEN, RELAY_ON); ttDen = true; changed = true; }
  else if (message == "DEN_OFF") { digitalWrite(RELAY_DEN, RELAY_OFF); ttDen = false; changed = true; }
  else if (message == "BOM_ON") { digitalWrite(RELAY_BOM, RELAY_ON); ttBom = true; changed = true; }
  else if (message == "BOM_OFF") { digitalWrite(RELAY_BOM, RELAY_OFF); ttBom = false; changed = true; }
  else if (message.startsWith("BOMXA_TARGET_")) {
    target_xa_pt = message.substring(13).toFloat();
    digitalWrite(RELAY_3, RELAY_ON); ttR3 = true; changed = true;
    Serial.printf("Bat Bom Xa co Muc tieu: <= %.1f%%\n", target_xa_pt);
  }
  else if (message == "BOMXA_ON") { digitalWrite(RELAY_3, RELAY_ON); ttR3 = true; target_xa_pt = -1.0; changed = true; }
  else if (message == "BOMXA_OFF") { digitalWrite(RELAY_3, RELAY_OFF); ttR3 = false; target_xa_pt = -1.0; changed = true; }
  else if (message.startsWith("BOMCAP_TARGET_")) {
    target_cap_pt = message.substring(14).toFloat();
    digitalWrite(RELAY_4, RELAY_ON); ttR4 = true; changed = true;
    Serial.printf("Bat Bom Cap co Muc tieu: >= %.1f%%\n", target_cap_pt);
  }
  else if (message == "BOMCAP_ON") { digitalWrite(RELAY_4, RELAY_ON); ttR4 = true; target_cap_pt = -1.0; changed = true; }
  else if (message == "BOMCAP_OFF") { digitalWrite(RELAY_4, RELAY_OFF); ttR4 = false; target_cap_pt = -1.0; changed = true; }
  else if (message == "BOM5_ON") { digitalWrite(RELAY_5, RELAY5_ON); ttR5 = true; changed = true; }
  else if (message == "BOM5_OFF") { digitalWrite(RELAY_5, RELAY5_OFF); ttR5 = false; changed = true; }
  
  // --- ĐIỀU KHIỂN CÒI BÁO ĐỘNG ---
  else if (message == "ALARM_ON") {
    if (!alarm_trigger) {
      alarm_trigger = true;
      buzzer_cycle_start = millis();
    }
  }
  else if (message == "ALARM_OFF") {
    alarm_trigger = false;
    digitalWrite(BUZZER_PIN, LOW);
  }
  else if (message.startsWith("ALARM_SNOOZE")) {
    int s_min = coi_snooze_min;
    int idx = message.lastIndexOf('_');
    if (idx > 0) s_min = message.substring(idx + 1).toInt();
    if (s_min <= 0) s_min = 5;
    snooze_until = millis() + (s_min * 60000UL);
    digitalWrite(BUZZER_PIN, LOW);
    Serial.printf("Da kich hoat Snooze coi trong %d phut\n", s_min);
  }
  
  // --- CẤU HÌNH CÒI CHU KỲ (CFG_ALARM_<en>_<on>_<off>_<sn>) ---
  else if (message.startsWith("CFG_ALARM_")) {
    // Tách các tham số
    int p1 = message.indexOf('_', 10);
    int p2 = message.indexOf('_', p1 + 1);
    int p3 = message.indexOf('_', p2 + 1);
    if (p1 > 0 && p2 > 0) {
      coi_enable = (message.substring(10, p1).toInt() == 1);
      coi_on_sec = message.substring(p1 + 1, p2).toInt();
      if (p3 > 0) {
        coi_off_sec = message.substring(p2 + 1, p3).toInt();
        coi_snooze_min = message.substring(p3 + 1).toInt();
      } else {
        coi_off_sec = message.substring(p2 + 1).toInt();
      }
      Serial.printf("Cap nhat Cau hinh Coi: en=%d, on=%ds, off=%ds, snooze=%dp\n", coi_enable, coi_on_sec, coi_off_sec, coi_snooze_min);
    }
  }
  
  // --- HIỆU CHUẨN PH (CFG_PH_<offset>) ---
  else if (message.startsWith("CFG_PH_")) {
    ph_offset = message.substring(7).toFloat();
    Serial.printf("Cap nhat do lech pH offset: %.2f\n", ph_offset);
  }
  
  // --- CẤU HÌNH ĐỘ SÂU BỂ NƯỚC (CFG_W_<day>_<tran>) ---
  else if (message.startsWith("CFG_W_")) {
    int under = message.indexOf('_', 6);
    if (under > 0) {
      sieu_am_day = message.substring(6, under).toFloat();
      sieu_am_tran = message.substring(under + 1).toFloat();
      Serial.printf("Cap nhat Cau hinh Nuoc: day=%.1f, max=%.1f\n", sieu_am_day, sieu_am_tran);
    }
  }

  else if (message.startsWith("CHU_KY_")) {
    int new_chu_ky = message.substring(7).toInt();
    if (new_chu_ky > 0) chu_ky_gui = new_chu_ky * 1000;
  }
  else if (message == "GET_STATUS") {
    changed = true;
  }
  
  if (changed) guiTrangThaiRelay();
}

// ==========================================
// KẾT NỐI LẠI MQTT (NON-BLOCKING)
// ==========================================
void reconnectMQTT() {
  if (WiFi.status() != WL_CONNECTED) return;
  
  if (millis() - lastReconnectAttempt > 5000) { 
    lastReconnectAttempt = millis();
    if (client.connect("ESP32_HoCa_Client")) {
      client.subscribe(topic_commands);
      Serial.println("Da ket noi MQTT thanh cong!");
      guiTrangThaiRelay();
      
      // Xin lại cấu hình hồ từ Server
      client.publish(topic_sensors, "{\"request\":\"GET_CONFIG\"}");
    }
  }
}

// ==========================================
// QUÉT NÚT BẤM VẬT LÝ
// ==========================================
void checkButton(uint8_t pin, uint8_t relayPin, bool &state, int btnIndex) {
  bool reading = digitalRead(pin);
  
  // Xử lý riêng Nút 5: Nhấn nhả bình thường bật Relay 5, nhấn giữ 1.5s để Tắt Còi (Snooze)
  if (btnIndex == 4) {
    if (reading == LOW && lastBtnState[btnIndex] == HIGH) {
      btn5_press_time = millis();
    } else if (reading == LOW && (millis() - btn5_press_time >= 1500) && btn5_press_time != 0) {
      // Đã giữ quá 1.5 giây -> SNOOZE CÒI!
      snooze_until = millis() + (coi_snooze_min * 60000UL);
      digitalWrite(BUZZER_PIN, LOW);
      btn5_press_time = 0; // Đánh dấu đã kích hoạt
      Serial.println("Nut 5 giu 1.5s: SNOOZE COI KHAN CAP!");
      
      // Báo lên MQTT cho Web biết
      if (client.connected()) {
        client.publish(topic_status, "{\"snooze\":1}");
      }
    } else if (reading == HIGH && lastBtnState[btnIndex] == LOW) {
      // Thả nút: nếu thời gian bấm < 1.5s thì đảo trạng thái Relay 5
      if (btn5_press_time != 0 && (millis() - btn5_press_time < 1500) && (millis() - lastDebounce[btnIndex] > 200)) {
        state = !state;
        digitalWrite(relayPin, state ? RELAY5_ON : RELAY5_OFF);
        if (client.connected()) guiTrangThaiRelay();
        lastDebounce[btnIndex] = millis();
      }
      btn5_press_time = 0;
    }
    lastBtnState[btnIndex] = reading;
    return;
  }

  // Xử lý các nút 1, 2, 3, 4 bình thường
  if (reading == LOW && lastBtnState[btnIndex] == HIGH) {
    if (millis() - lastDebounce[btnIndex] > 200) {
      state = !state;
      digitalWrite(relayPin, state ? RELAY_ON : RELAY_OFF);
      if (client.connected()) guiTrangThaiRelay();
      lastDebounce[btnIndex] = millis();
    }
  }
  lastBtnState[btnIndex] = reading;
}

// ==========================================
// QUẢN LÝ CHU KỲ CÒI BÁO ĐỘNG (NON-BLOCKING)
// ==========================================
void xuLyCoiBaoDong() {
  if (coi_enable && alarm_trigger && (millis() >= snooze_until)) {
    unsigned long totalCycle = (coi_on_sec + coi_off_sec) * 1000UL;
    if (totalCycle == 0) totalCycle = 40000;
    unsigned long elapsed = (millis() - buzzer_cycle_start) % totalCycle;
    
    // Trong khoảng coi_on_sec thì hú, sau đó im lặng nghỉ
    if (elapsed < (coi_on_sec * 1000UL)) {
      digitalWrite(BUZZER_PIN, HIGH);
    } else {
      digitalWrite(BUZZER_PIN, LOW);
    }
  } else {
    digitalWrite(BUZZER_PIN, LOW);
  }
}

// ==========================================
// KHỞI ĐỘNG HỆ THỐNG (SETUP)
// ==========================================
void setup() {
  Serial.begin(115200);
  delay(1000);

  // 1. Khởi tạo Watchdog Timer (WDT 20s)
  #if ESP_IDF_VERSION >= ESP_IDF_VERSION_VAL(5, 0, 0)
    esp_task_wdt_config_t wdt_config = {
        .timeout_ms = WDT_TIMEOUT_SECONDS * 1000,
        .idle_core_mask = (1 << 0),
        .trigger_panic = true
    };
    esp_task_wdt_init(&wdt_config);
  #else
    esp_task_wdt_init(WDT_TIMEOUT_SECONDS, true);
  #endif
  esp_task_wdt_add(NULL); // Thêm loop task vào danh sách giám sát của Watchdog

  // 2. Khởi tạo OLED
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) { 
    Serial.println("Loi OLED!"); 
  } else {
    display.clearDisplay(); 
    display.setTextColor(SSD1306_WHITE); 
    display.setCursor(0, 10); 
    display.print("Khoi dong..."); 
    display.display();
  }

  // 3. Khởi tạo Relay & Còi
  pinMode(RELAY_BOM, OUTPUT); digitalWrite(RELAY_BOM, RELAY_OFF);
  pinMode(RELAY_DEN, OUTPUT); digitalWrite(RELAY_DEN, RELAY_OFF);
  pinMode(RELAY_3, OUTPUT);   digitalWrite(RELAY_3, RELAY_OFF);
  pinMode(RELAY_4, OUTPUT);   digitalWrite(RELAY_4, RELAY_OFF);
  pinMode(RELAY_5, OUTPUT);   digitalWrite(RELAY_5, RELAY5_OFF);
  
  pinMode(BUZZER_PIN, OUTPUT); digitalWrite(BUZZER_PIN, LOW);

  // 4. Khởi tạo Nút nhấn
  pinMode(BTN_BOM, INPUT_PULLUP);
  pinMode(BTN_DEN, INPUT_PULLUP);
  pinMode(BTN_3, INPUT_PULLUP);
  pinMode(BTN_4, INPUT_PULLUP);
  pinMode(BTN_5, INPUT_PULLUP);

  // 5. Cảm biến Siêu âm & Nhiệt độ
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  sensors.begin();
  sensors.setWaitForConversion(false);

  // 6. KẾT NỐI WIFI QUA WIFIMANAGER (Tiện lợi đổi mạng mọi lúc)
  WiFiManager wm;
  
  // Kiểm tra nếu lúc bật nguồn người dùng đang đè Nút 1 trong 3 giây -> XÓA WIFI CŨ
  if (digitalRead(BTN_BOM) == LOW) {
    display.clearDisplay();
    display.setCursor(0, 20);
    display.print("DANG RESET WIFI...");
    display.display();
    wm.resetSettings();
    delay(2000);
  }

  // Đặt thời gian chờ Captive Portal là 120 giây (2 phút), nếu không ai cấu hình sẽ chạy Offline
  wm.setConfigPortalTimeout(120);

  display.clearDisplay();
  display.setCursor(0, 10);
  display.print("DANG KET NOI WIFI...");
  display.setCursor(0, 30);
  display.print("AP: HO_CA_CONFIG");
  display.display();

  bool wifi_connected = wm.autoConnect("HO_CA_THONG_MINH_CONFIG");

  if (!wifi_connected) {
    Serial.println("Het thoi gian cho, chay che do Offline!");
    display.clearDisplay();
    display.setCursor(0, 20);
    display.print("CHAY OFFLINE...");
    display.display();
  } else {
    Serial.print("WiFi Da ket noi! IP: ");
    Serial.println(WiFi.localIP());

    display.clearDisplay();
    display.setCursor(0, 10);
    display.print("DA KET NOI WIFI!");
    display.setCursor(0, 30);
    display.print(WiFi.localIP().toString());
    display.display();
    delay(1500);

    // Khởi tạo máy chủ ElegantOTA (Nạp code từ xa qua IP/update)
    server.on("/", []() {
      server.send(200, "text/plain", "He thong Ho ca Thong minh ESP32. Truy cap /update de cap nhat Firmware.");
    });
    
    ElegantOTA.onStart([]() {
      Serial.println("OTA: Bat dau truyen du lieu Firmware...");
      esp_task_wdt_reset();
    });
    ElegantOTA.onProgress([](size_t current, size_t final) {
      // Cho Watchdog ăn liên tục mỗi khi nhận gói tin để không bị drop connection giữa chừng
      esp_task_wdt_reset();
    });
    ElegantOTA.onEnd([](bool success) {
      if (success) {
        Serial.println("OTA: Nap Firmware thanh cong! Khoi dong lai chip...");
      } else {
        Serial.println("OTA: Nap Firmware that bai!");
      }
    });
    ElegantOTA.setAutoReboot(true);
    ElegantOTA.begin(&server);
    server.begin();
    Serial.println("May chu ElegantOTA da san sang tai: http://" + WiFi.localIP().toString() + "/update");
  }

  // 7. Cấu hình MQTT
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
}

// ==========================================
// VÒNG LẶP CHÍNH (LOOP)
// ==========================================
void loop() {
  // 1. Cho chó ăn (Reset Watchdog Timer - Tránh Reset chip ngoài ý muốn)
  esp_task_wdt_reset();

  // 2. Xử lý dịch vụ Web và ElegantOTA (Nạp code không dây)
  if (WiFi.status() == WL_CONNECTED) {
    server.handleClient();
    ElegantOTA.loop();
  }

  // 3. Giữ kết nối MQTT non-blocking
  if (!client.connected()) {
    reconnectMQTT();
  } else {
    client.loop();
  }

  // 4. Quét 5 nút bấm vật lý (Phản hồi tức thì kể cả khi mất mạng)
  checkButton(BTN_BOM, RELAY_BOM, ttBom, 0);
  checkButton(BTN_DEN, RELAY_DEN, ttDen, 1);
  checkButton(BTN_3,   RELAY_3,   ttR3,  2);
  checkButton(BTN_4,   RELAY_4,   ttR4,  3);
  checkButton(BTN_5,   RELAY_5,   ttR5,  4);

  // 5. Điều khiển còi hú chu kỳ thông minh
  xuLyCoiBaoDong();

  // 6. CƠ CHẾ AN TOÀN TỰ ĐỘNG CHO MÁY BƠM TẠI BIÊN (EDGE FAIL-SAFE & AUTO-STOP)
  if (ttR3 || ttR4) {
    // Nếu mất mạng khi đang bơm -> Tắt bơm khẩn cấp
    if (WiFi.status() != WL_CONNECTED || !client.connected()) {
      if (ttR3) { digitalWrite(RELAY_3, RELAY_OFF); ttR3 = false; target_xa_pt = -1.0; }
      if (ttR4) { digitalWrite(RELAY_4, RELAY_OFF); ttR4 = false; target_cap_pt = -1.0; }
      guiTrangThaiRelay();
      Serial.println("CANH BAO AN TOAN: Mat ket noi mang khi dang bom -> Da tu dong ngat bom!");
    }
    
    // Tính chiều cao và % nước hiện tại tức thời
    float chieu_cao_nuoc_test = sieu_am_day - current_muc_nuoc;
    if (chieu_cao_nuoc_test < 0) chieu_cao_nuoc_test = 0;
    float pt_nuoc_hien_tai = 0.0;
    if (sieu_am_tran > 0) pt_nuoc_hien_tai = (chieu_cao_nuoc_test / sieu_am_tran) * 100.0;
    
    // TỰ ĐỘNG NGẮT BƠM XẢ KHI ĐẠT MỤC TIÊU % (Độ trễ = 0, bù trừ quán tính dòng nước 0.5%)
    if (ttR3 && target_xa_pt >= 0.0 && pt_nuoc_hien_tai <= (target_xa_pt + 0.5)) {
      digitalWrite(RELAY_3, RELAY_OFF);
      ttR3 = false;
      target_xa_pt = -1.0;
      guiTrangThaiRelay();
      Serial.printf("✅ ESP32 TU NGAT BOM XA TAI BIEN: Dat muc tieu (Hien tai: %.1f%%)\n", pt_nuoc_hien_tai);
    }

    // Ngắt an toàn phần cứng: Chống cháy Bơm Xả (nếu nước cách đáy <= 2.5cm)
    if (ttR3 && chieu_cao_nuoc_test <= 2.5) {
      digitalWrite(RELAY_3, RELAY_OFF);
      ttR3 = false;
      target_xa_pt = -1.0;
      guiTrangThaiRelay();
      Serial.println("CANH BAO: Muc nuoc sat day (2.5cm) -> Tu dong ngat Bom Xa de chong chay!");
    }

    // TỰ ĐỘNG NGẮT BƠM CẤP KHI ĐẠT MỤC TIÊU %
    if (ttR4 && target_cap_pt >= 0.0 && pt_nuoc_hien_tai >= (target_cap_pt - 0.5)) {
      digitalWrite(RELAY_4, RELAY_OFF);
      ttR4 = false;
      target_cap_pt = -1.0;
      guiTrangThaiRelay();
      Serial.printf("✅ ESP32 TU NGAT BOM CAP TAI BIEN: Dat muc tieu (Hien tai: %.1f%%)\n", pt_nuoc_hien_tai);
    }

    // Ngắt an toàn phần cứng: Chống tràn Bơm Cấp (nếu nước cách mép cảm biến <= 2.5cm hoặc >= 96%)
    if (ttR4 && (current_muc_nuoc <= 2.5 || pt_nuoc_hien_tai >= 96.0)) {
      digitalWrite(RELAY_4, RELAY_OFF);
      ttR4 = false;
      target_cap_pt = -1.0;
      guiTrangThaiRelay();
      Serial.println("CANH BAO: Muc nuoc sat tran -> Tu dong ngat Bom Cap de chong tran!");
    }
  }

  unsigned long now = millis();
  unsigned long sensorInterval = (ttR3 || ttR4) ? 250 : 1000;

  // 7. CẬP NHẬT MÀN HÌNH OLED & ĐỌC CẢM BIẾN (Tăng tốc lên 250ms/lần khi đang bơm nước)
  if (now - lastOLED > sensorInterval) {
    lastOLED = now;
    
    // Đọc Nhiệt độ DS18B20
    float temp_c = sensors.getTempCByIndex(0);
    sensors.requestTemperatures();
    if(temp_c > 0.0 && temp_c != 85.00) {
        if (current_t == 0) current_t = temp_c;
        else current_t = (current_t * 0.8) + (temp_c * 0.2);
    } 

    // Đọc Siêu âm HC-SR04 với Bộ lọc Median chống nhiễu
    float readings[9];
    int valid_count = 0;
    for (int i = 0; i < 9; i++) {
        digitalWrite(TRIG_PIN, LOW); delayMicroseconds(2);
        digitalWrite(TRIG_PIN, HIGH); delayMicroseconds(10);
        digitalWrite(TRIG_PIN, LOW);
        long duration = pulseIn(ECHO_PIN, HIGH, 30000); 
        float d = duration * 0.034 / 2;
        if (d > 0 && d < 400.0) {
            readings[valid_count++] = d;
        }
        delay(10);
    }
    
    if (valid_count > 0) {
        // Sắp xếp Bubble Sort
        for (int i = 0; i < valid_count - 1; i++) {
            for (int j = 0; j < valid_count - i - 1; j++) {
                if (readings[j] > readings[j + 1]) {
                    float temp = readings[j];
                    readings[j] = readings[j + 1];
                    readings[j + 1] = temp;
                }
            }
        }
        int drop_count = valid_count / 4;
        float sum = 0; int count = 0;
        for (int i = drop_count; i < valid_count - drop_count; i++) {
            sum += readings[i];
            count++;
        }
        if (count > 0) {
            current_muc_nuoc = sum / count;
        }
    }

    // Đọc pH (Cảm biến DIYMORE PH-4502C)
    int phRaw = analogRead(PH_PIN);
    float voltage = phRaw * (3.3 / 4095.0);
    
    // Công thức tính pH tuyến tính có bù offset từ Web:
    float ph_calc = (3.5 * voltage) + 2.9 + ph_offset;
    if (ph_calc > 14.0) ph_calc = 14.0;
    if (ph_calc < 0.0) ph_calc = 0.0;
    
    if (current_ph == 7.0) current_ph = ph_calc;
    else current_ph = (current_ph * 0.8) + (ph_calc * 0.2);

    // Cập nhật lên OLED
    capNhatOLED(current_t, current_ph, current_muc_nuoc);
  }

  // 7. GỬI DỮ LIỆU CẢM BIẾN LÊN MQTT
  if (now - lastMsg > chu_ky_gui) {
    lastMsg = now;
    if (client.connected()) {
      String payload = "{";
      payload += "\"nhiet_do\":" + String(current_t, 2) + ",";
      payload += "\"do_ph\":" + String(current_ph, 2) + ",";
      payload += "\"muc_nuoc\":" + String(current_muc_nuoc, 2) + ",";
      payload += "\"ip\":\"" + WiFi.localIP().toString() + "\"";
      payload += "}";
      client.publish(topic_sensors, payload.c_str());
    }
  }
}
