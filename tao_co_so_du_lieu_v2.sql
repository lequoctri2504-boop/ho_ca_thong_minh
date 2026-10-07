-- Chạy lệnh này trong mục SQL của phpMyAdmin để tạo/làm mới bảng
DROP TABLE IF EXISTS `lich_su_canh_bao`;
DROP TABLE IF EXISTS `ca_dang_nuoi`;
DROP TABLE IF EXISTS `cai_dat_ho`;
DROP TABLE IF EXISTS `lich_su_ai`;
DROP TABLE IF EXISTS `loai_ca`;
DROP TABLE IF EXISTS `du_lieu_cam_bien`;
DROP TABLE IF EXISTS `yeu_cau_them_ca`;

-- 1. Bảng Dữ liệu Cảm biến IoT
CREATE TABLE `du_lieu_cam_bien` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nhiet_do` FLOAT NOT NULL,
  `do_ph` FLOAT NOT NULL,
  `muc_nuoc` FLOAT DEFAULT 100.0, -- Đo bằng % hoặc cm
  `thoi_gian` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Bảng Từ điển Loài cá (NÂNG CẤP VỚI BIOLOAD & MA TRẬN TƯƠNG THÍCH)
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
  `the_tich_yeu_cau` FLOAT DEFAULT 5.0, -- Lít nước/con (Sẽ bị thay thế dần bởi công thức Bioload)
  `tinh_cach` VARCHAR(50) DEFAULT 'Hòa bình', -- Hòa bình, Hung dữ, Rỉa vây
  `kich_thuoc_adult` FLOAT DEFAULT 5.0, -- Kích thước trưởng thành (cm) -> Phục vụ Predation Rule
  `he_so_bioload` FLOAT DEFAULT 1.0, -- Hệ số thải phân (VD: 0.5, 1.0, 2.0)
  `kieu_vay` VARCHAR(20) DEFAULT 'Ngắn', -- Ngắn, Dài -> Phục vụ check Fin nipper
  `tang_boi` VARCHAR(20) DEFAULT 'Giữa', -- Mặt, Giữa, Đáy -> Phục vụ Water Column Balance
  `so_luong_bay_min` INT DEFAULT 1, -- Số lượng tối thiểu để không bị stress (Schooling rule)
  `nguon_trich_dan` VARCHAR(255),
  `mo_ta` TEXT,
  `ngay_tao` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Dữ liệu 21 Loài cá (Bản Full nâng cấp đầy đủ sinh thái)
INSERT INTO `loai_ca` (`ma_loai`, `ten_hien_thi`, `ten_tieng_anh`, `ten_khoa_hoc`, `nhiet_do_min`, `nhiet_do_max`, `ph_min`, `ph_max`, `the_tich_yeu_cau`, `tinh_cach`, `kich_thuoc_adult`, `he_so_bioload`, `kieu_vay`, `tang_boi`, `so_luong_bay_min`, `nguon_trich_dan`) VALUES
('ca_ba_duoi', 'Cá Ba Đuôi (cá vàng)', 'Goldfish', 'Carassius auratus', 4.0, 25.0, 6.0, 8.0, 50.0, 'Hòa bình', 20.0, 2.5, 'Dài', 'Giữa', 1, 'ornamentalfish.org'),
('ca_bay_mau', 'Cá Bảy Màu', 'Guppy', 'Poecilia reticulata', 17.0, 28.0, 7.0, 8.5, 5.0, 'Hòa bình', 5.0, 0.5, 'Dài', 'Mặt', 3, 'seriouslyfish.com'),
('ca_but_chi', 'Cá Bút Chì', 'Siamese algae eater', 'Crossocheilus oblongus', 24.0, 28.0, 6.5, 7.5, 15.0, 'Hòa bình', 15.0, 0.8, 'Ngắn', 'Đáy', 1, 'Chưa rõ'),
('ca_chuot', 'Cá Chuột', 'Corydoras', 'Corydoras spp.', 24.0, 28.0, 6.5, 7.5, 10.0, 'Hòa bình', 5.0, 0.8, 'Ngắn', 'Đáy', 6, 'Chưa rõ'),
('ca_da_quang', 'Cá Dạ Quang', 'GloFish', '', 24.0, 28.0, 6.5, 7.5, 5.0, 'Hòa bình', 5.0, 0.5, 'Ngắn', 'Mặt', 6, 'Chưa rõ'),
('ca_dia', 'Cá Dĩa', 'Discus', 'Symphysodon spp.', 26.0, 30.0, 6.0, 7.0, 50.0, 'Hòa bình', 15.0, 1.5, 'Ngắn', 'Giữa', 3, 'Chưa rõ'),
('ca_diec_anh_dao', 'Cá Diếc Anh Đào', 'Cherry barb', 'Puntius titteya', 23.0, 27.0, 6.0, 8.0, 5.0, 'Hòa bình', 5.0, 0.5, 'Ngắn', 'Giữa', 6, 'Chưa rõ'),
('ca_duoi_kiem', 'Cá Đuôi Kiếm', 'Swordtail', 'Xiphophorus hellerii', 20.0, 28.0, 7.0, 8.0, 15.0, 'Hòa bình', 10.0, 0.8, 'Ngắn', 'Mặt', 3, 'ukaps.org'),
('ca_hong_ket', 'Cá Hồng Két', 'Blood parrot cichlid', '', 24.0, 28.0, 6.5, 7.5, 150.0, 'Hung dữ', 20.0, 1.5, 'Ngắn', 'Giữa', 1, 'Chưa rõ'),
('ca_hong_kim', 'Cá Hồng Kim', 'Swordtail', 'Xiphophorus hellerii', 20.0, 28.0, 7.0, 8.0, 15.0, 'Hòa bình', 10.0, 0.8, 'Ngắn', 'Mặt', 3, 'Chưa rõ'),
('ca_koi', 'Cá Koi', 'Koi carp', 'Cyprinus rubrofuscus', 15.0, 25.0, 7.0, 8.5, 500.0, 'Hòa bình', 60.0, 2.0, 'Ngắn', 'Giữa', 1, 'Chưa rõ'),
('ca_la_han', 'Cá La Hán', 'Flowerhorn cichlid', '', 26.0, 30.0, 6.5, 7.8, 150.0, 'Hung dữ', 30.0, 1.5, 'Ngắn', 'Giữa', 1, 'Chưa rõ'),
('ca_lau_kieng', 'Cá Lau Kiếng', 'Pleco', 'Hypostomus spp.', 24.0, 28.0, 6.5, 7.5, 100.0, 'Hòa bình', 30.0, 2.0, 'Ngắn', 'Đáy', 1, 'Chưa rõ'),
('ca_molly', 'Cá Molly', 'Molly', 'Poecilia sphenops', 18.0, 28.0, 7.5, 8.2, 10.0, 'Hòa bình', 7.0, 0.8, 'Ngắn', 'Mặt', 3, 'seriouslyfish.com'),
('ca_mun', 'Cá Mún', 'Platy', 'Xiphophorus maculatus', 20.0, 26.0, 7.0, 8.2, 5.0, 'Hòa bình', 5.0, 0.6, 'Ngắn', 'Mặt', 3, 'seriouslyfish.com'),
('ca_neon', 'Cá Neon', 'Neon tetra', 'Paracheirodon innesi', 21.0, 25.0, 4.0, 7.5, 5.0, 'Hòa bình', 4.0, 0.4, 'Ngắn', 'Giữa', 6, 'seriouslyfish.com'),
('ca_rong', 'Cá Rồng', 'Asian arowana', 'Scleropages formosus', 24.0, 30.0, 6.0, 7.0, 500.0, 'Hung dữ', 60.0, 2.0, 'Dài', 'Mặt', 1, 'seriouslyfish.com'),
('ca_sac', 'Cá Sặc', 'Gourami', 'Trichopodus spp.', 24.0, 28.0, 6.0, 7.5, 20.0, 'Hòa bình', 12.0, 1.0, 'Ngắn', 'Mặt', 1, 'Chưa rõ'),
('ca_soc_ngua', 'Cá Sọc Ngựa', 'Zebra danio', 'Danio rerio', 18.0, 25.0, 6.0, 8.0, 5.0, 'Hòa bình', 5.0, 0.5, 'Ngắn', 'Mặt', 6, 'seriouslyfish.com'),
('ca_thien_than', 'Cá Thiên Thần', 'Angelfish', 'Pterophyllum scalare', 24.0, 30.0, 6.0, 7.4, 40.0, 'Hòa bình', 15.0, 1.2, 'Dài', 'Giữa', 1, 'seriouslyfish.com'),
('ca_xiem', 'Cá Xiêm (Betta)', 'Siamese fighting fish', 'Betta splendens', 24.0, 30.0, 6.0, 8.0, 10.0, 'Hung dữ', 7.0, 0.8, 'Dài', 'Mặt', 1, 'seriouslyfish.com');

-- 3. Bảng Lịch sử Nhận diện AI
CREATE TABLE `lich_su_ai` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `duong_dan_anh` VARCHAR(255) NOT NULL,
  `id_loai_ca` INT,
  `do_chinh_xac` FLOAT NOT NULL,
  `phu_hop_khong` BOOLEAN, 
  `thoi_gian_tao` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`id_loai_ca`) REFERENCES `loai_ca`(`id`)
);

-- 4. Bảng Cài đặt Trung tâm (ĐÃ BỔ SUNG CÁC THÔNG SỐ LỌC & THỦY SINH)
CREATE TABLE `cai_dat_ho` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nhiet_do_min` FLOAT NOT NULL DEFAULT 24.0,
  `nhiet_do_max` FLOAT NOT NULL DEFAULT 28.0,
  `ph_min` FLOAT NOT NULL DEFAULT 6.5,
  `ph_max` FLOAT NOT NULL DEFAULT 7.5,
  `muc_nuoc_min` FLOAT NOT NULL DEFAULT 30.0,
  
  -- Kích thước & Cấu hình hồ
  `chieu_dai` FLOAT NOT NULL DEFAULT 60.0, -- cm
  `chieu_rong` FLOAT NOT NULL DEFAULT 40.0, -- cm
  `chieu_cao` FLOAT NOT NULL DEFAULT 40.0, -- cm
  `loai_loc` VARCHAR(50) DEFAULT 'Thác', -- Thác (1.0), Vi sinh (0.8), Thùng (1.3)
  `co_cay_thuy_sinh` BOOLEAN DEFAULT FALSE, -- Cây thủy sinh tăng thêm sức chứa Bioload
  
  -- Điều khiển IoT
  `chu_ky_gui_data` INT NOT NULL DEFAULT 60,
  `che_do_den` VARCHAR(20) NOT NULL DEFAULT 'manual',
  `trang_thai_den` BOOLEAN NOT NULL DEFAULT FALSE,
  `hen_gio_den_bat` TIME DEFAULT '18:00:00',
  `hen_gio_den_tat` TIME DEFAULT '22:00:00',
  `lich_den_thu` VARCHAR(50) DEFAULT '2,3,4,5,6,7,8',
  
  `che_do_bom` VARCHAR(20) NOT NULL DEFAULT 'manual',
  `trang_thai_bom` BOOLEAN NOT NULL DEFAULT TRUE,
  `hen_gio_bom_bat` TIME DEFAULT '06:00:00',
  `hen_gio_bom_tat` TIME DEFAULT '18:00:00',
  `lich_bom_thu` VARCHAR(50) DEFAULT '2,3,4,5,6,7,8',
  
  -- Thay nước tự động
  `sieu_am_day` FLOAT DEFAULT 21.0,
  `sieu_am_tran` FLOAT DEFAULT 3.0,
  `phan_tram_thay` FLOAT DEFAULT 0.0,
  `lich_thay_nuoc_gio` TIME DEFAULT NULL,
  `lich_thay_nuoc_thu` VARCHAR(50) DEFAULT '',
  
  `trang_thai_bom_xa` BOOLEAN DEFAULT FALSE,
  `trang_thai_bom_cap` BOOLEAN DEFAULT FALSE,
  `trang_thai_relay_5` BOOLEAN DEFAULT FALSE,
  
  `ngay_cap_nhat` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
INSERT INTO `cai_dat_ho` (`id`) VALUES (1);

-- 5. Bảng Cá đang nuôi thực tế
CREATE TABLE `ca_dang_nuoi` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `id_loai_ca` INT NOT NULL,
  `so_luong` INT DEFAULT 1,
  `ngay_tha` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`id_loai_ca`) REFERENCES `loai_ca`(`id`)
);

-- 6. Bảng Lịch sử Cảnh báo
CREATE TABLE `lich_su_canh_bao` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `loai_canh_bao` VARCHAR(50) NOT NULL,
  `noi_dung` VARCHAR(255) NOT NULL,
  `da_giai_quyet` BOOLEAN DEFAULT FALSE,
  `thoi_gian_tao` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Bảng Yêu cầu Thêm cá
CREATE TABLE `yeu_cau_them_ca` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `ten_ca_khach_nhap` VARCHAR(100) NOT NULL,
  `trang_thai` VARCHAR(50) DEFAULT 'Đang chờ duyệt',
  `thoi_gian_tao` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tạo Event tự động xóa dữ liệu IoT cũ hơn 3 ngày
SET GLOBAL event_scheduler = ON;
DROP EVENT IF EXISTS `tu_dong_xoa_du_lieu_cu`;
CREATE EVENT `tu_dong_xoa_du_lieu_cu`
ON SCHEDULE EVERY 1 DAY
STARTS CURRENT_TIMESTAMP
DO
  DELETE FROM `du_lieu_cam_bien` WHERE `thoi_gian` < NOW() - INTERVAL 3 DAY;
