-- Chạy lệnh này trong mục SQL của phpMyAdmin để tạo/làm mới bảng
DROP TABLE IF EXISTS `lich_su_canh_bao`;
DROP TABLE IF EXISTS `ca_dang_nuoi`;
DROP TABLE IF EXISTS `cai_dat_ho`;
DROP TABLE IF EXISTS `lich_su_ai`;
DROP TABLE IF EXISTS `loai_ca`;
DROP TABLE IF EXISTS `du_lieu_cam_bien`;

CREATE TABLE `du_lieu_cam_bien` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nhiet_do` FLOAT NOT NULL,
  `do_ph` FLOAT NOT NULL,
  `muc_nuoc` FLOAT DEFAULT 100.0, -- Đo bằng % hoặc cm, mặc định là 100% đầy
  `thoi_gian_tao` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE `loai_ca` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `ma_loai` VARCHAR(50) NOT NULL UNIQUE,
  `ten_hien_thi` VARCHAR(100) NOT NULL,
  `ten_tieng_anh` VARCHAR(100),
  `ten_khoa_hoc` VARCHAR(100),
  `nhiet_do_min` FLOAT NOT NULL,
  `nhiet_do_max` FLOAT NOT NULL,
  `ph_min` FLOAT NOT NULL,
  `ph_max` FLOAT NOT NULL,
  `the_tich_yeu_cau` FLOAT DEFAULT 5.0, -- Lít nước/con
  `tinh_cach` VARCHAR(50) DEFAULT 'Hòa bình', -- Hòa bình, Hung dữ, Rỉa vây
  `nguon_trich_dan` VARCHAR(255),
  `mo_ta` TEXT,
  `ngay_tao` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Dữ liệu mẫu (Thể tích và Tính cách được cập nhật)
INSERT INTO `loai_ca` (`ma_loai`, `ten_hien_thi`, `ten_tieng_anh`, `ten_khoa_hoc`, `nhiet_do_min`, `nhiet_do_max`, `ph_min`, `ph_max`, `the_tich_yeu_cau`, `tinh_cach`, `nguon_trich_dan`) VALUES
('ca_bay_mau', 'Cá Bảy Màu', 'Guppy', 'Poecilia reticulata', 22.0, 28.0, 6.5, 7.5, 5.0, 'Hòa bình', 'SeriouslyFish.com'),
('ca_la_han', 'Cá La Hán', 'Flowerhorn Cichlid', 'Cichlasoma sp.', 26.0, 30.0, 6.5, 7.8, 150.0, 'Hung dữ', 'FishBase.org'),
('ca_chep_koi', 'Cá Chép Koi', 'Koi Carp', 'Cyprinus rubrofuscus', 15.0, 25.0, 7.0, 8.5, 500.0, 'Hòa bình', 'FishBase.org');

CREATE TABLE `lich_su_ai` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `duong_dan_anh` VARCHAR(255) NOT NULL,
  `id_loai_ca` INT,
  `do_chinh_xac` FLOAT NOT NULL,
  `phu_hop_khong` BOOLEAN, 
  `thoi_gian_tao` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`id_loai_ca`) REFERENCES `loai_ca`(`id`)
);

-- Tạo Event tự động xóa dữ liệu IoT cũ hơn 3 ngày
SET GLOBAL event_scheduler = ON;
CREATE EVENT `tu_dong_xoa_du_lieu_cu`
ON SCHEDULE EVERY 1 DAY
STARTS CURRENT_TIMESTAMP
DO
  DELETE FROM `du_lieu_cam_bien` WHERE `thoi_gian_tao` < NOW() - INTERVAL 3 DAY;

-- 5. Bảng Cài đặt Trung tâm (Môi trường & Điều khiển Thiết bị)
CREATE TABLE `cai_dat_ho` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nhiet_do_min` FLOAT NOT NULL DEFAULT 24.0,
  `nhiet_do_max` FLOAT NOT NULL DEFAULT 28.0,
  `ph_min` FLOAT NOT NULL DEFAULT 6.5,
  `ph_max` FLOAT NOT NULL DEFAULT 7.5,
  `muc_nuoc_min` FLOAT NOT NULL DEFAULT 30.0, -- Cảnh báo cạn nước nếu dưới 30%
  `chieu_dai` FLOAT NOT NULL DEFAULT 60.0, -- cm
  `chieu_rong` FLOAT NOT NULL DEFAULT 40.0, -- cm
  `chieu_cao` FLOAT NOT NULL DEFAULT 40.0, -- cm
  `chu_ky_gui_data` INT NOT NULL DEFAULT 60, -- Tính bằng giây
  `che_do_den` VARCHAR(20) NOT NULL DEFAULT 'manual', -- manual, auto, timer
  `trang_thai_den` BOOLEAN NOT NULL DEFAULT FALSE,
  `hen_gio_den_bat` TIME DEFAULT '18:00:00',
  `hen_gio_den_tat` TIME DEFAULT '22:00:00',
  `che_do_bom` VARCHAR(20) NOT NULL DEFAULT 'manual', -- manual, timer
  `trang_thai_bom` BOOLEAN NOT NULL DEFAULT TRUE,
  `hen_gio_bom_bat` TIME DEFAULT '06:00:00',
  `hen_gio_bom_tat` TIME DEFAULT '18:00:00',
  `ngay_cap_nhat` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
-- Tạo sẵn 1 dòng dữ liệu cài đặt mặc định để cập nhật sau này
INSERT INTO `cai_dat_ho` (`id`) VALUES (1);

-- 6. Bảng danh sách cá đang nuôi thực tế trong hồ
CREATE TABLE `ca_dang_nuoi` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `id_loai_ca` INT NOT NULL,
  `so_luong` INT DEFAULT 1,
  `ngay_tha` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`id_loai_ca`) REFERENCES `loai_ca`(`id`)
);

-- 7. Bảng Lịch sử Cảnh báo Hệ thống (Alerts)
CREATE TABLE `lich_su_canh_bao` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `loai_canh_bao` VARCHAR(50) NOT NULL, -- 'Nhiệt độ', 'Độ pH', 'Mực nước'
  `noi_dung` VARCHAR(255) NOT NULL,
  `da_giai_quyet` BOOLEAN DEFAULT FALSE,
  `thoi_gian_tao` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
