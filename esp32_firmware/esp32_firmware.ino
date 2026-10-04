#include <WiFi.h>
#include <PubSubClient.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// ==========================================
// THIẾT LẬP MẠNG WIFI & MQTT
// ==========================================
const char* ssid = "HOME";          // <<< SỬA TÊN WIFI TẠI ĐÂY
const char* password = "12345679";  // <<< SỬA MẬT KHẨU TẠI ĐÂY

const char* mqtt_server = "broker.emqx.io";
const int mqtt_port = 1883;
const char* topic_sensors = "hoca_test/sensors";
const char* topic_commands = "hoca_test/commands";
const char* topic_status = "hoca_test/status";

WiFiClient espClient;
PubSubClient client(espClient);

// ==========================================
// KHAI BÁO CHÂN (PINS) CHUẨN SƠ ĐỒ MỚI NHẤT
// ==========================================

// 1. OLED (I2C)
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
// Sử dụng chuẩn giao tiếp I2C mặc định SDA=21, SCL=22
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

// 2. Cảm biến
#define ONE_WIRE_BUS 4  // Nhiệt độ DS18B20
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);

#define TRIG_PIN 5      // Siêu âm HC-SR04
#define ECHO_PIN 18
const float CHIEU_CAO_HO_CM = 40.0; 

#define PH_PIN 34    // Cảm biến pH PH-4502C

// 3. Còi báo
#define BUZZER_PIN 15

// 4. Module Relay 4 Kênh
#define RELAY_BOM 23    // IN1 (Bơm)
#define RELAY_DEN 19    // IN2 (Đèn)
#define RELAY_3   26    // IN3 (Dự phòng 3)
#define RELAY_4   27    // IN4 (Dự phòng 4)
#define RELAY_5   25    // IN5 (Dự phòng 5 mới thêm)

// 5. Nút nhấn (5 Nút)
#define BTN_BOM 13      // Nút 1 (Bơm)
#define BTN_DEN 14      // Nút 2 (Đèn)
#define BTN_3   32      // Nút 3 (Dự phòng 3)
#define BTN_4   33      // Nút 4 (Dự phòng 4)
#define BTN_5   16      // Nút 5 (Đổi sang 16 để tránh lỗi LED tích hợp)

// --- CẤU HÌNH LOGIC RELAY ---
// Mạch 4 kênh của bạn là Active HIGH
#define RELAY_ON  HIGH
#define RELAY_OFF LOW

// Mạch 1 kênh (Relay 5) có vẻ là Active LOW (Ngược lại)
#define RELAY5_ON  LOW
#define RELAY5_OFF HIGH

// Trạng thái hệ thống
bool ttBom = false;
bool ttDen = false;
bool ttR3  = false;
bool ttR4  = false;
bool ttR5  = false;

// Chống dội phím (Debounce) cho 5 nút
unsigned long lastDebounce[5] = {0, 0, 0, 0, 0};

int chu_ky_gui = 60000;
unsigned long lastMsg = 0;
unsigned long lastOLED = 0;

// Biến lưu trữ tạm thời cho màn hình
float current_t = 26.5;
float current_ph = 7.0;
float current_muc_nuoc = 95.0;

// ==========================================
// HÀM HIỂN THỊ OLED
// ==========================================
void capNhatOLED(float t, float ph, float muc_nuoc) {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);  display.print("HO CA TRI & THAN");
  display.setCursor(0, 16); display.print("Nhiet do: "); display.print(t, 1); display.print(" C");
  display.setCursor(0, 32); display.print("Do pH   : "); display.print(ph, 1);
  display.setCursor(0, 48); display.print("Sieu am : "); display.print(muc_nuoc, 1); display.print(" cm");
  display.display();
}

// ==========================================
// GỬI ĐỒNG BỘ TRẠNG THÁI LÊN WEB
// ==========================================
void guiTrangThaiRelay() {
  String payload = "{";
  payload += "\"trang_thai_den\":" + String(ttDen ? 1 : 0) + ",";
  payload += "\"trang_thai_bom\":" + String(ttBom ? 1 : 0) + ",";
  payload += "\"trang_thai_bom_xa\":" + String(ttR3 ? 1 : 0) + ",";
  payload += "\"trang_thai_bom_cap\":" + String(ttR4 ? 1 : 0) + ",";
  payload += "\"trang_thai_relay_5\":" + String(ttR5 ? 1 : 0);
  payload += "}";
  client.publish(topic_status, payload.c_str());
}

// ==========================================
// LẮNG NGHE LỆNH TỪ WEB
// ==========================================
void callback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (int i = 0; i < length; i++) message += (char)payload[i];
  
  bool changed = false;
  if (message == "DEN_ON") { digitalWrite(RELAY_DEN, RELAY_ON); ttDen = true; changed = true; }
  else if (message == "DEN_OFF") { digitalWrite(RELAY_DEN, RELAY_OFF); ttDen = false; changed = true; }
  else if (message == "BOM_ON") { digitalWrite(RELAY_BOM, RELAY_ON); ttBom = true; changed = true; }
  else if (message == "BOM_OFF") { digitalWrite(RELAY_BOM, RELAY_OFF); ttBom = false; changed = true; }
  else if (message == "ALARM_ON") { digitalWrite(BUZZER_PIN, HIGH); }
  else if (message == "ALARM_OFF") { digitalWrite(BUZZER_PIN, LOW); }
  else if (message == "BOMXA_ON") { digitalWrite(RELAY_3, RELAY_ON); ttR3 = true; changed = true; }
  else if (message == "BOMXA_OFF") { digitalWrite(RELAY_3, RELAY_OFF); ttR3 = false; changed = true; }
  else if (message == "BOMCAP_ON") { digitalWrite(RELAY_4, RELAY_ON); ttR4 = true; changed = true; }
  else if (message == "BOMCAP_OFF") { digitalWrite(RELAY_4, RELAY_OFF); ttR4 = false; changed = true; }
  else if (message == "BOM5_ON") { digitalWrite(RELAY_5, RELAY5_ON); ttR5 = true; changed = true; }
  else if (message == "BOM5_OFF") { digitalWrite(RELAY_5, RELAY5_OFF); ttR5 = false; changed = true; }
  else if (message.startsWith("CHU_KY_")) {
    int new_chu_ky = message.substring(7).toInt();
    if (new_chu_ky > 0) chu_ky_gui = new_chu_ky * 1000;
  }
  else if (message == "GET_STATUS") {
    changed = true; // Ép buộc gửi trạng thái
  }
  
  if (changed) guiTrangThaiRelay();
}

// ==========================================
// KẾT NỐI WIFI VÀ MQTT (NON-BLOCKING)
// ==========================================
void setup_wifi() {
  WiFi.begin(ssid, password);
  Serial.print("Dang ket noi WiFi");
  int attempts = 0;
  // Cố gắng bắt WiFi trong 7.5 giây, nếu không có sẽ chạy Offline ngay lập tức
  while (WiFi.status() != WL_CONNECTED && attempts < 15) { 
    delay(500); 
    Serial.print("."); 
    attempts++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi da ket noi!");
  } else {
    Serial.println("\nKhong the ket noi WiFi, chuyen sang che do Offline!");
  }
}

unsigned long lastReconnectAttempt = 0;
void reconnect() {
  if (WiFi.status() != WL_CONNECTED) return; // Nếu rớt WiFi thì không thèm kết nối MQTT (để nút bấm không bị lag)
  
  if (millis() - lastReconnectAttempt > 5000) { 
    lastReconnectAttempt = millis();
    if (client.connect("ESP32_HoCa_Client")) {
      client.subscribe(topic_commands);
      Serial.println("Da ket noi lai MQTT");
      guiTrangThaiRelay(); // Báo cáo trạng thái ngay khi vừa kết nối
    }
  }
}

// Cần mảng lưu trạng thái nút nhấn trước đó
bool lastBtnState[5] = {HIGH, HIGH, HIGH, HIGH, HIGH};

void checkButton(uint8_t pin, uint8_t relayPin, bool &state, int btnIndex) {
  bool reading = digitalRead(pin);
  if (reading == LOW && lastBtnState[btnIndex] == HIGH) {
    if (millis() - lastDebounce[btnIndex] > 200) {
      state = !state;
      if (relayPin == RELAY_5) digitalWrite(relayPin, state ? RELAY5_ON : RELAY5_OFF);
      else digitalWrite(relayPin, state ? RELAY_ON : RELAY_OFF);
      
      if (client.connected()) guiTrangThaiRelay();
      lastDebounce[btnIndex] = millis();
    }
  }
  lastBtnState[btnIndex] = reading;
}

// ==========================================
// SETUP
// ==========================================
void setup() {
  Serial.begin(115200);
  delay(1000); // Đợi ổn định nguồn năng lượng cho toàn hệ thống
  
  // 1. Khởi tạo OLED
  if(!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) { 
    Serial.println("Loi OLED o dia chi 0x3C."); 
  } else {
    display.clearDisplay(); display.setTextColor(SSD1306_WHITE); display.setCursor(0, 10); display.print("Khoi dong..."); display.display();
    Serial.println("OLED khoi tao THANH CONG.");
  }

  // 2. Khởi tạo Relay & Còi (5 Kênh Relay + 1 Còi)
  uint8_t outputPins[] = {RELAY_BOM, RELAY_DEN, RELAY_3, RELAY_4};
  for (int i = 0; i < 4; i++) {
    pinMode(outputPins[i], OUTPUT);
    digitalWrite(outputPins[i], RELAY_OFF); // Relay tắt mặc định
  }
  pinMode(RELAY_5, OUTPUT);
  digitalWrite(RELAY_5, RELAY5_OFF); // Riêng Relay 5 tắt mặc định theo logic của nó

  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW); // Riêng còi tắt bằng (LOW)

  // 3. Khởi tạo Nút nhấn (Sử dụng Pull-up nội bộ)
  pinMode(BTN_BOM, INPUT_PULLUP);
  pinMode(BTN_DEN, INPUT_PULLUP);
  pinMode(BTN_3, INPUT_PULLUP);
  pinMode(BTN_4, INPUT_PULLUP);
  pinMode(BTN_5, INPUT_PULLUP);

  // 4. Khởi tạo Siêu âm & Nhiệt độ
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  sensors.begin();
  sensors.setWaitForConversion(false); // Cực kỳ quan trọng: Giúp mạch không bị đơ khi đọc nhiệt độ

  // 5. Khởi động mạng
  setup_wifi();
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
}

// ==========================================
// LOOP
// ==========================================
void loop() {
  // Kết nối và giữ kết nối MQTT mà không làm đơ mạch
  if (!client.connected()) reconnect();
  client.loop();

  // Quét 5 Nút nhấn siêu tốc (Chạy tốt kể cả Offline)
  checkButton(BTN_BOM, RELAY_BOM, ttBom, 0);
  checkButton(BTN_DEN, RELAY_DEN, ttDen, 1);
  checkButton(BTN_3, RELAY_3, ttR3, 2);
  checkButton(BTN_4, RELAY_4, ttR4, 3);
  checkButton(BTN_5, RELAY_5, ttR5, 4);

  unsigned long now = millis();

  // CẬP NHẬT MÀN HÌNH OLED (Mỗi 1 Giây)
  if (now - lastOLED > 1000) {
    lastOLED = now;
    
    // Đọc Nhiệt độ (Đã cấu hình Non-blocking) & Lọc nhiễu
    float temp_c = sensors.getTempCByIndex(0); // Lấy kết quả của chu kỳ trước
    sensors.requestTemperatures(); // Bắt đầu chu kỳ mới (sẽ lấy ở giây tiếp theo)
    
    if(temp_c > 0.0 && temp_c != 85.00) {
        if (current_t == 0) current_t = temp_c;
        else current_t = (current_t * 0.8) + (temp_c * 0.2); // Thuật toán EMA làm mượt số
    } 

    // --- THUẬT TOÁN LỌC NHIỄU SIÊU ÂM (MEDIAN FILTER) ---
    float readings[9];
    int valid_count = 0;
    
    // Bắn 9 tia siêu âm liên tục để lấy mẫu
    for (int i = 0; i < 9; i++) {
        digitalWrite(TRIG_PIN, LOW); delayMicroseconds(2);
        digitalWrite(TRIG_PIN, HIGH); delayMicroseconds(10);
        digitalWrite(TRIG_PIN, LOW);
        long duration = pulseIn(ECHO_PIN, HIGH, 30000); 
        float d = duration * 0.034 / 2;
        if (d > 0 && d < 400.0) {
            readings[valid_count] = d;
            valid_count++;
        }
        delay(10); // Chờ 10ms để tránh sóng dội đè lên nhau
    }
    
    if (valid_count > 0) {
        // Sắp xếp mảng từ nhỏ đến lớn (Bubble Sort)
        for (int i = 0; i < valid_count - 1; i++) {
            for (int j = 0; j < valid_count - i - 1; j++) {
                if (readings[j] > readings[j + 1]) {
                    float temp = readings[j];
                    readings[j] = readings[j + 1];
                    readings[j + 1] = temp;
                }
            }
        }
        
        // Cắt bỏ 25% kết quả nhiễu thấp nhất và 25% nhiễu cao nhất
        int drop_count = valid_count / 4;
        float sum = 0;
        int count = 0;
        for (int i = drop_count; i < valid_count - drop_count; i++) {
            sum += readings[i];
            count++;
        }
        
        // Lấy trung bình cộng của các giá trị cốt lõi ở giữa
        if (count > 0) {
            current_muc_nuoc = sum / count;
        }
    }

    // Đọc pH (Đã gắn module PH-4502C)
    int phRaw = analogRead(PH_PIN);
    float voltage = phRaw * (3.3 / 4095.0);
    // PH_OFFSET = 7.0 - (Điện áp đo được trong nước cất * 3.5)
    // Tạm thời nếu đang báo 4.1 ở nước máy (khoảng pH 7.0), ta bù thêm 2.9
    float PH_OFFSET = 2.9; 
    float ph_calc = (3.5 * voltage) + PH_OFFSET; 
    
    if (current_ph == 7.0) current_ph = ph_calc; // Lần đầu
    else current_ph = (current_ph * 0.8) + (ph_calc * 0.2); // EMA Lọc nhiễu pH

    // Cập nhật lên màn hình
    capNhatOLED(current_t, current_ph, current_muc_nuoc);
  }

  // GỬI LÊN MQTT (Mỗi 60 Giây)
  if (now - lastMsg > chu_ky_gui) {
    lastMsg = now;
    if (client.connected()) {
      String payload = "{";
      payload += "\"nhiet_do\":" + String(current_t) + ",";
      payload += "\"do_ph\":" + String(current_ph) + ",";
      payload += "\"muc_nuoc\":" + String(current_muc_nuoc);
      payload += "}";
      client.publish(topic_sensors, payload.c_str());
    }
  }
}
