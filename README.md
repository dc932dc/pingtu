# 拼接图片 · Combine Images

纯前端、零上传的图片拼接、切割与压缩工具。所有处理在浏览器本地完成，不上传、不留存、不扫描、不识别。

三个功能：

- **拼接图片** —— 纵向 / 横向 / 九宫格拼接，支持直接拖入整个文件夹（递归读取）、拖拽排序、按文件名 / 修改时间排序；可调质量、最长边限制、间距 / 边距 / 圆角 / 背景色，输出 webP / mozJPEG / avif
- **九宫格切割** —— 居中裁切后等分切割，支持 3×3 / 2×2 / 4×4 及自定义行列（2×3 等矩形网格），支持多张批量切割，输出 PNG / JPEG / webP，一键打包 ZIP（批量时按图片分文件夹）
- **图片压缩** —— 批量拖入图片重新编码压体积，质量可调，支持目标体积（压到指定 KB 内自动寻找最高质量），支持 webP / mozJPEG / avif，多张时打包 ZIP

---

## 目录结构

```
pingtu/
├── index.html                    单页应用（UI + 主逻辑）
├── worker.js                     编码 Worker（WASM 编码在后台线程执行）
├── README.md
└── encoders/                     Squoosh / jSquash WASM 编码器（离线内置）
    ├── shared/
    │   └── wasm-feature-detect.js    SIMD / 多线程能力探测（已本地化）
    ├── jpeg/      mozjpeg 编码器
    ├── webp/      webp 编码器（含 SIMD 加速版）
    └── avif/      avif 编码器（含多线程加速版）
```

---

## 性能与实现说明

### Worker 后台编码

WASM 编码（mozJPEG / WebP / AVIF）通过 `worker.js` 在 Web Worker 中执行，主线程只负责画布绘制，AVIF 大图编码期间页面完全可操作。Worker 池按 CPU 核数建 2–4 个，九宫格切块与批量压缩可并行编码；任一 Worker 失败自动回退主线程路径，直接双击 file:// 打开（Worker 受限）也能正常工作。像素缓冲以 transferable 零拷贝移交。

> 注：GitHub Pages 无法自定义 COOP/COEP 响应头，WASM 的多线程加速版（依赖 SharedArrayBuffer）不会启用，实际运行的是单线程 SIMD 版本。

### 解码并发化

拼接 / 切割 / 压缩的图片解码使用 `createImageBitmap`（后台线程解码）并以 4 路并发进行，多图时不再逐张串行等待；解码位图用完立即 `close()` 释放。不支持时回退 `<img>`。

### 文件夹拖入与 ZIP 打包

拖入文件夹时通过 `webkitGetAsEntry` 递归收集目录条目，再以 8 路并发读取文件；ZIP 打包为纯 JS 生成的 store 模式（PNG/JPEG 已是压缩格式，无需再压），**不依赖浏览器的多文件下载许可**。

### 画布尺寸上限保护

浏览器对 Canvas 有硬性限制（单边 16384px、总面积约 1 亿像素）。超出时页面会**自动等比缩小**输出并提示，避免编码直接失败；「最长边限制」会在画布限制之前先行缩小。

### 编码降级链

任一层编码失败都会自动降级，不会中断流程：

```
Squoosh WASM（Worker） → Squoosh WASM（主线程） → 浏览器原生 canvas 编码
```

结果信息栏会标注实际使用的引擎与质量参数。

### 其他

- 宽屏左侧显示目录，点击跳转到当前工具的对应区块，并随滚动自动高亮
- 合并结果图与切块点击可放大查看（点击任意处或 Esc 关闭）
- 切割时受控并发（上限 4 路）编码每块，编码完立即释放画布控制内存峰值
- 文件列表分批渲染 + 缩略图懒加载，拖入几百张图不卡顿
- 所有临时 URL 在移除 / 重置 / 替换时 `revokeObjectURL`，避免内存堆积
- 设置记忆：上次选的格式 / 质量 / 样式保存在 localStorage（只存选项，不存任何图片数据）

---

## 第三方组件

`encoders/` 下的编码器来自 [jSquash](https://github.com/jamsinclair/jSquash)，封装自 Google [Squoosh](https://github.com/GoogleChromeLabs/squoosh) 项目，均为 Apache-2.0 / MIT 许可。各目录内保留原始 LICENSE 与 CHANGELOG。

默认压缩参数取自 Squoosh（页面内可调）：

| 格式 | 默认质量 | 说明 |
|---|---|---|
| mozJPEG | 75 | 渐进式、`optimize_coding` 开启，兼容性最好 |
| WebP | 75 | method 4，体积与速度均衡 |
| AVIF | 50 | speed 10 默认（最快，可改 6 / 8 换更高压缩率），压缩率最高但编码最慢 |

---

## 已知限制

- AVIF 编码较慢，大图可能需要数十秒（已移入后台线程且显示已用时，编码期间页面可正常操作）
- GitHub Pages 上 WASM 多线程加速不生效（平台无法设置 COOP/COEP 响应头）
- 拖入的文件夹会整体递归读取，文件夹内文件极多时解析可能稍有等待
- 打包下载为 ZIP（store 模式），单文件超过 4GB 无法打包
