//
// pzntg.js - https://github.com/hectorm/pzntg
// added 5/3/2020
//

function pzntg() {};

pzntg.spec = {
	png: new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
	ihdr: {
		type: new Uint8Array([0x49, 0x48, 0x44, 0x52]),
		data: new Uint8Array([
			// Width
			0x00, 0x00, 0x00, 0x00,
			// Height
			0x00, 0x00, 0x00, 0x00,
			// Bit depth
			0x08,
			// Color type
			0x03,
			// Compression method
			0x00,
			// Filter method
			0x00,
			// Interlace method
			0x00
		])
	},
	plte: {
		type: new Uint8Array([0x50, 0x4C, 0x54, 0x45])
	},
	trns: {
		type: new Uint8Array([0x74, 0x52, 0x4E, 0x53])
	},
	idat: {
		type: new Uint8Array([0x49, 0x44, 0x41, 0x54])
	},
	iend: new Uint8Array([
		// Length
		0x00, 0x00, 0x00, 0x00,
		// Type
		0x49, 0x45, 0x4E, 0x44,
		// CRC32
		0xAE, 0x42, 0x60, 0x82
	])
};

pzntg.int32ToUint8Array = function(num) {
	var bytes = new Uint8Array(4);

	for (var i = 3; i >= 0; i--) {
		bytes[i] = num & (255);
		num = num >> 8;
	}

	return bytes;
}

pzntg.concatChunks = function(chunks) {
	var size = 0, cnt = 0, i;

	for (i = 0; i < chunks.length; i++) {
		size += chunks[i].length;
	}

	var out = new Uint8Array(size);

	for (i = 0; i < chunks.length; i++) {
		out.set(chunks[i], cnt);
		cnt += chunks[i].length;
	}

	return out;
}

pzntg.createChunk = function(type, data) {
	var len = pzntg.int32ToUint8Array(data.length);

	var con = new Uint8Array(type.length + data.length);
	con.set(type, 0);
	con.set(data, type.length);

	var crc = pzntg.int32ToUint8Array(ROM.crc32(con));

	var chunk = new Uint8Array(con.length + 8);
	chunk.set(len, 0);
	chunk.set(con, 4);
	chunk.set(crc, 4 + con.length);

	return chunk;
}

pzntg.createImage = function(width, height, pixels, palette, zlib_level, zlib_memlevel, zlib_strategy) {

	var ihdrBytes = new Uint8Array(pzntg.spec.ihdr.data),
		plteBytes = new Uint8Array(palette.length * 3),
		trnsBytes = new Uint8Array(palette.length),
		idatBytes = new Uint8Array(height * (width + 1));

	var idatCnt = 0;

	var i, j, s1, s2;

	ihdrBytes.set(pzntg.int32ToUint8Array(width), 0);
	ihdrBytes.set(pzntg.int32ToUint8Array(height), 4);

	for (i = 0; i < pixels.length; i++) {
		if ((i % width) === 0) idatBytes[idatCnt++] = 0; // None
		idatBytes[idatCnt++] = pixels[i];
	}

	for (i = 0; i < palette.length; i++) {
		plteBytes[i * 3] = palette[i] & 0xFF;
		plteBytes[i * 3 + 1] = (palette[i] >> 8) & 0xFF;
		plteBytes[i * 3 + 2] = (palette[i] >> 16) & 0xFF;
		trnsBytes[i] = (palette[i] >> 24) & 0xFF;
	}

	var imgBytes = pzntg.concatChunks([
		pzntg.spec.png,
		pzntg.createChunk(pzntg.spec.ihdr.type, ihdrBytes),
		pzntg.createChunk(pzntg.spec.plte.type, plteBytes),
		pzntg.createChunk(pzntg.spec.trns.type, trnsBytes),
		pzntg.createChunk(pzntg.spec.idat.type, pako.deflate(idatBytes, {
			level: zlib_level,
			memLevel: zlib_memlevel,
			strategy: zlib_strategy
		})),
		pzntg.spec.iend
	]);

	return imgBytes;
}

pzntg.create = function(options) {
	if (typeof options !== 'object' || options === null)
		throw new Error('pzntg: \'options\' parameter must be an object');

	if (typeof options.pixels !== 'object' && options.pixels.constructor !== Array)
		throw new Error('pzntg: \'pixels\' option must be an array');

	if (typeof options.palette !== 'object' && options.palette.constructor !== Array)
		throw new Error('pzntg: \'palette\' option must be an array');

	// http://www.zlib.net/manual.html#Constants
	if (typeof options.zlib_level === 'undefined')
		options.zlib_level = pako.Z_DEFAULT_COMPRESSION;
	else if (typeof options.zlib_level !== 'number' || options.zlib_level < 0 || options.zlib_level > 9)
		throw new Error('pzntg: \'zlib_level\' option must be an integer from 0 to 9');

	if (typeof options.zlib_strategy === 'undefined')
		// Z_RLE give better compression for PNG images
		options.zlib_strategy = pako.Z_RLE;
	else if (typeof options.zlib_strategy !== 'number' || options.zlib_strategy < 0 || options.zlib_strategy > 4)
		throw new Error('pzntg: \'zlib_strategy\' option must be an integer from 0 to 4');

	if (typeof options.zlib_memlevel === 'undefined')
		options.zlib_memlevel = 8;
	else if (typeof options.zlib_memlevel !== 'number' || options.zlib_memlevel < 1 || options.zlib_memlevel > 9)
		throw new Error('pzntg: \'zlib_memlevel\' option must be an integer from 1 to 9');

	if (typeof options.callback !== 'undefined' && typeof options.callback !== 'function')
		throw new Error('pzntg: \'callback\' option must be a function');

	var res = pzntg.createImage(
		options.width,
		options.height,
		options.pixels,
		options.palette,
		options.zlib_level,
		options.zlib_memlevel,
		options.zlib_strategy
	);

	if (typeof options.callback === 'function')
		setTimeout(function() {
			options.callback(res);
		}, 0);
	else
		return res;
}

pzntg.getIndexed = function(pngData) {
	var out = {
		palette: null,
		graphics: null,
		colorCount: 0,
		width: 0,
		height: 0
	}

	var offset = 0;
	for (var i = 0; i < 8; i++, offset++) {
		// return if not a png file
		if (pngData[offset] !== pzntg.spec.png[i]) return out;
	}

	var chunks = {};
	var colorCount = 0;
	var bitDepth = 8;
	const imageChunks = [];
	let totalImageLength = 0;

	// parse chunks
	while (offset < pngData.length) {

		var chunk = {};
		chunk.len = pzntg.uint8ArrayToInt32(pngData.subarray(offset, offset + 4));
		offset += 4;
		chunk.type = pzntg.uint8ArrayToString(pngData.subarray(offset, offset + 4));
		offset += 4;
		chunk.data = pngData.subarray(offset, offset + chunk.len);
		offset += chunk.len;
		chunk.crc32 = pngData.subarray(offset, offset + 4);
		offset += 4;

		if (chunk.type === "IDAT") {
			imageChunks.push(chunk.data);
			totalImageLength += chunk.data.length;
		}

		if (!chunks[chunk.type]) chunks[chunk.type] = chunk;

		if (chunk.type === "IEND") break;
	}

	// header
	if (chunks.IHDR) {
		out.width = pzntg.uint8ArrayToInt32(chunks.IHDR.data.subarray(0, 4));
		out.height = pzntg.uint8ArrayToInt32(chunks.IHDR.data.subarray(4, 8));
		bitDepth = chunks.IHDR.data[8];
	}

	// color palette
	if (chunks.PLTE) {
		out.colorCount = Math.floor(chunks.PLTE.len / 3);
		out.palette = new Uint8Array(out.colorCount * 4);
		for (var i = 0; i < out.colorCount; i++) {
			out.palette[i * 4 + 0] = chunks.PLTE.data[i * 3 + 0];
			out.palette[i * 4 + 1] = chunks.PLTE.data[i * 3 + 1];
			out.palette[i * 4 + 2] = chunks.PLTE.data[i * 3 + 2];
			out.palette[i * 4 + 3] = 0xFF;
		}
	}

	// color alpha values
	if (chunks.tRNS && out.palette) {
		for (var i = 0; i < out.colorCount; i++) {
			if (i >= chunks.tRNS.data.length) break;
			out.palette[i * 4 + 3] = chunks.tRNS.data[i];
		}
	}

	// indexed color data
	if (chunks.IDAT) {
		out.graphics = new Uint8Array(out.width * out.height);
		const deflatedData = new Uint8Array(totalImageLength);
		for (let chunk of imageChunks) {
			deflatedData.set(chunk, chunkOffset);
			chunkOffset += chunk.length;
		}
		const inflatedData = pako.inflate(deflatedData);

		// convert to 8bpp

		// use an empty array for the previous scanline
		var scanlineLength = 1 + Math.ceil(out.width / 8 * bitDepth);
		var prev = new Uint8Array(scanlineLength);
		for (var row = 0; row < out.height; row++) {
			var begin = row * scanlineLength;
			var end = begin + scanlineLength;
			if (end > inflatedData.length) break;
			var scanline = inflatedData.subarray(begin, end);
			var unfilteredScanline = pzntg.unfilterScanline(scanline, prev);
			prev = scanline;
			var expandedScanline = pzntg.expandScanline(unfilteredScanline, bitDepth);
			out.graphics.set(expandedScanline.subarray(1), out.width * row);
		}
	}

	return out;
}

pzntg.uint8ArrayToInt32 = function(bytes) {
	var num = 0;

	for (var i = 0; i < 4; i++) {
		num <<= 8;
		num |= bytes[i]
	}

	return num;
}

pzntg.uint8ArrayToString = function(bytes) {
	var string = "";

	for (var i = 0; i < bytes.length; i++) {
		string += String.fromCharCode(bytes[i]);
	}

	return string;
}

pzntg.unfilterScanline = function(scanline, prev) {
	var filter = scanline[0];
	scanline[0] = 0;
	if (filter === 1) {
		for (var i = 1; i < scanline.length; i++) {
			scanline[i] += scanline[i - 1];
		}
	} else if (filter === 2) {
		for (var i = 1; i < scanline.length; i++) {
			scanline[i] += prev[i];
		}
	} else if (filter === 3) {
		for (var i = 1; i < scanline.length; i++) {
			scanline[i] += (prev[i] + scanline[i - 1]) >> 1;
		}
	} else if (filter === 4) {
		for (var i = 1; i < scanline.length; i++) {
			var a = scanline[i - 1];
			var b = prev[i];
			var c = prev[i - 1];
			var p = a + b - c;
			var pa = Math.abs(p - a);
			var pb = Math.abs(p - b);
			var pc = Math.abs(p - c);
			if (pa <= pb && pa <= pc) {
				scanline[i] += a;
			} else if (pb <= pc) {
				scanline[i] += b;
			} else {
				scanline[i] += c;
			}
		}
	}
	return scanline;
}

pzntg.expandScanline = function(scanline, bitDepth) {
	switch (bitDepth) {
		case 8: return scanline;
		case 4:
			var expandedLength = (scanline.length - 1) * 2 + 1;
			var newScanline = new Uint8Array(expandedLength);
			newScanline[0] = scanline[0];
			for (var i = 1; i < scanline.length; i++) {
				newScanline[i * 2 - 1] = scanline[i] >> 4;
				newScanline[i * 2] = scanline[i] & 0x0F;
			}
			return newScanline;
		case 2:
			var expandedLength = (scanline.length - 1) * 4 + 1;
			var newScanline = new Uint8Array(expandedLength);
			newScanline[0] = scanline[0];
			for (var i = 1; i < scanline.length; i++) {
				var b = scanline[i];
				newScanline[i * 4] = b & 3; b >>= 2;
				newScanline[i * 4 - 1] = b & 3; b >>= 2;
				newScanline[i * 4 - 2] = b & 3; b >>= 2;
				newScanline[i * 4 - 3] = b & 3;
			}
			return newScanline;
		case 1:
			var expandedLength = (scanline.length - 1) * 8 + 1;
			var newScanline = new Uint8Array(expandedLength);
			newScanline[0] = scanline[0];
			for (var i = 1; i < scanline.length; i++) {
				var b = scanline[i];
				newScanline[i * 8] = b & 1; b >>= 1;
				newScanline[i * 8 - 1] = b & 1; b >>= 1;
				newScanline[i * 8 - 2] = b & 1; b >>= 1;
				newScanline[i * 8 - 3] = b & 1; b >>= 1;
				newScanline[i * 8 - 4] = b & 1; b >>= 1;
				newScanline[i * 8 - 5] = b & 1; b >>= 1;
				newScanline[i * 8 - 6] = b & 1; b >>= 1;
				newScanline[i * 8 - 7] = b & 1;
			}
			return newScanline;
	}
}
