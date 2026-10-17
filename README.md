# Logistics Planning — phiên bản mở (open)

Frontend tĩnh (HTML/CSS/JS) của Multi-layer Logistics Hub Optimizer, **không qua cổng đăng ký** và **không dùng database**.
Phiên bản có đăng ký (`secure-logisticsplanning.ose.vn` + `access-logisticsplanning.ose.vn`) vẫn chạy riêng, không bị ảnh hưởng.

- `js/config.js`: địa chỉ backend — home server qua Worker `ose-failover` (`https://api-logisticsplanning.ose.vn`), Render dự phòng.
- `/api/solve` gọi thẳng tunnel `api-logisticsplanning-home.ose.vn` (bài MILP có thể quá 5 giây của Worker), lỗi thì chuyển sang Render.
- Bộ chọn máy chủ ở đầu trang: Tự động / Home server / Render (`?api=auto|home|render`).

Cloudflare Pages: Framework None, Build command `exit 0`, Output `.`, Custom domain `open-logisticsplanning.ose.vn`.
