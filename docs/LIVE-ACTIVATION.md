# Live activation without restarting GNOME Shell

Validated on GNOME Shell 51.1 (Wayland). GNOME 45+ builds the extension registry only at shell startup, so a newly installed extension directory is invisible to the running shell until the next session start. This document describes the supported workaround: register, load and enable the extension in the running shell over D-Bus, after enabling mutter's unsafe mode once in Looking Glass.

See [CHANGELOG.md](../CHANGELOG.md) for the porting changes.

---

# LIVE RECIPE — make `sound-output-device-chooser@kgshank.net` live in the RUNNING GNOME Shell 51.1

**Target:** live shell PID 2983, GNOME Shell 51.1, Wayland session.
**Goal:** register + load + enable the extension in the RUNNING shell without restarting it.
**Validated** in a fully isolated GNOME Shell 51.1 (`--headless --unsafe-mode`, own D-Bus, own XDG dirs).
No command in section 3–5 has been executed against the live bus.

---

## 0. Background

GNOME 51.1's `ExtensionManager` fills its registry exactly once, at startup
(`js/ui/extensionSystem.js` → `_loadExtensions()`, guarded by `_initializationPromise`).
A brand-new extension directory that appears afterwards is invisible to the running shell:

```
$ gnome-extensions info sound-output-device-chooser@kgshank.net
Extension “sound-output-device-chooser@kgshank.net” doesn't exist
```

`enableExtension()` returns `false` for an unknown uuid, and the
`org.gnome.shell enabled-extensions` gsettings key is ignored for uuids that are not
in the registry.

Live JS execution is only possible through `org.gnome.Shell.Eval`, which is gated by
`global.context.unsafe_mode` (a mutter `MetaContext` property). In the running shell that
property can only be flipped through the **Looking Glass** UI — there is no D-Bus method
for it. `--unsafe-mode` as a startup flag is not available to us, because restarting the
shell is forbidden.

**Consequence:** the recipe has two halves — a one-time UI action by the user (enable
unsafe mode), and then a terminal-only, fully scriptable activation.

---

## 1. USER ACTION — enable unsafe mode (3 clicks, one time)

1. Press <kbd>Alt</kbd>+<kbd>F2</kbd> → the "Enter a Command" dialog appears.
2. Type `lg` and press <kbd>Enter</kbd> → Looking Glass opens.
3. Click the **Flags** tab. Scroll down to the **General** section.
   The first switch there is **`unsafe-mode`**. Click it so it becomes **ON**.
4. Press <kbd>Esc</kbd> to close Looking Glass.

Verification (optional):

```bash
gdbus call --session --dest org.gnome.Shell --object-path /org/gnome/Shell \
  --method org.gnome.Shell.Eval "1+1"
# expected: (true, '2')
# (false, '') means unsafe mode is still OFF
```

> Leave Looking Glass open if you prefer — you will need the `unsafe-mode` switch again
> for the cleanup step (section 5).

---

## 2. USER ACTION — make sure the extension is not "enabled" yet

The live shell ignores `enabled-extensions` for unknown uuids, so this key is only a
*preparation* step for section 3. It is harmless either way, but it must be set
**before** the Eval call so the shell's internal `_enabledExtensions` list already
contains the uuid when `loadExtension()` runs (see section 4, "why the order matters").

```bash
gsettings get org.gnome.shell enabled-extensions
```

If the uuid is not in the list yet, add it (this does **not** by itself activate the
extension in the running shell — the shell does not know the uuid yet):

```bash
gsettings set org.gnome.shell enabled-extensions \
  "$(gsettings get org.gnome.shell enabled-extensions | sed "s/'\\]/', 'sound-output-device-chooser@kgshank.net']/")"
```

Verify:

```bash
gsettings get org.gnome.shell enabled-extensions
```

---

## 3. THE ACTIVATION COMMAND (run in a terminal on the LIVE bus)

```bash
gdbus call --session --dest org.gnome.Shell --object-path /org/gnome/Shell \
  --method org.gnome.Shell.Eval \
"(async () => {
  const uuid = 'sound-output-device-chooser@kgshank.net';
  const dir = '/home/steimer/.local/share/gnome-shell/extensions/sound-output-device-chooser@kgshank.net';
  const em = Main.extensionManager;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  for (let i = 0; i < 100 && !em._enabledExtensions.includes(uuid); i++) await sleep(50);
  const ext = em.createExtensionObject(uuid, Gio.File.new_for_path(dir), ExtensionUtils.ExtensionType.PER_USER);
  await em.loadExtension(ext);
  em.enableExtension(uuid);
  for (let i = 0; i < 100; i++) {
    const e = em.lookup(uuid);
    if (e && e.state === 1) return 'ACTIVE';
    await sleep(50);
  }
  return 'FAILED state=' + (em.lookup(uuid)?.state);
})()"
```

**Expected output:** `(true, '"ACTIVE"')`

### Single-line variant (identical, easier to paste)

```bash
gdbus call --session --dest org.gnome.Shell --object-path /org/gnome/Shell --method org.gnome.Shell.Eval "(async () => { const uuid = 'sound-output-device-chooser@kgshank.net'; const dir = '/home/steimer/.local/share/gnome-shell/extensions/sound-output-device-chooser@kgshank.net'; const em = Main.extensionManager; const sleep = ms => new Promise(r => setTimeout(r, ms)); for (let i = 0; i < 100 && !em._enabledExtensions.includes(uuid); i++) await sleep(50); const ext = em.createExtensionObject(uuid, Gio.File.new_for_path(dir), ExtensionUtils.ExtensionType.PER_USER); await em.loadExtension(ext); em.enableExtension(uuid); for (let i = 0; i < 100; i++) { const e = em.lookup(uuid); if (e && e.state === 1) return 'ACTIVE'; await sleep(50); } return 'FAILED state=' + (em.lookup(uuid)?.state); })()"
```

---

## 4. How the script works (and why the order matters)

`org.gnome.Shell.Eval` evaluates a **string** with `eval()` inside the shell process.
Facts established by reading the real 51.1 sources
(`gresource extract /usr/lib/gnome-shell/libshell-51.so …`) and by experiment:

| Fact | Source | Consequence |
|---|---|---|
| `Eval` is gated on `global.context.unsafe_mode` | `js/ui/shellDBus.js` `EvalAsync` | needs the Looking Glass switch |
| `eval()` is called on a plain string; **top-level `await` is a SyntaxError** | `EvalAsync` → `await eval(code)` | must use an **async IIFE**: `(async () => { … })()` — the IIFE's promise is awaited by the shell, so the return value arrives as the D-Bus string |
| `Main`, `ExtensionUtils`, `Gio` are **already in scope** inside Eval | `shellDBus.js` imports them | no `import()` needed |
| `ExtensionUtils.ExtensionType` = `{SYSTEM: 1, PER_USER: 2}` | `misc/extensionUtils.js` | `ExtensionType.PER_USER` = `2` |
| `createExtensionObject(uuid, dir, type)` inserts the uuid into `_extensions` | `extensionSystem.js` | this is the step the startup-only registry was missing |
| `loadExtension()` only *enables* when `this._enabledExtensions.includes(uuid)` | `extensionSystem.js` L428 | the uuid must be in `enabled-extensions` **and** the idle handler must have refreshed `_enabledExtensions` → hence the wait loop at the top of the script |
| `enableExtension(uuid)` returns `false` for unknown uuids | `extensionSystem.js` L277 | must be called **after** `createExtensionObject()` |
| `state === 1` means `ExtensionState.ACTIVE` | `misc/extensionUtils.js` | the wait loop's success criterion |

**Ordering rule:** `gsettings set org.gnome.shell enabled-extensions …` (section 2) →
wait → `Eval` (section 3). The script's first loop waits up to 5 s for the shell's
`changed::enabled-extensions` idle handler to refresh `_enabledExtensions`, so it is
race-free even if the two steps are run back-to-back.

**Important pitfall (observed):** never register the same extension from **two different
directory paths** in one shell. Importing the module twice re-runs
`GObject.registerClass({GTypeName: 'SDCProfileMenuItem'}, …)` in `base.js`, which throws
`Error: Type name SDCProfileMenuItem is already registered` and leaves the extension in
state `ERROR` (3). The recipe uses exactly one path:
`/home/steimer/.local/share/gnome-shell/extensions/sound-output-device-chooser@kgshank.net`.

---

## 5. VERIFICATION (live bus, read-only)

```bash
gdbus call --session --dest org.gnome.Shell --object-path /org/gnome/Shell \
  --method org.gnome.Shell.Extensions.GetExtensionInfo \
  "sound-output-device-chooser@kgshank.net"
```

Expected: `state` → `<1.0>`, `enabled` → `<true>`, `error` → `''`,
`path` → `'/home/steimer/.local/share/gnome-shell/extensions/sound-output-device-chooser@kgshank.net'`.

```bash
gdbus call --session --dest org.gnome.Shell --object-path /org/gnome/Shell \
  --method org.gnome.Shell.Extensions.GetExtensionErrors \
  "sound-output-device-chooser@kgshank.net"
```

Expected: `(@as [],)` — an empty error list.

```bash
gnome-extensions info sound-output-device-chooser@kgshank.net
```

Expected:

```
sound-output-device-chooser@kgshank.net
  Name: Sound Input & Output Device Chooser
  …
  Path: /home/steimer/.local/share/gnome-shell/extensions/sound-output-device-chooser@kgshank.net
  Version: 44
  Enabled: Yes
  State: ACTIVE
```

Optional — open the preferences dialog (this shows a real window on the live screen):

```bash
gnome-extensions prefs sound-output-device-chooser@kgshank.net
```

---

## 6. CLEANUP (reverse the live change)

```bash
# 6a. remove the uuid from enabled-extensions  → the shell disables the extension
gsettings set org.gnome.shell enabled-extensions \
  "$(gsettings get org.gnome.shell enabled-extensions | sed "s/'sound-output-device-chooser@kgshank.net', //; s/, 'sound-output-device-chooser@kgshank.net'//")"

# 6b. unload it from the running shell's registry
gdbus call --session --dest org.gnome.Shell --object-path /org/gnome/Shell \
  --method org.gnome.Shell.Eval \
"(async () => {
  const em = Main.extensionManager;
  const ext = em.lookup('sound-output-device-chooser@kgshank.net');
  if (!ext) return 'already-gone';
  await em.unloadExtension(ext);
  return 'unloaded=' + String(em.lookup('sound-output-device-chooser@kgshank.net'));
})()"
```

Expected: `(true, '"unloaded=undefined"')`
(Step 6a alone already flips the state to `INACTIVE` (2) and removes it from
`_extensionOrder`; 6b additionally removes the registry entry, after which
`gnome-extensions info` reports "doesn't exist" again.)

Verify:

```bash
gnome-extensions info sound-output-device-chooser@kgshank.net
# expected: Extension "sound-output-device-chooser@kgshank.net" doesn't exist
```

### Switch unsafe mode back off

1. <kbd>Alt</kbd>+<kbd>F2</kbd> → type `lg` → <kbd>Enter</kbd>.
2. **Flags** tab → **General** section → click the **`unsafe-mode`** switch back to **OFF**.
3. <kbd>Esc</kbd>.

Verify that unsafe mode is off again (the shell now refuses to evaluate):

```bash
gdbus call --session --dest org.gnome.Shell --object-path /org/gnome/Shell \
  --method org.gnome.Shell.Eval "1+1"
# expected: (false, '')
```

> Turning `unsafe-mode` back off is safe and does **not** affect already-loaded
> extensions; it only closes the `org.gnome.Shell.Eval` door again.

---

## 7. Notes / caveats

* The extension's own `pactl` / `python3` calls are made by the extension itself and run
  against the live PulseAudio/PipeWire server — that is the intended behaviour and
  independent of this recipe.
* `gnome-extensions prefs` opens a real window on the live screen. That is expected.
* If the extension is ever reinstalled while the shell is running, the same recipe applies:
  the uuid must be re-registered because the startup registry is a one-shot.
* A shell restart would make this unnecessary — `gnome-shell` would pick the extension up
  from `~/.local/share/gnome-shell/extensions/` at startup. This recipe exists precisely
  to avoid that.
