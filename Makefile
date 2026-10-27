INSTALL_DIR=~/.local/share/gnome-shell/extensions
SRC_DIR=sound-output-device-chooser@kgshank.net
UUID=sound-output-device-chooser@kgshank.net
LOCALE_SRC=$(shell find $(SRC_DIR) -regextype posix-extended -regex '.*\.(js|glade)' 2> /dev/null)
LOCALE_DIR=$(SRC_DIR)/locale
POT_FILE=$(SRC_DIR)/sound-output-device-chooser.pot
PO_FILES=$(wildcard $(LOCALE_DIR)/*/LC_MESSAGES/*.po)
MO_FILES=$(PO_FILES:.po=.mo)

# --- official bundle (gnome-extensions pack) -------------------------------
GETTEXT_DOMAIN=sound-output-device-chooser
BUNDLE_NAME=sound-output-device-chooser.shell-extension.zip
# gnome-extensions pack resolves --podir and --schema relative to SRC_DIR and
# expects flat <lang>.po files there, so the shipped locale/<lang>/LC_MESSAGES/
# sources are staged into $(SRC_DIR)/po for the duration of the pack.
PO_STAGE_DIR=$(SRC_DIR)/po
SCHEMA_FILE=schemas/org.gnome.shell.extensions.sound-output-device-chooser.gschema.xml
EXTRA_SOURCES=base.js convenience.js settings.js volumeMixerPopupMenu.js icons ui utils license
PACK_FLAGS=--force --out-dir=. --podir=po --gettext-domain=$(GETTEXT_DOMAIN) \
	--schema=$(SCHEMA_FILE) \
	$(foreach s,$(EXTRA_SOURCES),--extra-source=$(s))

.PHONY: all
all: build install

.PHONY: build
build: $(MO_FILES)
	glib-compile-schemas $(SRC_DIR)/schemas

.PHONY: potfile
potfile:
	make $(POT_FILE)

.PHONY: mergepo
mergepo: $(POT_FILE)
	@for po in $(PO_FILES); \
	do \
		msgmerge --add-location --backup=none --sort-output --update $${po} $(POT_FILE); \
	done;

$(POT_FILE): $(LOCALE_SRC)
	@xgettext \
	--add-comments='Translators:' \
	--add-location \
	--from-code=utf-8 \
	--keyword \
	--keyword=_ \
	--keyword=D_:2 \
	--keyword=DC_:2 \
	--keyword=DN_:2,3 \
	--keyword=DP_:2c,3 \
	--keyword=N_:1,2 \
	--keyword=P_:1c,2 \
	--output=$@ \
	--package-name=sound-output-device-chooser \
	--sort-output \
	$^

$(LOCALE_DIR)/%/LC_MESSAGES/sound-output-device-chooser.mo: $(LOCALE_DIR)/%/LC_MESSAGES/sound-output-device-chooser.po
	msgfmt --check --output-file=$@ $<

.PHONY: install
install:
	@echo "Installing extension files in $(INSTALL_DIR)/sound-output-device-chooser@kgshank.net"
	mkdir -p $(INSTALL_DIR)
	cp -r $(SRC_DIR)  $(INSTALL_DIR)

# Build the official GNOME extension bundle with "gnome-extensions pack".
# The result is $(BUNDLE_NAME) in the repository root and can be installed with
#   gnome-extensions install $(BUNDLE_NAME)
.PHONY: bundle
bundle:
	@echo "==> Staging translation sources in $(PO_STAGE_DIR)"
	@rm -rf $(PO_STAGE_DIR)
	@mkdir -p $(PO_STAGE_DIR)
	@for po in $(PO_FILES); do \
		lang=$$(basename "$$(dirname "$$(dirname "$$po")")"); \
		cp "$$po" "$(PO_STAGE_DIR)/$$lang.po"; \
	done
	@echo "==> Running: gnome-extensions pack $(PACK_FLAGS) $(SRC_DIR)"
	gnome-extensions pack $(PACK_FLAGS) $(SRC_DIR)
	@rm -rf $(PO_STAGE_DIR)
	@mv -f "$(UUID).shell-extension.zip" "$(BUNDLE_NAME)"
	@echo "==> Created $(BUNDLE_NAME)"

# Convenience: build the bundle and install it with the official installer.
# The extension is picked up by the shell at the next session start.
.PHONY: install-bundle
install-bundle: bundle
	gnome-extensions install --force $(BUNDLE_NAME)

.PHONY: clean-bundle
clean-bundle:
	rm -f $(BUNDLE_NAME) "$(UUID).shell-extension.zip"
	rm -rf $(PO_STAGE_DIR)

enable:
	gnome-extensions enable $(SRC_DIR)

disable:
	gnome-extensions disable $(SRC_DIR)
