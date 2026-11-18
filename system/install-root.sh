#!/usr/bin/env bash
# One-time root setup for Beast OS. Run:  sudo ~/homecontrol/system/install-root.sh
# Safe to run again. Does not touch the phone's existing setup.
set -euo pipefail
U=topsee_crets
HERE="$(cd "$(dirname "$0")" && pwd)"
step() { printf '\n== %s\n' "$*"; }

[ "$(id -u)" = 0 ] || { echo "run with sudo"; exit 1; }
LOG=/tmp/beast-os-install.log
exec > >(tee "$LOG") 2>&1
trap 'echo; echo "!! stopped at line $LINENO (see $LOG)"' ERR

step "1/6 packages"
apt-get install -y gocryptfs openssh-server autossh kdeconnect tmux

step "2/6 SSH: keys only, $U only (no keys yet = nobody can log in)"
install -m 644 "$HERE/sshd-beast-os.conf" /etc/ssh/sshd_config.d/10-beast-os.conf
mkdir -p /run/sshd && chmod 755 /run/sshd      # sshd -t needs it; Mint only makes it when ssh first starts
sshd -t
systemctl enable --now ssh

step "3/6 firewall: LAN + tailnet only"
for p in 22/tcp 8090/tcp 8080/tcp 1714:1764/tcp 1714:1764/udp; do
  ufw allow from 192.168.1.0/24 to any port "${p%/*}" proto "${p#*/}" >/dev/null
  ufw allow in on tailscale0 to any port "${p%/*}" proto "${p#*/}" >/dev/null
done
ufw status | sed -n '1,40p'

step "4/6 Beast OS + Ollama as system services (outbound blocked)"
runuser -u $U -- env XDG_RUNTIME_DIR=/run/user/1000 systemctl --user disable --now beast-os.service ollama.service 2>/dev/null || true
install -m 644 "$HERE/beast-os.service" /etc/systemd/system/beast-os.service
install -m 644 "$HERE/ollama.service" /etc/systemd/system/ollama.service
systemctl daemon-reload
systemctl enable --now ollama.service beast-os.service
sleep 2
systemctl --no-pager --lines=0 status beast-os.service ollama.service | grep -E 'Loaded|Active'

step "5/6 one-way check (expect BLOCKED)"
if systemd-run -P -q --wait -p User=$U -p IPAddressDeny=any -p IPAddressAllow=localhost \
     curl -s -m 5 -o /dev/null https://example.com; then echo "internet: OPEN (unexpected)"; else echo "internet: BLOCKED"; fi

chmod 644 "$LOG"
step "6/6 done"
echo "Beast OS: http://127.0.0.1:8090   Pair devices with: ~/homecontrol/bin/beast-os pair"
