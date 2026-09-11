# 拼接图片 · Combine Images

纯前端、零上传的图片拼接与切割工具。所有处理在浏览器本地完成，不上传、不留存、不扫描、不识别。

两个功能：

- **拼接图片** —— 纵向 / 横向 / 九宫格拼接，支持拖拽排序、按文件名自然排序，输出 webP / mozJPEG / avif
- **九宫格切割** —— 居中裁切为正方形后等分切割，支持 3×3 / 2×2 / 4×4，输出 PNG / JPEG

---

## 目录结构

```
pingtu-main/
├── index.html                    单页应用（UI + 主逻辑）
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

### 画布尺寸上限保护

浏览器对 Canvas 有硬性限制（单边 16384px、总面积约 1 亿像素）。超出时页面会**自动等比缩小**输出并提示，避免编码直接失败。

### 九宫格切割的并发编码

切割时采用**受控并发**（上限 4 路）并行编码每一块，并在每块编码完成后立即释放画布以控制内存峰值。相比串行方式，16 块（4×4）的墙钟耗时通常缩短 60% 以上。

### 编码降级链

任一层编码失败都会自动降级，不会中断流程：

```
Squoosh WASM（最优） → 浏览器原生 canvas 编码（兼容兜底）
```

降级时结果信息栏会标注实际使用的引擎与质量参数。

### 内存管理

所有缩略图与结果图都使用 `URL.createObjectURL`，在移除文件、重置、替换结果时均会 `revokeObjectURL` 释放，避免长时间使用后内存堆积。

---

## 第三方组件

`encoders/` 下的编码器来自 [jSquash](https://github.com/jamsinclair/jSquash)，封装自 Google [Squoosh](https://github.com/GoogleChromeLabs/squoosh) 项目，均为 Apache-2.0 / MIT 许可。各目录内保留原始 LICENSE 与 CHANGELOG。

默认压缩参数取自 Squoosh：

| 格式 | 质量 | 说明 |
|---|---|---|
| mozJPEG | 75 | 渐进式、`optimize_coding` 开启，兼容性最好 |
| WebP | 75 | method 4，体积与速度均衡 |
| AVIF | 50 | speed 6，压缩率最高但编码最慢 |

---

## 已知限制

- 不支持整个文件夹拖入，需选中图片文件后拖入
- AVIF 编码较慢，大图可能需要数十秒
- 九宫格切割的「全部下载」依赖浏览器多文件下载许可，需在弹窗中允许
