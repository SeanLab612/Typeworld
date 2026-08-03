# Typeworld 资产来源与第三方许可证登记

本文件记录公开仓库中的素材来源。许可证总边界以仓库根目录
[`ASSET-LICENSE.md`](../ASSET-LICENSE.md) 为准：程序代码和脚本采用 MIT；SeanLab 原创
打字机 `.blend` / `.glb` 与原创视觉素材采用 CC BY 4.0；第三方资产保持原许可证，不能由
SeanLab 重新授权。

公开仓库不包含用户提供的私人照片、宠物印章生成中间图、本地下载目录或历史审核附件。

| 资产 | 来源 | 作者 | 许可证 | 用途 |
|---|---|---|---|---|
| `references/typewriter-reference-v3.png` | 当前 Codex 任务内置生图 | SeanLab / OpenAI 图像模型 | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | 视觉与结构参考 |
| `assets/brand/typeworld-social-preview-v1.jpg` | 已审核 Typeworld 首次访问画面的裁切与缩放版本 | SeanLab / OpenAI 图像模型 | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | 首页、Library 兼容页与单卷兼容页的 Open Graph / Twitter 大图；不包含浏览器标签栏、地址栏或外部网站内容 |
| `1930s style typewriter - w/o branding` | [Sketchfab 模型页](https://sketchfab.com/3d-models/1930s-style-typewriter-wo-branding-1d6009449fe84fd79454c4081eb743bf)；用户下载至 `<local-downloads>/1930s_style_typewriter_-_wo_branding.glb` | Kuba “Volant” Wójcik | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | 只读材质、粗糙度、法线和做旧风格对照；不并入正式模型 |
| `assets/models/vendor/wooden-retro-desk.glb` (`Wooden Retro Desk`) | [Sketchfab 模型页](https://sketchfab.com/3d-models/wooden-retro-desk-1f0eb4285d4d4745955083df1031996d)；原始 4K 下载保留在 `<local-downloads>/wooden_retro_desk.glb` | Evan Petrov | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Phase 6 正式桌子资产；经用户改选后并入。生产副本先将三张内嵌 PNG 从 4K 缩至 2K，Phase 9 再缩至 1536 px，Phase 15 缩至 1024 px，以降低首访传输与显存峰值；节点、网格、蒙皮、动画和抽屉绑定保持不变。运行时按目标尺寸定位，不暗示作者为本项目背书 |
| `assets/models/vendor/poly-haven-shelf-01/` (`Shelf 01`, 1K glTF/PBR) | [Poly Haven 资产页](https://polyhaven.com/a/Shelf_01) | Gabriel Radić | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) | 桌面书房左侧旧木书架主体；保留漫反射、法线和 ARM 纹理，运行时调整色调与比例。该资产不包含项目正式书本；未通过的第一版程序化书本不进入本分支基线 |
| `assets/models/vendor/poly-haven-flower-ursinia/` (`Flower Ursinia`, 1K glTF/PBR) | [Poly Haven 资产页](https://polyhaven.com/a/flower_ursinia) | Jenelle van Heerden（摄影）、Rico Cilliers（建模） | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) | Phase 8E `flower` 可逆换肤；使用花冠更完整的三种低复杂度野花变体、1K 漫反射/OpenGL 法线/ARM/透明遮罩。运行时只克隆少量花簇到打字机静态外框，所有实例共享几何和材质；不改变打字机 GLB 与活动节点 |
| `Old Lamp`（已移除的审核方案） | [Sketchfab 模型页](https://sketchfab.com/3d-models/old-lamp-565febe224ee4370844cb3bbdb05238c)；原下载保留在 `<local-downloads>/old_lamp.glb` | Alfelo | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | 曾在 Phase 6 中作为台灯样板接入；按用户最新要求已从运行时、构建产物和仓库副本移除。此行保留来源与历史用途记录，不暗示作者为本项目背书 |
| `cash register` | [Sketchfab 模型页](https://sketchfab.com/3d-models/cash-register-6a886e1e1bf648ae84b688261b491ebc)；用户下载至 `<local-downloads>/cash_register.glb` | pokhodenkodana | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | 只读涂漆金属、方向性划痕、边缘露底和包浆质量标杆；模型和贴图均不并入正式资产 |
| `assets/audio/typewriter/key.mp3` | [Typewriter, Key](https://bigsoundbank.com/machine-a-ecrire-touche-s2842.html)，原始音频编号 2842 | Joseph SARDIN | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) | 真实机械键击录音；裁切、衰减、淡出后用于键杆与字锤反馈 |
| `assets/audio/typewriter/space.mp3` | [Typewriter, space](https://bigsoundbank.com/machine-a-ecrire-espace-s2843.html)，原始音频编号 2843 | Joseph SARDIN | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) | 真实空格杆录音；裁切、增益和淡出后用于空格与退格反馈 |
| `assets/audio/typewriter/bell.mp3` | [Typewriter, Bell #1](https://bigsoundbank.com/typewriter-bell-s2844.html)，原始音频编号 2844 | Joseph SARDIN | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) | 真实行末机械铃录音；裁切、衰减和淡出后用于行末提示 |
| `assets/audio/typewriter/return.mp3` | [Typewriter Carriage Return.wav](https://freesound.org/people/ramsamba/sounds/318686/)，Freesound 预览音频 | ramsamba | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) | 真实滑架回车录音；高通、衰减和淡出后用于 Enter 回车 |
| `assets/audio/paper/page-turn.mp3` (`Turned Page`, sound 0164) | [BigSoundBank 素材页](https://bigsoundbank.com/turned-page-s0164.html) | DavidGreck / BigSoundBank | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) | 真实单页翻动录音，44.1 kHz、16-bit 原始 WAV 的 MP3 分发版本；替换 Projects 阅读页原有的实时合成噪声音效，用于开书、合书与翻页 |
| `assets/audio/fire/burning-paper.mp3` (`1.10_burning-paper.wav`, Freesound 461075) | [Freesound 素材页](https://freesound.org/people/15GKovacovaJulie/sounds/461075/) | 15GKovacovaJulie | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) | 真实纸张燃烧录音；从公开 HQ 预览截取 0.20–3.30 秒，进行 120 Hz 高通、11 kHz 低通、首尾淡化和响度标准化，再转为 44.1 kHz、128 kbps 立体声 MP3。仅在 `fire` 纸张燃烧阶段播放，并服从网站统一静音与音量控制 |
| `assets/audio/music/chopin-nocturne-op9-no2.mp3` (`Nocturne Op. 9 No. 2`) | [Wikimedia Commons 文件页](https://commons.wikimedia.org/wiki/File:Nocturne_Op._9_no._2_in_E_flat_major.mp3)，来源标注为 Musopen | 作曲：Frédéric Chopin；Commons 未标出演奏者 | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 房间古典纯音乐播放器曲目 1；从 Commons MP3 统一转码为 112 kbps MP3，不作为自动播放内容 |
| `assets/audio/music/bach-prelude-bwv847.mp3` (`Prelude No. 2 in C minor, BWV 847`) | [Wikimedia Commons 文件页](https://commons.wikimedia.org/wiki/File:Kimiko_Ishizaka_-_Bach_-_Well-Tempered_Clavier,_Book_1_-_03_Prelude_No._2_in_C_minor,_BWV_847.ogg) | 作曲：J. S. Bach；演奏：Kimiko Ishizaka | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 房间古典纯音乐播放器曲目 2；从 Commons OGG 转码为 112 kbps MP3 |
| `assets/audio/music/beethoven-pathetique-adagio.mp3` (`Pathétique Sonata II. Adagio cantabile`) | [Wikimedia Commons 文件页](https://commons.wikimedia.org/wiki/File:Beethoven,_Sonata_No._8_in_C_Minor_Pathetique,_Op._13_-_II._Adagio_cantabile.ogg) | 作曲：L. van Beethoven；演奏：Paul Pitman | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 房间古典纯音乐播放器曲目 3；从 Commons OGG 转码为 112 kbps MP3 |
| `assets/audio/music/beethoven-minuet-g.mp3` (`Minuet in G major, WoO 10 No. 2`) | [Wikimedia Commons 文件页](https://commons.wikimedia.org/wiki/File:Minuet_in_G_(Beethoven),_piano.ogg) | 作曲：L. van Beethoven；演奏：Peter Johnston | [Public Domain Mark 1.0](https://creativecommons.org/publicdomain/mark/1.0/) / 演奏者放弃限制 | 房间古典纯音乐播放器曲目 4；Commons VRT 页面确认录音可任意使用，统一转码为 112 kbps MP3 |
| `assets/audio/music/bach-goldberg-aria.mp3` (`Goldberg Variations, Aria, BWV 988`) | [Wikimedia Commons 文件页](https://commons.wikimedia.org/wiki/File:Bach,_Goldberg_Variations,_Aria_(Musopen_version).ogg) | 作曲：J. S. Bach；演奏：Shelley Katz | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 房间古典纯音乐播放器曲目 5；从 Commons OGG 转码为 44.1 kHz、112 kbps 立体声 MP3 |
| `assets/audio/music/chopin-waltz-a-minor-b150.mp3` (`Waltz in A minor, B. 150`) | [Wikimedia Commons 文件页](https://commons.wikimedia.org/wiki/File:Chopin_-_Waltz_in_A_minor,_B_150.ogg) | 作曲：Frédéric Chopin；演奏：Aya Higuchi | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 房间古典纯音乐播放器曲目 6；从 Commons OGG 转码为 44.1 kHz、112 kbps 立体声 MP3 |
| `assets/textures/ui/pet-archive-seal-runtime-v2.png` | Typeworld 项目生成素材 | SeanLab / OpenAI 图像模型 | 保留版权；仅随可运行网站分发 | 正式网站宠物档案印章；不属于根目录 `ASSET-LICENSE.md` 的 CC BY 4.0 授权范围 |
| 已删除的 `assets/textures/room/window-*` | 当前 Codex 任务内置生图 | OpenAI 图像模型 | 已从仓库工作区与运行时移除 | 曾用于正面右侧窗户的四段窗景；按用户要求取消窗户后删除，不再构建或发布 |
| `assets/textures/room/wall-map-source.png`、`wall-map-runtime.jpg` | 当前 Codex 任务内置生图 | SeanLab / OpenAI 图像模型 | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Phase 15 Archive Map 首轮资产；复审后已从运行时取消，仅作迭代证据保留 |
| `assets/textures/room/typewriter-study-source.png`、`typewriter-study-runtime.jpg` | 当前 Codex 任务内置生图 | SeanLab / OpenAI 图像模型 | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Phase 15 Machine Study 主视觉；只表达 Typeworld 虚构机械语言，不声称为真实型号工程图 |
| `assets/textures/room/word-record-source-v1.png`、`word-record-runtime-v1.jpg` | 当前 Codex 任务内置生图 | SeanLab / OpenAI 图像模型 | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Phase 15 Word Record 独立墙面纸张；source 保留，runtime JPEG 轻量化后由独立 Three.js 节点承载 |
| `assets/textures/projects/typeworld-volume-01-cover-base-v1.jpg` | 当前 Codex 任务内置生图；从零生成，无第三方图像输入 | SeanLab / OpenAI 图像模型 | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Projects Books P1 原创封面底图；深酒红布面与虚构机械线稿，无文字、Logo 或水印。标题与金箔层由运行时独立生成，不复制 Stripe Press 封面 |
| `assets/textures/projects/typeworld-volume-02-cover-base-v1.jpg`、`typeworld-volume-03-cover-base-v1.jpg`、`typeworld-volume-04-cover-base-v1.jpg` | 当前 Codex 任务内置生图；三张分别从零生成，无第三方图像输入 | SeanLab / OpenAI 图像模型 | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Projects Books P2 原创系列封面底图：午夜蓝机械/穿孔卡、氧化绿植物/键盘矩阵、炭紫天文/信号路径。均无正式文字、Logo 或水印；运行时独立叠加书名与金箔层，不复制 Stripe Press 封面 |
| `assets/environments/green/meadow_1k.hdr` (`Meadow`) | [Poly Haven 资产页](https://polyhaven.com/a/meadow) | Sergej Majboroda | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) | Phase 8A 被否决的第一版草原 HDRI；文件只保留为迭代证据，生产构建不再发射 |
| `assets/environments/green/sparse_grass_diff_1k.jpg`、`sparse_grass_nor_gl_1k.jpg`、`sparse_grass_rough_1k.jpg` (`Sparse Grass`) | [Poly Haven 资产页](https://polyhaven.com/a/sparse_grass) | Amal Kumar | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) | Phase 8A 被否决的第一版程序草地 PBR 纹理；文件只保留为迭代证据，生产构建不再发射 |
| `assets/environments/green/noon_grass_8k.jpg`、`noon_grass_2k.hdr` (`Noon Grass`) | [Poly Haven 资产页](https://polyhaven.com/a/noon_grass) | Greg Zaal | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) | Phase 8A 写实第二版：8K 色调映射实景全景负责清晰草原背景，2K HDR 负责打字机环境光与反射；运行时增加透明接触阴影，不复制第二台打字机 |
| `assets/textures/green/leafset029/` (`Leaf Set 029`, 1K JPG PBR) | [ambientCG 资产页](https://ambientcg.com/a/LeafSet029) | ambientCG | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) | Phase 8 新版 `green` 打字机换肤；使用常春藤摄影测量颜色、OpenGL 法线、粗糙度与透明遮罩图集。Three.js 只生成藤蔓路径和低面数叶片承载网格，不伪造纯色塑料叶片 |
| `assets/textures/green/bark014/` (`Bark 014`, 1K JPG PBR) | [ambientCG 资产页](https://ambientcg.com/a/Bark014) | ambientCG | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) | Phase 8 新版 `green` 打字机换肤；藤茎使用摄影测量颜色、OpenGL 法线与粗糙度贴图，并沿 TubeGeometry 重复采样 |

后续任何外部资产必须在使用前登记。只允许许可证明确、与预期用途兼容的来源。

2026-07-30 的 img2threejs 材质旁路没有新增第三方模型、纹理或音效。其 PBR 提取结果仅由
仓库现有 `references/typewriter-reference-v3.png` 派生，并作为分析证据保存；没有把
Sketchfab 对照模型的贴图复制进正式打字机。

Phase 5 最初的纯合成音色未通过用户听感验收，现已改为以上真实机械录音采样。
Web Audio 只负责采样调度、轻微速度变化、音量控制，以及采样尚未解码时的短噪声兜底；
不再用方波、锯齿波或正弦振荡器模拟主要机械声。

Phase 6 的旧程序化煤油灯几何仍可由仓库脚本复现，但运行时已隐藏且不再加载第三方灯具；
交互代理和归档槽仍由仓库内
`scripts/blender/build_typewriter_environment.py` 程序化生成。旧自制桌子网格仍保留为
可复现回退资产，但运行时视觉网格已由上表 CC BY 4.0 桌子替代。该脚本同时生成
`assets/textures/environment/aged-wood-color.png`、
`assets/textures/environment/aged-wood-roughness.png` 和
`assets/textures/environment/aged-wood-normal.png`、
`assets/textures/environment/aged-wood-ao.png`、
`assets/textures/environment/aged-brass-color.png`、
`assets/textures/environment/aged-brass-roughness.png` 和
`assets/textures/environment/aged-brass-normal.png`。第三方桌子目前直接保留原始 GLB，
避免 Blender 二次导出破坏其骨骼坐标。旧 Phase 8A 的 Poly Haven 草原资产保留为
被否决方案的迭代证据，不再进入生产构建。新版 `green` 只给现有虚构打字机增加可逆
藤蔓覆盖层，不改写、不覆盖第三版打字机参考图，也不合并任何活动节点。

Phase 8B 的紫色魔法书符文、光点与局部能量光全部由仓库内 Three.js ShaderMaterial、
PlaneGeometry 和 Points 程序生成，没有新增第三方图片、模型、视频、纹理或音效。
