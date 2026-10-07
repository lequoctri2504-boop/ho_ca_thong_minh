#include <WiFi.h>
#include <PubSubClient.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Preferences.h>

Preferences preferences;


// ==========================================
// THIẾT LẬP MẠNG WIFI & MQTT
// ==========================================
const char* ssid = "HOME";
const char* password = "12345679";

const char* mqtt_server = "broker.emqx.io";
const int mqtt_port = 1883;
const char* topic_sensors = "hoca_test/sensors";
const char* topic_commands = "hoca_test/commands";
const char* topic_status = "hoca_test/status";

WiFiClient espClient;
PubSubClient client(espClient);

// ==========================================
// KHAI BÁO CHÂN (PINS) ĐỒNG BỘ VỚI WEB INDEX
// ==========================================

// 1. OLED (I2C)
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

// 2. Cảm biến
#define ONE_WIRE_BUS 4  // Nhiệt độ DS18B20
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);

#define TRIG_PIN 5      // Siêu âm HC-SR04
#define ECHO_PIN 18
const float CHIEU_CAO_HO_CM = 40.0; 

#define PH_PIN 34       // Cảm biến pH PH-4502C

// 3. Còi báo
#define BUZZER_PIN 15

// 4. Module Relay (4 Kênh + 1 Kênh)
#define RELAY_BOM 23    // IN1 (Bơm)
#define RELAY_DEN 19    // IN2 (Đèn)
#define RELAY_3   26    // IN3 (Bơm Xả)
#define RELAY_4   27    // IN4 (Bơm Cấp)
#define RELAY_5   25    // Dự phòng 5 (Mạch 1 kênh rời)

// 5. Nút nhấn (5 Nút)
#define BTN_BOM 13      
#define BTN_DEN 14      
#define BTN_3   32      
#define BTN_4   33      
#define BTN_5   16      // RX2

// --- CẤU HÌNH LOGIC RELAY ---
// Rơ-le 4 Kênh: Bạn nói web báo Tắt nhưng bên ngoài Bật -> Do nó là Active HIGH
#define RELAY_ON  HIGH
#define RELAY_OFF LOW

// Rơ-le 1 Kênh (Relay 5): Bạn nói cái này đúng rồi -> Nó là Active LOW
#define RELAY5_ON  LOW
#define RELAY5_OFF HIGH

// Trạng thái hệ thống
bool ttDen = false;
bool ttBom = false;
bool ttR3  = false;
bool ttR4  = false;
bool ttR5  = false;

// Chống dội phím (Debounce) cho 5 nút
unsigned long lastDebounce[5] = {0, 0, 0, 0, 0};
bool lastBtnState[5] = {HIGH, HIGH, HIGH, HIGH, HIGH};

int chu_ky_gui = 60000;
unsigned long lastMsg = 0;
unsigned long lastOLED = 0;

float current_t = 26.5;
float current_ph = 7.0;
float current_muc_nuoc = 95.0;

// Cấu hình siêu âm
float chieu_cao_day = 45.0;
float chieu_cao_tran = 38.0;

// ==========================================
// HÀM HIỂN THỊ OLED
// ==========================================
void capNhatOLED(float t, float ph, float muc_nuoc) {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  
  // Hiển thị trạng thái Online / Offline
  display.setCursor(0, 0);  
  if (WiFi.status() == WL_CONNECTED) {
    display.print("WIFI:OK ");
  } else {
    display.print("WIFI:X  ");
  }

  if (client.connected()) {
    display.print(" SVR:OK");
  } else {
    display.print(" SVR:X");
  }

  display.setCursor(0, 16); display.print("Nhiet do: "); display.print(t, 1); display.print(" C");
  display.setCursor(0, 32); display.print("Do pH   : "); display.print(ph, 1);
  display.setCursor(0, 48); display.print("Muc nuoc: "); display.print(muc_nuoc, 1); display.print(" %");
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
  else if (message.startsWith("CFG_W_")) {
    // Format: CFG_W_18.0_11.0
    int first_us = message.indexOf('_', 6);
    if (first_us != -1) {
       chieu_cao_day = message.substring(6, first_us).toFloat();
       chieu_cao_tran = message.substring(first_us + 1).toFloat();
       preferences.putFloat("day", chieu_cao_day);
       preferences.putFloat("tran", chieu_cao_tran);
       Serial.print("Da dong bo Do sau Ho tu Web: ");
       Serial.println(chieu_cao_day);
    }
  }
  else if (message == "GET_STATUS") {
    changed = true;
  }
  
  if (changed) guiTrangThaiRelay();
}

// ==========================================
// KẾT NỐI WIFI VÀ MQTT
// ==========================================
void setup_wifi() {
  WiFi.begin(ssid, password);
  Serial.print("Dang ket noi WiFi");
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 15) { 
    delay(500); Serial.print("."); attempts++;
  }
}

unsigned long lastReconnectAttempt = 0;
void reconnect() {
  if (WiFi.status() != WL_CONNECTED) return;
  if (millis() - lastReconnectAttempt > 5000) { 
    lastReconnectAttempt = millis();
    if (client.connect("ESP32_HoCa_Client")) {
      client.subscribe(topic_commands);
      guiTrangThaiRelay();
      // Yêu cầu Server gửi lại cấu hình hồ ngay khi vừa kết nối xong
      client.publish(topic_sensors, "{\"request\":\"GET_CONFIG\"}");
    }
  }
}

// ==========================================
// XỬ LÝ NÚT NHẤN (CHỐNG DỘI PHÍM)
// ==========================================
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
  delay(500); 
  
  // Khởi tạo bộ nhớ EEPROM/Flash
  preferences.begin("hoca", false);
  chieu_cao_day = preferences.getFloat("day", 45.0);
  chieu_cao_tran = preferences.getFloat("tran", 38.0);
  
  // 1. Khởi tạo OLED
  if(!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) { 
    Serial.println("Loi OLED o dia chi 0x3C."); 
  } else {
    display.clearDisplay(); display.setTextColor(SSD1306_WHITE); display.setCursor(0, 10); display.print("Khoi dong..."); display.display();
  }

  // 2. Khởi tạo Relay & Còi (5 Kênh)
  uint8_t outputPins[] = {RELAY_DEN, RELAY_BOM, RELAY_3, RELAY_4};
  for (int i = 0; i < 4; i++) {
    pinMode(outputPins[i], OUTPUT);
    digitalWrite(outputPins[i], RELAY_OFF); 
  }
  pinMode(RELAY_5, OUTPUT);
  digitalWrite(RELAY_5, RELAY5_OFF); 

  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW); 

  // 3. Khởi tạo Nút nhấn
  pinMode(BTN_DEN, INPUT_PULLUP);
  pinMode(BTN_BOM, INPUT_PULLUP);
  pinMode(BTN_3, INPUT_PULLUP);
  pinMode(BTN_4, INPUT_PULLUP);
  pinMode(BTN_5, INPUT_PULLUP);

  // 4. Khởi tạo Siêu âm & Nhiệt độ
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  sensors.begin();
  sensors.setWaitForConversion(false); 

  // 5. Khởi động mạng
  setup_wifi();
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
}

// ==========================================
// LOOP
// ==========================================
void loop() {
  if (!client.connected()) reconnect();
  client.loop();

  // Quét 5 Nút nhấn
  checkButton(BTN_BOM, RELAY_BOM, ttBom, 0);
  checkButton(BTN_DEN, RELAY_DEN, ttDen, 1);
  checkButton(BTN_3, RELAY_3, ttR3, 2);
  checkButton(BTN_4, RELAY_4, ttR4, 3);
  checkButton(BTN_5, RELAY_5, ttR5, 4);

  unsigned long now = millis();

  // CẬP NHẬT MÀN HÌNH OLED (Mỗi 1 Giây)
  if (now - lastOLED > 1000) {
    lastOLED = now;
    
    // Đọc Nhiệt độ 
    sensors.requestTemperatures(); 
    float temp_c = sensors.getTempCByIndex(0);
    if(temp_c != -127.00 && temp_c != 85.00) {
        if (current_t == 0) current_t = temp_c;
        else current_t = (current_t * 0.8) + (temp_c * 0.2); 
    } 

    // Đọc Siêu âm (Lọc Median)
    float readings[9];
    int valid_count = 0;
    for (int i = 0; i < 9; i++) {
        digitalWrite(TRIG_PIN, LOW); delayMicroseconds(2);
        digitalWrite(TRIG_PIN, HIGH); delayMicroseconds(10);
        digitalWrite(TRIG_PIN, LOW);
        long duration = pulseIn(ECHO_PIN, HIGH, 30000); 
        float d = duration * 0.034 / 2;
        if (d > 0 && d < 400.0) { readings[valid_count] = d; valid_count++; }
        delay(10); 
    }
    if (valid_count > 0) {
        for (int i = 0; i < valid_count - 1; i++) {
            for (int j = 0; j < valid_count - i - 1; j++) {
                if (readings[j] > readings[j + 1]) {
                    float temp = readings[j]; readings[j] = readings[j + 1]; readings[j + 1] = temp;
                }
            }
        }
        int drop_count = valid_count / 4;
        float sum = 0; int count = 0;
        for (int i = drop_count; i < valid_count - drop_count; i++) { sum += readings[i]; count++; }
        if (count > 0) current_muc_nuoc = sum / count;
    }

    // Đọc pH: Trả lại đúng công thức ban đầu của bạn
    int phRaw = analogRead(PH_PIN);
    float voltage = phRaw * (3.3 / 4095.0);
    float PH_OFFSET = 2.9; 
    float ph_calc = (3.5 * voltage) + PH_OFFSET;
    
    // In ra Serial để theo dõi điện áp thực tế mạch đang xuất ra
    Serial.print("--- PH DEBUG: Raw = "); 
    Serial.print(phRaw);
    Serial.print(" | Voltage = ");
    Serial.print(voltage);
    Serial.print("V | pH Calc = ");
    Serial.println(ph_calc);

    // Lọc nhiễu EMA để pH không nhảy múa
    if (current_ph == 7.0) current_ph = ph_calc; 
    else current_ph = (current_ph * 0.8) + (ph_calc * 0.2); 

    // Chuyển đổi siêu âm (cm) sang phần trăm (%) giống hệt logic trên Web
    float chieu_cao_nuoc = chieu_cao_day - current_muc_nuoc;
    float phan_tram_nuoc = 0.0;
    if (chieu_cao_nuoc > 0 && chieu_cao_tran > 0) {
        phan_tram_nuoc = (chieu_cao_nuoc / chieu_cao_tran) * 100.0;
    }
    if (phan_tram_nuoc > 100.0) phan_tram_nuoc = 100.0;
    if (current_muc_nuoc == 0 || current_muc_nuoc > 400) phan_tram_nuoc = 95.0;

    capNhatOLED(current_t, current_ph, phan_tram_nuoc);
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
