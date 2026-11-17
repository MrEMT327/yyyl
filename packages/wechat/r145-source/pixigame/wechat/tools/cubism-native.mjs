// Vendor code is copied as a separate package, so esbuild's injected browser
// globals do not reach it. Bind the same isolated scope used by the H5 runtime.
export function wrapNativeCubismCore(source) {
  return `module.exports=function(globalThis){const console=globalThis.console,window=globalThis.window,document=globalThis.document,atob=globalThis.atob,btoa=globalThis.btoa,TextDecoder=globalThis.TextDecoder,module=undefined,exports=undefined;\n${source}\nreturn Live2DCubismCore;};`;
}
