# FF6Tools

FF6Tools is a browser-based app for editing Final Fantasy ROM files for the
NES, SNES, and GBA. The latest version is always available here:
https://everything8215.github.io/ff6tools/

Please post questions and comments in the FF6Tools thread at ff6hacking.com:
https://www.ff6hacking.com/forums/thread-3321.html. You can also find me on
the FF6Hacking Discord server.

FF6Tools started as an app for OS X which is no longer being developed.
Old builds are available here:
https://www.ff6hacking.com/wiki/doku.php?id=ff3:ff3us:util:ff6tools

A few folks have asked if I accept donations, so I set up a Patreon. If you'd
like to help me out, I'd appreciate it!
https://www.patreon.com/everything8215

## Currently supported ROMs

### NES/Famicom

- Final Fantasy (U)
- Final Fantasy (J)
- Final Fantasy I+II (J) (FF1 only)
- Final Fantasy II (Chaos Rush and NeoDemiforce Translations)
- Final Fantasy II (J)
- Final Fantasy III (Translation by Alex W. Jackson, Neill Corlett, SoM2Freak)
- Final Fantasy III (J)

### SNES/Super Famicom

- Final Fantasy II (U)
- Final Fantasy IV (J)
- Final Fantasy V (RPGe translation)
- Final Fantasy V (J)
- Final Fantasy III (U)
- Final Fantasy VI (J)

### Gameboy Advance

- Final Fantasy IV Advance (U)
- Final Fantasy IV Advance (E)
- Final Fantasy V Advance (U)
- Final Fantasy V Advance (E)
- Final Fantasy VI Advance (U)
- Final Fantasy VI Advance (J)
- Final Fantasy VI Advance (E)

## How to Use FF6Tools

Although FF6Tools is a browser-based application, it runs entirely on your
computer. There is no server-side code. When you open and save files, it's just
loading things into your browser. It doesn't actually upload or download
anything to the internet. You must supply your own ROM files.

### Loading a ROM

Click the folder button or press Ctrl+O (Cmd+O on Mac) to select a ROM file.
FF6Tools calculates the CRC32 checksum of the file to determine which ROM you
are attempting to open. FF6Tools uses definition files in either JSON or YAML
format to store all of the information needed to open a ROM file. Definition
files for all of the supported ROMs listed above are included with FF6Tools.

If the CRC32 of your file does not match any of the ROMs currently supported
by FF6Tools, you will be prompted with a list of built-in definitions that you
can select to open your ROM. If you are attempting to open a modified ROM, you
can select the built-in definition that most closely matches it. You can also
choose a custom definition file which you will get when you save your ROM.
When opening a modified ROM that was created by FF6Tools, it is recommended
to choose the definition file that came with it. However, keep in mind though
that as more features are added to FF6Tools, they may not be available with
an older definition file.

If you open a ROM with a 512-byte SNES/SFC copier header, FF6Tools
will remove the header. These headers are obsolete and are neither required
nor recognized by any modern emulators, though some older IPS patches require
a headered ROM.

NES ROMs require a 16-byte iNES header. GBA ROMs never have a header.

### Modifying a ROM

FF6Tools has various editors for modifying the data in a ROM, including maps,
battles, monsters, characters, items, and attacks. The left pane shows a
hierachical view of the data in the ROM that can be modified. Selecting an
item in the hierarchy allows you to edit the data in the center pane (editor)
and the right pane (toolbox and properties). In general, the toolbox and editor
are used to show a visual preview of maps, battles, etc. The properties pane
is used to directly modify properties and attributes of whatever is currently
selected. There is also a script pane that will appear below the editor when
you select a script (for events, monster A.I., etc.).

#### Map Editor

Use the layer buttons above the toolbox to select which
layer to edit. The buttons above the editor can be used to turn layers on and
off, and to show various screen masks like tile passability and the screen
size that will be visible in-game. Left click on the map to draw tiles. Select
tiles in the toolbox by clicking. You can click and drag to select multiple
tiles at once. You can also right click and drag on the map to select tiles
on the currently selected layer.

When the trigger layer is selected, left click on the map to select a trigger.
If there is more than one trigger at the same point, you can click multiple
times to cycle through all of the triggers. Click and drag to move a trigger.
Right click to bring up a menu with options to insert and delete triggers.

#### Battle Editor

Click on a monster to select it. In most games, monsters can be dragged
around to change their position. Click on an empty area of the battle to
select the battle properties, where you can usually add and remove monsters
from the battle. Some games have a VRAM view that allows you to see how the
monster graphics will be stored in the system's video memory.

#### Graphics and Tilemap Editor

FF6Tools does not have any built-in graphics editing capabilities. Instead,
FF6Tools can import and export graphics in several different formats, which
are compatible with widely available graphics editing programs. In order
to preserve color palette data, it is recommended to use indexed png files
whenever possible. When importing graphics, it is possible to import an entire
image, or just a rectangular section of an image. It is also possible to
enable/disable import of the graphics or palette. When importing an RGB image
(non-indexed) FF6Tools will quantize the image and generate an optimized
palette based on the color depth of the target system's graphics. Note,
however, that the colors produced by the quantization may not be in the
correct order for use with the ROM.

The tilemap editor allows you to edit tile data which is used to assemble
tile-based graphics into larger images. The graphics tiles which are available
are displayed in the toolbox in the right pane and can be imported and exported
just as described above. Some tilemaps allow you to flip tiles and change a
tile's layering priority and palette index. Controls for these will be shown
above the toolbox when they are available. Helpful masks can be enabled using
the menu above the tilemap editor.

### Saving a ROM

After you have made changes to a ROM, click the disk button or press
Ctrl+S (Cmd+S on Mac) to save your ROM. FF6Tools will attempt to reassemble
all of the ROM data to make a new ROM file. If this process succeeds, your
browser will "download" a zip file containing the modified ROM, a custom
definition file, and a ROM map. The modified ROM will have the standard ROM
file extension for the applicable system (.nes, .sfc, or .gba). The
definition file is in either JSON (default) or YAML format, and is needed in
order to re-open a modified ROM with FF6Tools. The ROM map is a text file and
is for information only.

In some cases, modified ROM data will increase in size such that it no longer
fits in the region of the ROM where it was originally stored. When this
happends, FF6Tools will prompt you with a list of options for how to deal
with the new data. Note that the "Relocate", "Optimize", and "Expand" options
can cause a ROM to no longer be compatible with patches and other utilities.

### Compatibility with FF3usME

FF3usME is another commonly used ROM editor written by Lord J. Because FF3usME
is closed-source, it is not known exactly what changes it makes when saving a
ROM. Because of this, compatibility issues can arise when trying to
open a ROM previously edited in FF3usME. Fixes for some of these issues are
described here. These fixes can be implemented by editing the definition file
that you use to open a ROM in FF6Tools.

#### World of Ruin Graphics and Tilemap Swapped

If the World of Ruin is blank in the map editor (black/blue vertical stripes)
edit your definition file as follows:

- Search for `"worldGraphics2"` and change its `"range"` to `"0xEF7D07-0xEF9D17"`
- Search for `"worldLayout2"` and change its `"range"` to `"0xEF4A46-0xEF7D07"`

#### World of Balance Graphics Data Moved

This problem seems to be much less common. If the World of Balance looks
corrupted in the map editor (wrong tiles with blue/white palette) edit your
definition file as follows:

- Search for `"worldGraphics1"` change its `"range"` to `"0xEF111C-0xEF3250"`
- Search for `"worldLayout1"` change its `"range"` to `"0xEED434-0xEF111C"`

## Acknowledgments

The following people contributed to FF6Tools, either indirectly by creating
documents and tools that were used for reference or directly via chatting on
various hacking forums and Discord (in no particular order): madsiur,
Geiger/Evil Peer, Cless, Master ZED, Imzogelmo, Terrii Senshi, Mnrogar,
Yousei, Lord J, Novalia Spirit, Corundum, giangurgolo, Disch, Ben Siron,
PKT Paladin, Kea, JCE3000GT, samurai goroh, Lenophis, m06, Squall_FF8,
Warrax, Tenkarider, Grimoire LD, Odym82, Jorgur, instructrtrepe,
Light Phoenix, kwhazit, killXtech, snaphat, Maeson, OS, Dreami

FF6Tools uses the following libraries:

- split.js (https://github.com/nathancahill/split/)
- jszip (https://github.com/Stuk/jszip)
- FileSaver.js (https://github.com/eligrey/FileSaver.js/)
- pako (https://github.com/nodeca/pako)
- ResizeSensor (css-element-queries) (https://github.com/marcj/css-element-queries)
- pzntg (https://github.com/hectorm/pzntg)
- RgbQuant.js (https://github.com/leeoniya/RgbQuant.js/)
- balloon.css (https://github.com/kazzkiq/balloon.css)
- js-yaml (https://github.com/nodeca/js-yaml)
- base64-js (https://github.com/beatgammit/base64-js)
- fontawesome (https://fontawesome.com)
