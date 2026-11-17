// Own one pixel pack buffer. The world renderer can reuse its framebuffer
// as soon as readPixels has been queued, and the next frame polls the fence.
export function createAircraftReadback(gl, byteLength, measureTransfer) {
  if (!Number.isFinite(gl.PIXEL_PACK_BUFFER) || typeof gl.fenceSync !== 'function' ||
      typeof gl.clientWaitSync !== 'function' || typeof gl.getBufferSubData !== 'function') return null;

  const target = gl.PIXEL_PACK_BUFFER;
  let buffer, fence, polls = 0, verified = false;

  function withBuffer(run) {
    const previous = gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING) ?? null;
    try {
      gl.bindBuffer(target, buffer);
      return run();
    } finally {
      gl.bindBuffer(target, previous);
    }
  }

  function cancel() {
    const previous = fence;
    fence = null;
    if (previous) gl.deleteSync(previous);
  }

  function queue(width, height) {
    const initialize = !buffer;
    if (initialize) {
      buffer = gl.createBuffer();
      if (!buffer) throw new Error('Cannot allocate aircraft pixel buffer');
    }
    const submit = () => withBuffer(() => {
      if (initialize) gl.bufferData(target, byteLength, gl.STREAM_READ);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, 0);
      fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      if (!fence || (initialize && gl.getError() !== gl.NO_ERROR)) throw new Error('Aircraft pixel read could not be queued');
    });
    if (measureTransfer) measureTransfer('aircraftReadSubmit', byteLength / 4, submit);
    else submit();
    polls = 0;
  }

  function poll(pixels) {
    const status = gl.clientWaitSync(fence, gl.SYNC_FLUSH_COMMANDS_BIT, 0);
    if (status === gl.TIMEOUT_EXPIRED && ++polls < 3) return false;
    if (status !== gl.CONDITION_SATISFIED && status !== gl.ALREADY_SIGNALED) throw new Error('Aircraft pixel fence did not complete');

    const copy = () => withBuffer(() => gl.getBufferSubData(target, 0, pixels));
    // A partial native WebGL2 binding can accept the calls and leave the CPU
    // buffer untouched. Verify an actual visible aircraft before using it.
    if (!verified) pixels.fill(0);
    if (measureTransfer) measureTransfer('aircraftReadCopy', byteLength / 4, copy);
    else copy();
    if (!verified) {
      if (gl.getError() !== gl.NO_ERROR || !pixels.some((alpha, index) => (index & 3) === 3 && alpha !== 0)) {
        throw new Error('Aircraft pixel buffer was not filled');
      }
      verified = true;
    }
    cancel();
    return true;
  }

  return {
    queue, poll, cancel,
    dispose() {
      const previous = buffer;
      buffer = null;
      try { cancel(); }
      finally { if (previous) gl.deleteBuffer(previous); }
    },
  };
}
