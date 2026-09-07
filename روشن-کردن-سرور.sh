#!/bin/bash
# اجرای اپ روی شبکه محلی برای باز کردن در گوشی
export PATH="$HOME/.nvm/versions/node/v24.16.0/bin:$PATH"
cd "$(dirname "$0")"

IP=$(ip -4 addr show wlp4s0 2>/dev/null | grep -oP 'inet \K[\d.]+')
if [ -z "$IP" ]; then
  IP=$(hostname -I | awk '{print $1}')
fi

echo "=============================================="
echo "  اپ روی این آدرس در گوشی باز می‌شود:"
echo ""
echo "  http://$IP:4173"
echo ""
echo "  (گوشی باید به همان وای‌فای لپ‌تاپ وصل باشد)"
echo "  برای توقف: Ctrl+C"
echo "=============================================="

npm run preview -- --host 0.0.0.0 --port 4173 --strictPort
