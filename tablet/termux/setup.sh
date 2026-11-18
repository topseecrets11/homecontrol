#!/data/data/com.termux/files/usr/bin/sh
# Beast OS: tablet setup. Run inside Termux on the tablet:
#   sh setup.sh
# - replaces the old plain-text socat forward with an SSH tunnel (encrypted, key-only)
#   tablet localhost:8123  ->  Beast OS on Beast (127.0.0.1:8090)
# - starts it on boot (needs the Termux:Boot app) and keeps it alive (autossh)
# - adds: cc (Claude Code in tmux on Beast), p (prompt menu), beast-pair CODE
set -e
BEAST=192.168.1.106
PORT=8090

pkg install -y openssh autossh curl >/dev/null
mkdir -p ~/.ssh ~/.termux/boot ~/bin
chmod 700 ~/.ssh

[ -f ~/.ssh/beast_tablet ] || ssh-keygen -q -t ed25519 -N "" -f ~/.ssh/beast_tablet -C "tablet@beast-os"
cat > ~/.ssh/config <<CFG
Host beast
  HostName $BEAST
  User topsee_crets
  IdentityFile ~/.ssh/beast_tablet
  IdentitiesOnly yes
  ServerAliveInterval 30
  ServerAliveCountMax 3
  ExitOnForwardFailure yes
CFG
chmod 600 ~/.ssh/config

# retire the old socat forwarder
rm -f ~/.termux/boot/beast-forward
pkill -f beast-forward 2>/dev/null || true
pkill -f "socat TCP-LISTEN:8123" 2>/dev/null || true

cat > ~/.termux/boot/beast-tunnel <<'BOOT'
#!/data/data/com.termux/files/usr/bin/sh
# tablet localhost:8123 -> Beast OS, over SSH. autossh restarts it if Wi-Fi drops.
termux-wake-lock 2>/dev/null || true
pkill -f "autossh.*8123:127.0.0.1" 2>/dev/null || true
AUTOSSH_GATETIME=0 autossh -M 0 -f -N -L 8123:127.0.0.1:__PORT__ beast
BOOT
sed -i "s/__PORT__/$PORT/" ~/.termux/boot/beast-tunnel
chmod +x ~/.termux/boot/beast-tunnel

cat > ~/bin/cc <<'CC'
#!/data/data/com.termux/files/usr/bin/sh
# Claude Code on Beast, in a tmux session that survives the tablet sleeping.
exec ssh -t beast 'tmux new -A -s claude'
CC

cat > ~/bin/beast-pair <<'PAIR'
#!/data/data/com.termux/files/usr/bin/sh
# beast-pair 123456   (code from `beast-os pair --role tablet` on Beast)
[ -n "$1" ] || { echo "usage: beast-pair CODE"; exit 1; }
R=$(curl -s -H 'Content-Type: application/json' -d "{\"code\":\"$1\",\"name\":\"Tablet Termux\"}" http://127.0.0.1:8123/api/pair)
T=$(printf '%s' "$R" | sed -n 's/.*"token": *"\([^"]*\)".*/\1/p')
[ -n "$T" ] || { echo "pairing failed: $R"; exit 1; }
umask 077; printf '%s' "$T" > ~/.beast-os-token; echo "paired"
PAIR

cat > ~/bin/p <<'P'
#!/data/data/com.termux/files/usr/bin/sh
# Prompt menu: pick a number to copy it (termux-clipboard-set) or send it to Claude on Beast.
TOK=$(cat ~/.beast-os-token 2>/dev/null) || { echo "run beast-pair CODE first"; exit 1; }
API=http://127.0.0.1:8123
J=$(curl -s -H "Authorization: Bearer $TOK" $API/api/prompts) || exit 1
printf '%s' "$J" | python3 -c '
import sys, json
for i, p in enumerate(json.load(sys.stdin)["prompts"], 1):
    print(f"{i:2}. {p[\"title\"]}")' 2>/dev/null || { echo "$J"; exit 1; }
printf 'number (s<number> to send to Claude): '; read c
case "$c" in
  s*) n=${c#s}; ID=$(printf '%s' "$J" | python3 -c "import sys,json;print(json.load(sys.stdin)['prompts'][$n-1]['id'])")
      curl -s -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' -d "{\"id\":\"$ID\"}" $API/api/prompts/send; echo ;;
  *)  T=$(printf '%s' "$J" | python3 -c "import sys,json;print(json.load(sys.stdin)['prompts'][$c-1]['rendered'])")
      if command -v termux-clipboard-set >/dev/null; then printf '%s' "$T" | termux-clipboard-set; echo copied; else echo "$T"; fi ;;
esac
P
chmod +x ~/bin/cc ~/bin/p ~/bin/beast-pair
grep -q 'HOME/bin' ~/.profile 2>/dev/null || echo 'export PATH="$HOME/bin:$PATH"' >> ~/.profile
pkg install -y python >/dev/null 2>&1 || true

echo
echo "== Add this key on Beast (Beast OS will do it for you if you paste it in the chat):"
cat ~/.ssh/beast_tablet.pub
echo
echo "Then: sh ~/.termux/boot/beast-tunnel   (and it starts itself on boot)"
