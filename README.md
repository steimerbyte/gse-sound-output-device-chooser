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

GNOME 50.1 is verified on Ubuntu 26.04 (Wayland, PipeWire 1.6): the extension reaches state
`ACTIVE` without errors and registers its "Sound Devices" row in the Quick Settings menu.

### Dependencies
* Python 3 is optional and only used for audio port identification (new profile identification).
  Turn off "new profile identification" in the preferences if Python is to be avoided.
* `pactl` (from `pulseaudio-utils`) is optional and only used for the per-application volume
  mixer's "route this stream to sink" submenu. Without `pactl` that submenu is skipped; the
  device chooser itself works without it because it uses Gvc, not PulseAudio.

### Official installation

The recommended way to install this fork is the official GNOME route: build an extension
bundle with `gnome-extensions pack` and install it with `gnome-extensions install`.

```bash
cd ~/workspace/gse-sound-output-device-chooser
make bundle
gnome-extensions install sound-output-device-chooser.shell-extension.zip
```

`make bundle` runs `gnome-extensions pack` on the extension directory and produces
`sound-output-device-chooser.shell-extension.zip` in the repository root. `gnome-extensions install`
unpacks that bundle into `~/.local/share/gnome-shell/extensions/sound-output-device-chooser@kgshank.net`,
compiles the GSettings schema and installs the translations.

**The extension becomes active at the next session start.** That is the documented behaviour of
`gnome-extensions install`: on GNOME 45+ the running shell only loads extensions that were already
known when the session started, so a freshly installed extension is picked up after the next login
(not by the running shell).

If the extension is not enabled automatically, enable it once:

```bash
gnome-extensions enable sound-output-device-chooser@kgshank.net
```

To open the preferences (sound device selection, mixer, shortcuts):

```bash
gnome-extensions prefs sound-output-device-chooser@kgshank.net
```

`make install-bundle` does both steps in one go (build the bundle, then install it).
If you need the extension active in the *running* shell without waiting for a session start,
see [docs/LIVE-ACTIVATION.md](docs/LIVE-ACTIVATION.md).

### Installation from source (alternative)

The original upstream project
([kgshank/gse-sound-output-device-chooser](https://github.com/kgshank/gse-sound-output-device-chooser),
also on [extensions.gnome.org](https://extensions.gnome.org/extension/906/sound-output-device-chooser))
is unmaintained: its last release is for GNOME Shell 43 and does not load on GNOME 45+ because it
still uses the legacy `imports.gi` module system. Install this fork instead.

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

### License
GPL-3.0-or-later, see [LICENSE](LICENSE). This fork is distributed under the same license as the
original work; the copyright and author headers of the sources are unchanged.

Third-party code:
* `sound-output-device-chooser@kgshank.net/volumeMixerPopupMenu.js` originates from
  [mymindstorm/gnome-volume-mixer](https://github.com/mymindstorm/gnome-volume-mixer),
  Copyright (c) Brendan Early, MIT licensed, and is integrated under GPL-3.0-or-later.
* The GNOME 45+ ESM rewrite is based on
  [marcelocampanelli/gse-sound-output-device-chooser](https://github.com/marcelocampanelli/gse-sound-output-device-chooser),
  GPL-3.0.

### [Change log](CHANGELOG.md)
