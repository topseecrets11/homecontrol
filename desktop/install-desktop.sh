#!/usr/bin/env bash
# Menu entries, icons, Nemo "Send to Abyss", and the abyss-agent user service.
set -euo pipefail
R="$(cd "$(dirname "$0")/.." && pwd)"
A="$HOME/.local/share/applications"; I="$HOME/.local/share/icons/hicolor/scalable/apps"; N="$HOME/.local/share/nemo/actions"
mkdir -p "$A" "$I" "$N" "$HOME/.config/systemd/user"
for f in beast-os beast-os-abyss blender-abyss; do cp "$R/desktop/$f.svg" "$I/$f.svg"; done
cat > "$A/beast-os.desktop" <<D
[Desktop Entry]
Type=Application
Name=Beast OS
Comment=Your home system: Arena, Node, Sanctum, Oracle, Virgil, Abyss
Exec=$R/bin/beast-os-window
Icon=beast-os
StartupWMClass=127.0.0.1
Categories=Utility;
D
cat > "$A/abyss.desktop" <<D
[Desktop Entry]
Type=Application
Name=Abyss
Comment=Your encrypted vault (pattern lock)
Exec=$R/bin/abyss open
Icon=beast-os-abyss
StartupWMClass=127.0.0.1__m_abyss
Categories=Utility;Security;
D
cat > "$A/blender-abyss.desktop" <<D
[Desktop Entry]
Type=Application
Name=Blender (Abyss)
Comment=Blender with no network, saving into Abyss (Videos/Blender)
Exec=$R/bin/abyss run blender Videos/Blender
Icon=blender-abyss
Categories=Graphics;3DGraphics;
D
cat > "$N/send-to-abyss.nemo_action" <<D
[Nemo Action]
Name=Send to Abyss
Comment=Move into the encrypted Abyss (Pictures, Videos, Music or Documents by type)
Exec=$R/bin/abyss send %F
Icon-Name=beast-os-abyss
Selection=notnone
Extensions=nodirs;
D
cat > "$HOME/.config/systemd/user/abyss-agent.service" <<D
[Unit]
Description=Abyss agent (mounts the encrypted Abyss folders, launches Abyss apps)

[Service]
ExecStart=$R/bin/abyss-agent
Restart=on-failure

[Install]
WantedBy=default.target
D
systemctl --user daemon-reload
systemctl --user enable --now abyss-agent.service
update-desktop-database "$A" 2>/dev/null || true
echo "Menu: Beast OS, Abyss, Blender (Abyss). Nemo: right-click > Send to Abyss."
