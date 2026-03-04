# 第一部分：音频（mp3/wav）→ MIDI 工具链

目标约束：所有方案的终点都必须是标准 MIDI（`.mid`），可落到 `note_number + velocity + tick` 三元组。

## A) 人声/歌声 → MIDI（单旋律线）

### 1) Basic Pitch（Spotify）

- 原理：
  - 端到端音高/音符转录模型，直接输出音符事件与 MIDI（支持弯音信息）。
  - 对单旋律人声、单乐器通常有较好结果；复杂混音下会下降。
- 安装：
  - `uv add basic-pitch mido`
  - `pip install basic-pitch mido`
- 最小可运行代码（Python API）：

```python
from basic_pitch.inference import predict

audio_path = "input_vocal.wav"  # 也可 mp3
_, midi_data, note_events = predict(audio_path)
midi_data.write("vocal_basic_pitch.mid")
print(f"extracted_notes={len(note_events)}")
```

- 输入/输出：
  - 输入：`wav/mp3`
  - 输出：标准 MIDI（`vocal_basic_pitch.mid`）
- 转换质量评估：
  - 人声主旋律：高（干声、少混响时更稳）
  - 复杂伴奏混入时：中等
- MIDI 精度（经验）：
  - `note_number`：中高到高（单旋律）
  - `velocity`：可用，但更接近“置信度/强度估计”而非真实演奏力度
  - `tick` 时序：中高；建议后处理量化（1/16 或 1/32）以提升网格一致性

### 2) SOME（Singing-Oriented MIDI Extractor）

- 原理：
  - 面向歌声的 MIDI 提取框架，强调歌唱场景下的音符边界与表现参数提取。
  - 更偏“歌声专用”而非通用乐器转录。
- 安装：
  - 仓库版（当前主流用法）：
    - `git clone https://github.com/openvpi/SOME.git`
    - `cd SOME`
    - `uv pip install -r requirements.txt`
- 最小可运行代码（调用官方推理脚本）：

```python
import subprocess
import sys

subprocess.run(
    [
        sys.executable,
        "infer.py",
        "-i",
        "input_vocal.wav",
        "-o",
        "vocal_some.mid",
        "--model",
        "checkpoints/best.ckpt",
    ],
    check=True,
)
```

- 输入/输出：
  - 输入：`wav`（建议人声干声）
  - 输出：标准 MIDI（`vocal_some.mid`）
- 转换质量评估：
  - 人声单旋律：高（尤其针对中文/流行歌唱语料训练场景）
  - 非歌声输入：不推荐
- MIDI 精度（经验）：
  - `note_number`：高（在干净歌声上）
  - `velocity`：取决于模型输出映射策略，通常可作为相对力度
  - `tick` 时序：高于通用模型的歌声边界稳定性（仍建议量化修正）

### 3) CREPE：基频检测（F0）→ MIDI `note_number`

- 原理：
  - CREPE先做逐帧基频估计（Hz），再由公式 `69 + 12*log2(f/440)` 转成 MIDI 音高。
  - 需配合 onset/segment（如 librosa）把连续 F0 切分成离散音符，才能写出 MIDI 音符事件。
- 安装：
  - `uv add crepe librosa numpy mido`
- 最小可运行代码（F0 + onset + MIDI）：

```python
import numpy as np
import librosa
import crepe
from mido import MidiFile, MidiTrack, Message

y, sr = librosa.load("input_vocal.wav", sr=16000, mono=True)
times, freqs, conf, _ = crepe.predict(y, sr, step_size=10, viterbi=True)

onset_frames = librosa.onset.onset_detect(y=y, sr=sr, hop_length=160)
onset_times = librosa.frames_to_time(onset_frames, sr=sr, hop_length=160)
boundaries = np.r_[onset_times, times[-1] + 0.01]

tpb = 480
tempo_us_per_beat = 500000  # 120 BPM

def sec_to_tick(sec: float) -> int:
    return int(sec * tpb * 1_000_000 / tempo_us_per_beat)

events = []
for start, end in zip(boundaries[:-1], boundaries[1:]):
    idx = (times >= start) & (times < end) & (conf > 0.5) & (freqs > 0)
    if not np.any(idx):
        continue
    midi_note = int(np.round(np.median(69 + 12 * np.log2(freqs[idx] / 440.0))))
    midi_note = int(np.clip(midi_note, 0, 127))
    velocity = int(np.clip(np.mean(conf[idx]) * 127, 1, 127))
    s_tick = sec_to_tick(float(start))
    e_tick = sec_to_tick(float(end))
    if e_tick <= s_tick:
        continue
    events.append((s_tick, True, midi_note, velocity))
    events.append((e_tick, False, midi_note, 0))

events.sort(key=lambda x: x[0])
mid = MidiFile(ticks_per_beat=tpb)
track = MidiTrack()
mid.tracks.append(track)

last_tick = 0
for tick, is_on, note, vel in events:
    delta = tick - last_tick
    track.append(
        Message("note_on" if is_on else "note_off", note=note, velocity=vel, time=delta)
    )
    last_tick = tick

mid.save("vocal_crepe.mid")
```

- 输入/输出：
  - 输入：`wav/mp3`（建议先转 `wav`）
  - 输出：标准 MIDI（`vocal_crepe.mid`）
- 转换质量评估：
  - 基频连续跟踪很强，但“音符切分”质量取决于后处理算法。
- MIDI 精度（经验）：
  - `note_number`：中高（依赖平滑/去颤处理）
  - `velocity`：通常来自置信度或能量映射，语义较弱
  - `tick` 时序：中等到中高（强依赖 onset 质量）

### 4) NeuralNote（补充）

- 定位：
  - NeuralNote 是桌面/VST 场景里常见的“音频转 MIDI”工具，底层使用 Basic Pitch。
  - 更适合交互式工作流（拖放音频后导出 MIDI），不强调 Python API。
- 安装：
  - 非典型 Python 库，不推荐 `uv add` 作为主集成方式。
- 输入/输出：
  - 输入：音频片段
  - 输出：标准 MIDI（宿主内拖拽/导出）

### 人声工具对比（单旋律）

| 工具 | 核心机制 | `note_number` 准确率 | 时序（tick）准确率 | 支持多音 | 速度 | 备注 |
|---|---|---|---|---|---|---|
| Basic Pitch | 端到端音符转录 | 高 | 中高 | 有限（复杂多音下降） | 快 | API 友好，工程集成成本低 |
| SOME | 歌声专用音符提取 | 高（歌声场景） | 高（歌声边界更稳） | 否（偏单旋律） | 中 | 对歌声更专注 |
| CREPE+onset | F0 + 规则后处理 | 中高 | 中等~中高 | 否（默认单旋律） | 快 | 可解释性强，需自己调参 |
| NeuralNote | GUI 封装（基于 Basic Pitch） | 高（单线） | 中高 | 有限 | 快 | 交互好，自动化弱 |

## B) 钢琴/单乐器 → MIDI

### 1) Basic Pitch（同样可用于钢琴）

- 安装：`uv add basic-pitch mido`
- 代码：与上文 Basic Pitch 完全一致（输入换成钢琴音频）。
- 适用性：
  - 单乐器/轻度复音可用；
  - 高密度钢琴复调时，漏检/粘连会增加。

### 2) Onsets and Frames（Google Magenta，钢琴转录经典方案）

- 原理：
  - 先检测 onset（起音），再用 frame-level 激活约束，改善钢琴复调音符边界。
  - 专门针对钢琴转录，学术与工程引用都很多。
- 安装：
  - `uv add magenta note-seq tensorflow`
- 最小可运行代码（通过官方 CLI 入口，在 Python 中调用）：

```python
import subprocess

subprocess.run(
    [
        "onsets_frames_transcription_transcribe",
        "--model_dir=./onsets_frames_checkpoint",
        "--audio_file=./piano.wav",
        "--output_dir=./out",
    ],
    check=True,
)

# 输出通常为 ./out/*.midi（标准 MIDI）
```

- 输入/输出：
  - 输入：钢琴 `wav`
  - 输出：标准 MIDI（`.midi/.mid`）
- 转换质量评估：
  - 钢琴复调通常优于通用模型；
  - 对非钢琴音色泛化能力一般。
- MIDI 精度（经验）：
  - `note_number`：高（钢琴）
  - `velocity`：中高（相对力度可用）
  - `tick` 时序：高（onset 检测优势明显）

### 钢琴方法对比

| 方法 | 目标乐器 | 复调能力 | note 精度 | 时序精度 | 工程复杂度 |
|---|---|---|---|---|---|
| Basic Pitch | 通用 | 中等 | 中高 | 中高 | 低 |
| Onsets and Frames | 钢琴优先 | 高 | 高 | 高 | 中高 |

## C) 通用音频 → MIDI（多音多乐器）

### 1) 限制说明（现状）

- 直接把完整混音（人声+鼓+和声+贝斯）一次性转成高质量“多轨 MIDI”仍然困难。
- 当前更可靠主流 pipeline：
  - 先做音源分离（Demucs）
  - 再对每个 stem 用更合适的单轨转录器（Basic Pitch / SOME / 钢琴专用模型）
  - 最后用 `mido` 合并或清洗为一个标准 MIDI。

### 2) Demucs（Meta）分离 → 各轨单独转 MIDI

- 安装：
  - `uv add demucs basic-pitch mido`
- 最小可运行代码（Demucs + Basic Pitch + mido 合并）：

```python
import subprocess
from pathlib import Path
from basic_pitch.inference import predict
from mido import MidiFile, MidiTrack, merge_tracks

audio = "mix.wav"
subprocess.run(["python", "-m", "demucs", "-n", "htdemucs", audio], check=True)

song = Path(audio).stem
stem_dir = Path("separated") / "htdemucs" / song
stem_midis = []

for stem in ["vocals", "bass", "drums", "other"]:
    wav = stem_dir / f"{stem}.wav"
    if not wav.exists():
        continue
    _, midi_data, _ = predict(str(wav))
    out_mid = stem_dir / f"{stem}.mid"
    midi_data.write(str(out_mid))
    stem_midis.append(out_mid)

tracks = []
for p in stem_midis:
    src = MidiFile(str(p))
    tracks.append(merge_tracks(src.tracks))

merged = MidiFile(ticks_per_beat=480)
merged_track = MidiTrack()
merged_track.extend(merge_tracks(tracks))
merged.tracks.append(merged_track)
merged.save("output.mid")
```

- 输入/输出：
  - 输入：完整混音 `wav/mp3`
  - 输出：`output.mid`（标准 MIDI）
- 转换质量评估：
  - 人声/贝斯轨：通常最好
  - 鼓轨：若目标是“有音高 MIDI”，质量通常较差（更适合打击乐事件化）
  - 伴奏和声：受分离串扰影响明显
- MIDI 精度（经验）：
  - `note_number`：中等（分轨后可提升到中高）
  - `velocity`：中等（受分离质量影响）
  - `tick` 时序：中高（分离后 onset 更清晰）


# 第二部分：DAW 工程文件 → MIDI

## A) Logic Pro（`.logicx`）

- 文件结构：
  - `.logicx` 是 macOS package（逻辑上“单文件”，实际是目录容器）。
  - 常见可见内容包含 `Alternatives/`、`Resources/`，以及 `MetaData.plist`、`ProjectData` 等内部文件。
- 是否可直接提取 MIDI regions：
  - 实务上不可靠。`ProjectData` 缺少公开稳定规格，直接反解 MIDI region 风险高。
- Python 解析可行性：
  - 可读取 plist 元数据；难以稳定提取完整 MIDI 音符事件。
- 最小代码（元数据可读，MIDI region 不保证可直接解）：

```python
from pathlib import Path
import plistlib

pkg = Path("MySong.logicx")

for plist_path in pkg.rglob("*.plist"):
    with plist_path.open("rb") as f:
        data = plistlib.load(f)
    print(plist_path, "keys:", list(data)[:5])
```

- 最可靠方案（官方）：
  - 在 Logic 内执行 `File > Export > Selection as MIDI File`，直接导出标准 MIDI。

## B) Ableton Live（`.als`）

- 文件格式：
  - `.als` 可按 gzip 压缩 XML 处理（工程上可解压后用 XML 解析）。
- Python 解析方法：
  - `gzip` 解压 + `xml.etree.ElementTree` 遍历 `MidiClip/MidiNoteEvent`。
- 最小可运行代码（提取 MIDI note 事件并写 `output.mid`）：

```python
import gzip
import xml.etree.ElementTree as ET
from mido import MidiFile, MidiTrack, Message

with gzip.open("project.als", "rb") as f:
    root = ET.fromstring(f.read())

tpb = 480
events = []

for n in root.findall(".//MidiNoteEvent"):
    # 不同版本标签/属性可能有差异，这里做保守兜底
    key = int(n.get("Key", n.get("Note", "60")))
    vel = int(float(n.get("Velocity", "100")))
    start_beat = float(n.get("Time", "0"))
    dur_beat = float(n.get("Duration", "0.25"))
    s_tick = int(start_beat * tpb)
    e_tick = int((start_beat + dur_beat) * tpb)
    events.append((s_tick, True, key, max(1, min(127, vel))))
    events.append((e_tick, False, key, 0))

events.sort(key=lambda x: x[0])
mid = MidiFile(ticks_per_beat=tpb)
track = MidiTrack()
mid.tracks.append(track)

last = 0
for tick, is_on, note, vel in events:
    track.append(
        Message("note_on" if is_on else "note_off", note=note, velocity=vel, time=tick - last)
    )
    last = tick

mid.save("output.mid")
```

- 说明：
  - Ableton 官方也支持直接导出 MIDI clip（标准 MIDI），在生产中通常更稳。

## C) FL Studio（`.flp`）

- 文件格式：
  - `.flp` 是二进制项目格式（非 XML），可用开源解析器 PyFLP 读取。
- Python 库：
  - `uv add pyflp mido`
- MIDI pattern 提取思路：
  - `pyflp.parse()` 读取工程
  - 遍历 patterns/notes
  - 按工程 PPQ 转为标准 MIDI `tick` 后写出 `output.mid`
- 最小示例（字段名以实际 PyFLP 版本为准）：

```python
import pyflp
from mido import MidiFile, MidiTrack, Message

project = pyflp.parse("project.flp")
ppq = int(project.ppq)

events = []
for pattern in project.patterns:
    for note in pattern:  # note 常见字段: key/position/length/velocity
        start = int(note.position)
        end = int(note.position + note.length)
        key = int(note.key)
        vel = int(max(1, min(127, round(note.velocity))))
        events.append((start, True, key, vel))
        events.append((end, False, key, 0))

events.sort(key=lambda x: x[0])
mid = MidiFile(ticks_per_beat=ppq)
track = MidiTrack()
mid.tracks.append(track)

last = 0
for tick, is_on, key, vel in events:
    track.append(
        Message("note_on" if is_on else "note_off", note=key, velocity=vel, time=tick - last)
    )
    last = tick

mid.save("output.mid")
```

## D) Cubase / Studio One（`.cpr` / `.song`）

- Cubase `.cpr`：
  - 专有工程格式，公开可编程规格有限；通常不建议做“稳定 Python 逆向提取”。
  - 生产可行路径：在 Cubase 内直接导出 MIDI。
- Studio One `.song`：
  - 属于 DAW 工程容器（官方文档支持“Show Package Contents”查看包内内容）。
  - 可做一定程度结构探查，但跨版本稳定提取 MIDI 事件并不如 DAW 内导出可靠。
- 可行性评估：
  - `可批量稳定自动化`: `.als`（中高） > `.flp`（中，依赖库兼容） > `.logicx/.cpr/.song`（低到中）

## E) 通用方案（最可靠）

- 大部分 DAW 都提供官方“导出 MIDI”路径。
- 可靠性优先建议：
  - Logic Pro：`File > Export > Selection as MIDI File`
  - Ableton Live：`File > Export MIDI Clip`
  - Studio One：`Convert To > MIDI File`
  - Cubase/FL Studio：使用各自 `Export MIDI` 功能
- 原因：
  - 避免专有工程内部格式变动导致解析失败；
  - 直接得到标准 MIDI 二进制，满足 `note_number + velocity + tick` 终点约束。


# 第三部分：推荐 Pipeline（最佳实践）

推荐链路（多乐器混音）：

`input(mp3/wav) -> Demucs(分离) -> Basic Pitch(各轨转MIDI) -> mido(合并/编辑) -> output.mid`

最小可运行示例：

```python
import subprocess
from pathlib import Path
from basic_pitch.inference import predict
from mido import MidiFile, MidiTrack, merge_tracks

INPUT_AUDIO = "song.wav"
TPB = 480

# 1) 分离
subprocess.run(["python", "-m", "demucs", "-n", "htdemucs", INPUT_AUDIO], check=True)

# 2) 各 stem 转 MIDI
song_name = Path(INPUT_AUDIO).stem
stem_dir = Path("separated") / "htdemucs" / song_name
stem_midis = []
for stem in ["vocals", "bass", "drums", "other"]:
    wav = stem_dir / f"{stem}.wav"
    if not wav.exists():
        continue
    _, midi_data, _ = predict(str(wav))
    out_mid = stem_dir / f"{stem}.mid"
    midi_data.write(str(out_mid))
    stem_midis.append(out_mid)

# 3) 用 mido 合并为标准 MIDI
all_tracks = []
for mid_path in stem_midis:
    mid = MidiFile(str(mid_path))
    all_tracks.append(merge_tracks(mid.tracks))

out = MidiFile(ticks_per_beat=TPB)
track = MidiTrack()
track.extend(merge_tracks(all_tracks))
out.tracks.append(track)
out.save("output.mid")

print("done: output.mid")
```

落地建议（质量提升）：

- 分离后按 stem 选模型：
  - `vocals -> SOME/Basic Pitch`
  - `piano -> Onsets and Frames`
  - `bass/other -> Basic Pitch + 后处理`
- 统一后处理：
  - 音高修正（去颤动、短时跳音抑制）
  - 时序量化（1/16~1/32）
  - 最短音长阈值过滤（去毛刺）
- 最终输出：
  - 仅保留标准 MIDI 语义：`note_number, velocity, tick`
  - 导出为 `.mid`（SMF0/SMF1 依工程需求选择）


# 参考来源（检索日期：2026-03-02）

- Basic Pitch（官方仓库）: https://github.com/spotify/basic-pitch
- Basic Pitch 论文（arXiv）: https://arxiv.org/abs/2203.09893
- SOME（官方仓库）: https://github.com/openvpi/SOME
- NeuralNote（官方仓库）: https://github.com/DamRsn/NeuralNote
- CREPE（官方仓库）: https://github.com/marl/crepe
- CREPE 论文（arXiv）: https://arxiv.org/abs/1802.06182
- librosa onset 检测文档: https://librosa.org/doc/main/generated/librosa.onset.onset_detect.html
- Onsets and Frames 论文（arXiv）: https://arxiv.org/abs/1710.11153
- Magenta Onsets and Frames（README）: https://github.com/magenta/magenta/blob/main/magenta/models/onsets_frames_transcription/README.md
- Demucs（官方仓库）: https://github.com/facebookresearch/demucs
- Logic `.logicx` 包格式（Apple）: https://support.apple.com/en-mide/101624
- Logic 工程格式（LoC 格式描述）: https://www.loc.gov/preservation/digital/formats/fdd/fdd000640.shtml
- Logic 导出 MIDI（Apple）: https://support.apple.com/en-lamr/guide/logicpro/lgcp77376cad/10.7/mac/11.0
- Ableton `.als` 转 XML 说明（guard-live-set）: https://github.com/mgarriss/guard-live-set
- Ableton MIDI 导出说明（官方）: https://help.ableton.com/hc/en-us/articles/209068169-Understanding-MIDI-files
- FL Studio 解析器 PyFLP（官方）: https://github.com/demberto/PyFLP
- PyFLP 架构与 FLP 二进制说明: https://pyflp.readthedocs.io/en/latest/architecture/flp-format.html
- Cubase CPR 背景（Steinberg）: https://helpcenter.steinberg.de/hc/en-us/articles/115000075750-Converting-Cubase-VST-songs-ALL-ARR-into-CPR-format
- Studio One 文件浏览/包内容（官方手册）: https://s1manual.presonus.com/en/Content/The_Browser_Topics/Files_Tab.htm
- Studio One 导出/转换 MIDI（官方）: https://support.presonus.com/hc/en-us/articles/8798575899917-Studio-One-6-Exploring-the-Save-Options
