# Ứng dụng Next.js — Lớp học hạnh phúc

Ứng dụng thuộc Giai đoạn 1. Xem [README gốc](../README.md) và
[hướng dẫn triển khai](../docs/giai-doan-1.md) để chạy local, cấu hình Google,
Cloudflare D1 và Vercel.

```bash
npm ci
npm run setup:local
npm run db:migrate:local
npm run db:dev
```

Ở terminal thứ hai chạy `npm run dev`. Production Vercel dùng Root Directory
`web`; tên project mong muốn `e-class`.
