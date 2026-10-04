#include <OneWire.h>
#include <DallasTemperature.h>

// 1. Cảm biến Nhiệt độ DS18B20
#define ONE_WIRE_BUS 4
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);

// 2. Cảm biến Siêu âm HC-SR04
#define TRIG_PIN 5
#define ECHO_PIN 18

void setup() {
  Serial.begin(115200);
  Serial.println("BAT DAU TEST CAM BIEN HO CA...");

  // Khởi tạo DS18B20
  sensors.begin();
  
  // Khởi tạo HC-SR04
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
}

void loop() {
  Serial.println("---------------------------------");
  
  // --- 1. TEST CẢM BIẾN NHIỆT ĐỘ ---
  sensors.requestTemperatures(); 
  float temp_c = sensors.getTempCByIndex(0);
  
  Serial.print("Nhiet do DS18B20: ");
  if (temp_c == -127.00) {
    Serial.println("LOI! Khong tim thay cam bien. Kiem tra lai day Data (Chan so 4) hoac xem co thieu dien tro 4.7k khong.");
  } else if (temp_c == 85.00) {
    Serial.println("LOI! Cam bien chua the khoi dong (thuong do dien ap yeu).");
  } else {
    Serial.print(temp_c);
    Serial.println(" do C (HOAT DONG TOT)");
  }

  // --- 2. TEST CẢM BIẾN SIÊU ÂM ---
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  
  // pulseIn sẽ đếm thời gian sóng siêu âm dội lại. Timeout 30000us (khoảng 30ms).
  long duration = pulseIn(ECHO_PIN, HIGH, 30000); 
  
  Serial.print("Sieu am HC-SR04 : ");
  if (duration == 0) {
    Serial.println("LOI! Khong nhan duoc song phan xa. Kiem tra day TRIG (Chan 5) va ECHO (Chan 18).");
  } else {
    float distance_cm = duration * 0.034 / 2;
    Serial.print(distance_cm);
    Serial.println(" cm (HOAT DONG TOT)");
  }

  delay(1000); // Chạy lại mỗi 1 giây
}
