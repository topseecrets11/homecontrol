#!/data/data/com.termux/files/usr/bin/sh
# Beast OS tablet setup (run inside Termux): makes localhost:8123 on the tablet
# reach the Beast hub over Wi-Fi, now and on every boot (via Termux:Boot).
set -e
command -v socat >/dev/null || pkg install -y socat

mkdir -p ~/.termux/boot
cat > ~/.termux/boot/beast-forward <<'EOF'
#!/data/data/com.termux/files/usr/bin/sh
# tablet localhost:8123 -> Beast hub. Restarts socat if it ever dies.
pkill -f "socat TCP-LISTEN:8123" 2>/dev/null
while true; do
  socat TCP-LISTEN:8123,bind=127.0.0.1,fork,reuseaddr TCP:192.168.1.106:8080,connect-timeout=3
  sleep 2
done
EOF
chmod +x ~/.termux/boot/beast-forward

# start it now, detached from this terminal
pkill -f beast-forward 2>/dev/null || true
nohup ~/.termux/boot/beast-forward >/dev/null 2>&1 &
echo "BEAST FORWARDER RUNNING"
