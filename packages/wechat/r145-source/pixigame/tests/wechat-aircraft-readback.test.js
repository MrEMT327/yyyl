import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeFrameCapture} from '../wechat/src/full/frame-capture.js';

test('a priority aircraft pose replaces an older fenced read without blocking', () => {
  const paints = [], reads = [], cancelled = [];
  const previousBuffer = {}, pixelBuffer = {};
  let binding = previousBuffer, queuedPixel, currentPixel = 12, serial = 0, ready = false;
  const gl = {
    PIXEL_PACK_BUFFER: 1, PIXEL_PACK_BUFFER_BINDING: 2, SYNC_GPU_COMMANDS_COMPLETE: 3,
    SYNC_FLUSH_COMMANDS_BIT: 4, STREAM_READ: 5, RGBA: 6, UNSIGNED_BYTE: 7,
    ALREADY_SIGNALED: 8, TIMEOUT_EXPIRED: 9, NO_ERROR: 0,
    getContextAttributes: () => ({premultipliedAlpha: false}),
    getParameter: () => binding,
    bindBuffer(_target, buffer) { binding = buffer; },
    createBuffer: () => pixelBuffer,
    deleteBuffer() {},
    bufferData() {},
    flush() {},
    getError: () => 0,
    readPixels(_x, _y, _width, _height, _format, _type, output) {
      assert.equal(output, 0, 'a queued read writes into the pixel pack buffer');
      assert.equal(binding, pixelBuffer);
      queuedPixel = currentPixel;
    },
    fenceSync: () => ++serial,
    deleteSync(fence) { cancelled.push(fence); },
    clientWaitSync(fence) {
      assert.equal(fence, serial);
      return ready ? this.ALREADY_SIGNALED : this.TIMEOUT_EXPIRED;
    },
    getBufferSubData(_target, _offset, pixels) { pixels.set([queuedPixel, 0, 0, 255]); },
  };
  const target = {
    createImageData: () => ({width: 1, height: 1, data: new Uint8ClampedArray(4)}),
    putImageData(image) { paints.push(image.data[0]); },
  };
  const capture = createNativeFrameCapture({}, (name, _pixels, run) => { reads.push(name); return run(); });
  const write = mode => capture.write(gl, target, 1, 1, null, undefined, mode);
  try {
    assert.equal(capture.canQueue(gl), true);
    assert.equal(write('async'), false);
    assert.equal(capture.hasPending, true);
    assert.equal(capture.poll(), null);
    currentPixel = 25;
    assert.equal(write('async'), false);
    assert.equal(serial, 1);
    assert.equal(write('async-replace'), false);
    assert.deepEqual(cancelled, [1]);
    assert.deepEqual(paints, []);

    ready = true;
    assert.equal(capture.poll(), true);
    assert.equal(capture.hasPending, false);
    assert.deepEqual(paints, [25]);
    assert.deepEqual(reads, ['aircraftReadSubmit', 'aircraftReadSubmit', 'aircraftReadCopy']);
    assert.equal(binding, previousBuffer);
  } finally {
    capture.dispose();
  }
});

test('a priority pose still uploads immediately on a context without pixel pack buffers', () => {
  let uploaded;
  const gl = {
    getContextAttributes: () => ({premultipliedAlpha: false}),
    readPixels(_x, _y, _width, _height, _format, _type, pixels) { pixels.set([31, 0, 0, 255]); },
  };
  const target = {
    createImageData: () => ({width: 1, height: 1, data: new Uint8ClampedArray(4)}),
    putImageData(image) { uploaded = image.data[0]; },
  };
  const capture = createNativeFrameCapture({});
  try {
    assert.equal(capture.canQueue(gl), false);
    assert.equal(capture.write(gl, target, 1, 1, null, undefined, 'async-replace'), true);
    assert.equal(uploaded, 31);
    assert.equal(capture.hasPending, false);
  } finally {
    capture.dispose();
  }
});
