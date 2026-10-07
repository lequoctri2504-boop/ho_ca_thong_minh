#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64

// Khởi tạo màn hình
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

void setup() {
  Serial.begin(115200);
  delay(2000);
  
  Serial.println("\n==================================");
  Serial.println("--- BAT DAU TEST MAN HINH DOC LAP ---");
  Serial.println("==================================");
  
  // 1. Quét địa chỉ I2C phần cứng
  Serial.println("Dang quet cac thiet bi I2C tren chan 21(SDA) va 22(SCL)...");
  Wire.begin();
  byte error, address;
  int nDevices = 0;
  
  for(address = 1; address < 127; address++ ) {
    Wire.beginTransmission(address);
    error = Wire.endTransmission();
    if (error == 0) {
      Serial.print(">> TIM THAY thiet bi I2C o dia chi 0x");
      if (address<16) Serial.print("0");
      Serial.println(address, HEX);
      nDevices++;
    }
  }
  
  if (nDevices == 0) {
    Serial.println("\n[LOI NGHIEM TRONG]: KHONG TIM THAY BKI THIET BI I2C NAO!");
    Serial.println("- 1. Hay kiem tra lai da cam SCL vao 22 va SDA vao 21 chua.");
    Serial.println("- 2. Thu rut VCC ra cam lai vao lo 3.3V khac hoac 5V xem sao.");
    Serial.println("- 3. Day hoac Testboard co the bi dut ngam.");
    return; // Dừng lại ở đây
  }
  
  // 2. Thử bật màn hình ở địa chỉ 0x3C
  Serial.println("\nDang thu bat man hinh o dia chi 0x3C...");
  if(!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println(">> THAT BAI o dia chi 0x3C. Se thu dia chi 0x3D...");
    
    // 3. Thử bật ở địa chỉ 0x3D nếu 0x3C thất bại
    if(!display.begin(SSD1306_SWITCHCAPVCC, 0x3D)) {
        Serial.println("\n[LOI]: Cung THAT BAI o dia chi 0x3D.");
        Serial.println("Thong diep: Dia chi I2C hoat dong, nhung man hinh khong the bat. Kha nang rat cao ban mua nham man hinh chip SH1106 (loai 1.3 inch) chu khong phai SSD1306 (0.96 inch), hoac man hinh bi hong den LED.");
        return;
    } else {
        Serial.println(">> Bat THANH CONG o dia chi 0x3D!");
    }
  } else {
    Serial.println(">> Bat THANH CONG o dia chi 0x3C!");
  }
  
  // Vẽ chữ bự lên màn hình
  display.clearDisplay();
  display.setTextSize(2);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(15, 25);
  display.print("TEST OK!");
  display.display();
  Serial.println("\nDa xuc tien ve chu 'TEST OK!' len man hinh.");
  Serial.println("Neu ban DOC DUOC dong nay tren Serial nhung man hinh van DEN XI: ");
  Serial.println("=> 100% Tam nen OLED cua man hinh da bi chay/Hong phan cung.");
}

void loop() {
  // Không làm gì cả
  delay(1000);
}
