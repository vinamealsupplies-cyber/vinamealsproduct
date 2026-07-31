// Type dùng chung giữa server action và client. KHÔNG đặt trong file "use server"
// (re-export type từ đó sinh tham chiếu runtime → ReferenceError khi evaluate).

export type ContactHit = { email: string; name: string; role: string };
