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


-- Đổ dữ liệu 21 loài cá từ Excel
INSERT INTO `loai_ca` (`ma_loai`, `ten_hien_thi`, `ten_tieng_anh`, `ten_khoa_hoc`, `nhiet_do_min`, `nhiet_do_max`, `ph_min`, `ph_max`, `the_tich_yeu_cau`, `tinh_cach`, `nguon_trich_dan`) VALUES
('ca_ba_duoi', 'Cá Ba Đuôi (cá vàng)', 'Goldfish', 'Carassius auratus', 4.0, 25.0, 6.0, 8.0, 5.0, 'Hòa bình', 'https://ornamentalfish.org/wp-content/uploads/Goldfish-in-aquaria.pdf'),
('ca_bay_mau', 'Cá Bảy Màu', 'Guppy', 'Poecilia reticulata', 17.0, 28.0, 7.0, 8.5, 40.5, 'Hòa bình', 'https://www.seriouslyfish.com/species/poecilia-reticulata'),
('ca_but_chi', 'Cá Bút Chì', 'Siamese algae eater', 'Crossocheilus oblongus', 24.0, 28.0, 6.5, 7.5, 5.0, 'Hòa bình', 'Chưa rõ'),
('ca_chuot', 'Cá Chuột', 'Corydoras', 'Corydoras spp.', 24.0, 28.0, 6.5, 7.5, 5.0, 'Hòa bình', 'Chưa rõ'),
('ca_da_quang', 'Cá Dạ Quang', 'GloFish', '', 24.0, 28.0, 6.5, 7.5, 5.0, 'Hòa bình', 'Chưa rõ'),
('ca_dia', 'Cá Dĩa', 'Discus', 'Symphysodon spp.', 24.0, 28.0, 6.5, 7.5, 5.0, 'Hòa bình', 'Chưa rõ'),
('ca_diec_anh_dao', 'Cá Diếc Anh Đào', 'Cherry barb', 'Puntius titteya', 24.0, 28.0, 6.5, 7.5, 5.0, 'Hòa bình', 'Chưa rõ'),
('ca_duoi_kiem', 'Cá Đuôi Kiếm', 'Swordtail', 'Xiphophorus hellerii', 20.0, 28.0, 7.0, 8.0, 5.0, 'Hòa bình', '(chưa mở được trang SF trực tiếp) trích lại qua diễn đàn UKAPS: https://ukaps.org/forum/goto/post?id=369418'),
('ca_hong_ket', 'Cá Hồng Két', 'Blood parrot cichlid', '', 24.0, 28.0, 6.5, 7.5, 5.0, 'Hòa bình', 'Chưa rõ'),
('ca_hong_kim', 'Cá Hồng Kim', 'Swordtail', 'Xiphophorus hellerii', 24.0, 28.0, 6.5, 7.5, 5.0, 'Hòa bình', 'Chưa rõ'),
('ca_koi', 'Cá Koi', 'Koi carp', 'Cyprinus rubrofuscus', 24.0, 28.0, 6.5, 7.5, 5.0, 'Hòa bình', 'Chưa rõ'),
('ca_la_han', 'Cá La Hán', 'Flowerhorn cichlid', '', 24.0, 28.0, 6.5, 7.5, 5.0, 'Hòa bình', 'Chưa rõ'),
('ca_lau_kieng', 'Cá Lau Kiếng', 'Pleco', 'Hypostomus / Pterygoplichthys spp.', 24.0, 28.0, 6.5, 7.5, 5.0, 'Hòa bình', 'Chưa rõ'),
('ca_molly', 'Cá Molly', 'Molly', 'Poecilia sphenops', 18.0, 28.0, 7.5, 8.2, 81.0, 'Hòa bình', 'https://www.seriouslyfish.com/species/poecilia-sphenops/'),
('ca_mun', 'Cá Mún', 'Platy', 'Xiphophorus maculatus', 20.0, 26.0, 7.0, 8.2, 5.0, 'Hòa bình', 'https://www.seriouslyfish.com/species/xiphophorus-maculatus'),
('ca_neon', 'Cá Neon', 'Neon tetra', 'Paracheirodon innesi', 21.0, 25.0, 4.0, 7.5, 54.0, 'Hòa bình', 'https://www.seriouslyfish.com/species/paracheirodon-innesi'),
('ca_rong', 'Cá Rồng', 'Asian arowana', 'Scleropages formosus', 22.0, 28.0, 5.0, 8.0, 5.0, 'Hòa bình', 'https://www.seriouslyfish.com/species/scleropages-formosus/'),
('ca_sac', 'Cá Sặc', 'Gourami', 'Trichopodus spp.', 24.0, 28.0, 6.5, 7.5, 5.0, 'Hòa bình', 'Chưa rõ'),
('ca_soc_ngua', 'Cá Sọc Ngựa', 'Zebra danio', 'Danio rerio', 18.0, 25.0, 6.0, 8.0, 5.0, 'Hòa bình', 'https://www.seriouslyfish.com/species/danio-rerio/'),
('ca_thien_than', 'Cá Thiên Thần', 'Angelfish', 'Pterophyllum scalare', 24.0, 30.0, 6.0, 7.4, 200.0, 'Hòa bình', 'https://seriouslyfish.com/species/pterophyllum-scalare'),
('ca_xiem', 'Cá Xiêm (Betta)', 'Siamese fighting fish', 'Betta splendens', 22.0, 30.0, 6.0, 8.0, 41.0, 'Hòa bình', 'https://www.seriouslyfish.com/species/betta-splendens');
