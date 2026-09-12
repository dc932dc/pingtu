// 编码 Worker：接收 ImageData 像素，在后台线程调用本地 jSquash WASM 编码器，
// 让 AVIF / 大图编码不再阻塞页面主线程。encoders/ 已是相对导入，无需 import map。
const encoders = {};

async function getEncoder(fmt) {
  if (encoders[fmt]) return encoders[fmt];
  const dir = fmt === 'mozjpeg' ? 'jpeg' : fmt;
  const mod = await import(new URL('encoders/' + dir + '/encode.js', self.location).href);
  const encode = mod.default;
  if (typeof encode !== 'function') throw new Error('编码器模块无效：' + fmt);
  return (encoders[fmt] = encode);
}

self.onmessage = async (e) => {
  const { id, fmt, buf, width, height, options } = e.data;
  try {
    const encode = await getEncoder(fmt);
    const imageData = new ImageData(new Uint8ClampedArray(buf), width, height);
    const out = await encode(imageData, options || {});
    self.postMessage({ id, ok: true, buf: out }, [out]);
  } catch (err) {
    self.postMessage({ id, ok: false, message: (err && err.message) || String(err) });
  }
};
