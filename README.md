# GNOME Shell Extension - Sound Input & Output Device Chooser

A simple selector to enable selection of sound source and sink based on GNOME Control Center.
Adds the device chooser to the GNOME Quick Settings / volume menu, plus keyboard shortcuts and
an optional per-application volume mixer.

This repository is a **fork** of [kgshank/gse-sound-output-device-chooser](https://github.com/kgshank/gse-sound-output-device-chooser).
The GNOME 45+ ESM rewrite is based on the work of
[marcelocampanelli/gse-sound-output-device-chooser](https://github.com/marcelocampanelli/gse-sound-output-device-chooser),
with additional fixes for GNOME 50/51 (see [CHANGELOG.md](CHANGELOG.md)).

Upstream author: GopI (kgshank).

### Supported GNOME Shell versions
* 51
* 50
* 49
* 48
* 47
* 46
* 45

The GNOME 45+ port is an ESM rewrite; the original GNOME <= 43 sources are preserved in
[`legacy/`](legacy/) for reference.

### Dependencies
* `pactl` (PulseAudio) is required for the per-application volume mixer.
* Python 3 is optional and only used for audio port identification (new profile identification).
  Turn off "new profile identification" in the preferences if Python is to be avoided.

### Installation instructions

The official upstream release is on [extensions.gnome.org](https://extensions.gnome.org/extension/906/sound-output-device-chooser).

To install from source (user installation):

```bash
git clone https://github.com/steimerbyte/gse-sound-output-device-chooser.git
cd gse-sound-output-device-chooser
make install
```

`make install` copies the extension to
`~/.local/share/gnome-shell/extensions/sound-output-device-chooser@kgshank.net` and compiles the
GSettings schema. Manual installation works as well:

```bash
cp -r "sound-output-device-chooser@kgshank.net" ~/.local/share/gnome-shell/extensions/
glib-compile-schemas ~/.local/share/gnome-shell/extensions/sound-output-device-chooser@kgshank.net/schemas
```

Then enable it:

```bash
gnome-extensions enable sound-output-device-chooser@kgshank.net
```

> **Note:** On GNOME 45+ a newly installed extension is only picked up by the shell at the next
> session start. After that, enable/disable cycles (`gnome-extensions enable/disable`) reload the
> extension live without restarting the shell.

### Notes
* May conflict with extensions which modify the volume menu.
* The extension's own log output (enabled via the "enable log" preference) is written with
  `console.log`, which is visible at the default GNOME Shell log level.

### [Change log](CHANGELOG.md)
