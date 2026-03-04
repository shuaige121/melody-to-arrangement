# MIDI 编曲与工具链（Python / SMF 二进制优先）

## 第一部分：MIDI 文件二进制结构

### 1) SMF 文件头（`MThd` chunk）

Standard MIDI File（SMF）头块固定 14 字节：

- `4 bytes`：Chunk Type，固定 ASCII `MThd`（十六进制 `4D 54 68 64`）
- `4 bytes`：Chunk Length，固定 `00 00 00 06`（大端）
- `2 bytes`：`format`（`0`/`1`/`2`）
- `2 bytes`：`ntrks`（轨道数）
- `2 bytes`：`division`（时间分辨率）

示例（Format 0，1 条轨，PPQ=96）：

```hex
4D 54 68 64 00 00 00 06 00 00 00 01 00 60
```

`division` 常见为 PPQ（ticks per quarter note）。例如 `00 60` = 96 ticks/quarter。

### 2) Track chunk（`MTrk`）

每条轨道是一个 `MTrk` 块：

- `4 bytes`：Chunk Type，固定 ASCII `MTrk`（`4D 54 72 6B`）
- `4 bytes`：Track 数据长度（大端）
- `N bytes`：事件流（event stream）

事件流基本单元：

```text
delta_time(VLQ) + event_bytes
```

`event_bytes` 可是：

- Channel Voice Event（`0x8n`~`0xEn`）
- Meta Event（`0xFF type len data`）
- SysEx（`0xF0` 或 `0xF7`）

### 3) Variable Length Quantity (VLQ) 编码规则

VLQ 用于 `delta_time`（以及很多可变长度字段）：

- 每字节高位 bit7 为“是否继续”标志。
- 低 7 位是有效数据。
- 除最后一个字节外，其余字节 bit7 必须为 1。
- 组序是“高位组在前”（base-128 big-endian 风格）。

常见值：

- `0x00000000` -> `00`
- `0x0000007F` -> `7F`
- `0x00000080` -> `81 00`
- `0x00002000` -> `C0 00`
- `0x00003FFF` -> `FF 7F`
- `0x00004000` -> `81 80 00`

### 4) Format 0 vs Format 1 区别

- **Format 0**：单轨；所有事件（多通道也行）都在一个 `MTrk`。
- **Format 1**：多轨同步；多个轨从同一时间起点并行播放（常见于 DAW 导出）。
- **Format 2**：多轨异步；轨道相互独立（较少见）。

### 5) 常用 Meta Events（二进制）

- Tempo：`FF 51 03 tt tt tt`
  - `tt tt tt` 是每四分音符微秒数（如 `07 A1 20` = 500000 = 120 BPM）
- Time Signature：`FF 58 04 nn dd cc bb`
  - `nn` 分子
  - `dd` 是分母的 `log2`（4/4 时 `dd=2`）
  - `cc` 每拍 MIDI clock 数（常用 24）
  - `bb` 每四分音符包含的 32 分音符数（常用 8）
- Key Signature：`FF 59 02 sf mi`
  - `sf` 升降号数量（-7~+7，二补码）
  - `mi` 调式（`0` 大调，`1` 小调）

### 6) 最小可用 MIDI 文件（完整十六进制字节）

下面示例是一个可播放的最小型 SMF（Format 0），包含 tempo/time signature/key signature + 一个音符 + End Of Track：

```hex
4D 54 68 64 00 00 00 06 00 00 00 01 00 60
4D 54 72 6B 00 00 00 24
00 FF 51 03 07 A1 20
00 FF 58 04 04 02 18 08
00 FF 59 02 00 00
00 C0 00
00 90 3C 40
60 80 3C 40
00 FF 2F 00
```

说明：

- `00 00 00 24` 表示后续 track 事件流长度 36 字节。
- `60`（delta）表示等待 96 ticks 后发送 `note_off`。

## 第二部分：Python MIDI 库对比

### 1) `mido`

安装（uv）：

```bash
uv add mido
```

定位：底层、贴近 MIDI 消息与 SMF 结构，最适合“字节/事件级编程”。

优点：

- 直接操作 `Message` / `MetaMessage`，与二进制事件一一对应。
- 对 SMF 读写清晰，`msg.time` 即 delta time（ticks）。
- 程序化生成编曲时可精确控制事件流与时序。

缺点：

- 比 `pretty_midi` 更底层，写复杂乐句需要自己管理更多细节。
- 以事件级为主，缺少高层音乐语义抽象。

API 概述（常用）：

- `MidiFile(type=1, ticks_per_beat=480)`
- `MidiTrack()`
- `Message('note_on'/'note_off'/'program_change', ...)`
- `MetaMessage('set_tempo'/'time_signature'/'key_signature', ...)`
- `mid.save('xxx.mid')`

### 2) `pretty_midi`

安装（uv）：

```bash
uv add pretty_midi
```

定位：高层“音符对象”操作（开始/结束时间秒级），便于快速做旋律/和弦生成与分析。

优点：

- `Note(start, end, pitch, velocity)` 语义直观。
- 快速构建 instrument + notes，开发效率高。
- 便于做分析（如 chroma、tempo 估计等）。

缺点：

- 时间轴默认是秒，不是 SMF 原生 ticks；做精确 tick 级控制时不如 mido 直观。
- 二进制事件级控制能力弱于 mido。

API 概述（常用）：

- `PrettyMIDI(initial_tempo=120)`
- `Instrument(program=..., is_drum=...)`
- `Note(velocity=..., pitch=..., start=..., end=...)`
- `midi.write('xxx.mid')`

### 3) `music21`（偏学术）

安装（uv）：

```bash
uv add music21
```

优点：

- 乐理/分析能力强（和声、音高集合、谱面语义等）。
- 适合研究、教学、符号音乐分析。

缺点：

- 依赖和抽象层较重，不是最轻量的“纯编曲 MIDI 事件引擎”。
- 工程化批量生成 SMF 时，常不如 mido 直接。

### 4) `midiutil`（轻量创建）

安装（uv）：

```bash
uv add midiutil
```

优点：

- API 直接面向“写文件”：`addNote/addTempo/addProgramChange`。
- 轻量、上手快，快速导出简单 MIDI 很方便。

缺点：

- 功能面相对窄，不是全功能 MIDI 生态核心库。
- 对底层细节控制与扩展性不如 mido。

### 5) 推荐方案（面向“程序化生成编曲 MIDI”）

- **首选：`mido`**（二进制/事件级最匹配，便于精确控制与 debug）
- **辅选：`pretty_midi`**（当你更关注音符语义而非字节细节）
- **可选：`music21`**（学术分析场景）
- **可选：`midiutil`**（快速轻量写盘）

## 第三部分：用 Python 代码示例（mido + pretty_midi）

以下示例均可直接在 uv 环境运行。

### A) `mido` 示例：空文件 + 乐器轨 + 和弦进行 + 鼓组 + tempo/time signature + 保存

```python
from mido import Message, MetaMessage, MidiFile, MidiTrack, bpm2tempo

# 1) 创建空 MIDI 文件并保存
empty = MidiFile()
empty.save("empty_mido.mid")

# 2) 创建编曲文件（Format 1, PPQ=480）
mid = MidiFile(type=1, ticks_per_beat=480)

# 3) 全局控制轨：tempo / time signature / key signature
conductor = MidiTrack()
mid.tracks.append(conductor)
conductor.append(MetaMessage("set_tempo", tempo=bpm2tempo(120), time=0))
conductor.append(
    MetaMessage(
        "time_signature",
        numerator=4,
        denominator=4,
        clocks_per_click=24,
        notated_32nd_notes_per_beat=8,
        time=0,
    )
)
conductor.append(MetaMessage("key_signature", key="C", time=0))
conductor.append(MetaMessage("end_of_track", time=0))

# 4) 和声轨：设置乐器(program)并写入和弦进行
harmony = MidiTrack()
mid.tracks.append(harmony)
harmony.append(Message("program_change", channel=0, program=0, time=0))  # Acoustic Grand Piano

progression = [
    [60, 64, 67],  # C
    [57, 60, 64],  # Am
    [53, 57, 60],  # F
    [55, 59, 62],  # G
]
bar_ticks = mid.ticks_per_beat * 4

for chord in progression:
    for note in chord:
        harmony.append(Message("note_on", channel=0, note=note, velocity=80, time=0))
    # 第一个 note_off 承担时值，其余同时结束
    harmony.append(
        Message("note_off", channel=0, note=chord[0], velocity=64, time=bar_ticks)
    )
    for note in chord[1:]:
        harmony.append(Message("note_off", channel=0, note=note, velocity=64, time=0))

harmony.append(MetaMessage("end_of_track", time=0))

# 5) 鼓组轨（通道 10 == channel=9）
drums = MidiTrack()
mid.tracks.append(drums)
drums.append(Message("program_change", channel=9, program=0, time=0))

step_ticks = mid.ticks_per_beat // 4  # 16 分音符网格（120 ticks）
total_steps = len(progression) * 16
pending = 0

for step in range(total_steps):
    pending += step_ticks
    local = step % 16
    hits = []

    # Kick
    if local in (0, 8):
        hits.append((36, 110))
    # Snare
    if local in (4, 12):
        hits.append((38, 100))
    # Closed Hi-Hat
    if local % 2 == 0:
        hits.append((42, 70))

    if hits:
        first = True
        for note, vel in hits:
            drums.append(
                Message(
                    "note_on",
                    channel=9,
                    note=note,
                    velocity=vel,
                    time=pending if first else 0,
                )
            )
            first = False
        pending = 0

# 把末尾剩余等待时间放到 end_of_track
drums.append(MetaMessage("end_of_track", time=pending))

# 6) 保存
mid.save("arrangement_mido.mid")
print("Wrote: empty_mido.mid, arrangement_mido.mid")
```

### B) `pretty_midi` 示例：空文件 + 乐器轨 + 和弦进行 + 鼓组 + 拍号/速度 + 保存

```python
import pretty_midi

# 1) 创建空 MIDI 文件
pretty_midi.PrettyMIDI().write("empty_pretty.mid")

# 2) 创建工程，设置初始速度
pm = pretty_midi.PrettyMIDI(initial_tempo=120)

# 3) 设置拍号与调号
pm.time_signature_changes.append(pretty_midi.TimeSignature(4, 4, 0.0))
pm.key_signature_changes.append(pretty_midi.KeySignature(0, 0.0))  # 0 -> C major

# 4) 和声轨（piano）
piano_program = pretty_midi.instrument_name_to_program("Acoustic Grand Piano")
piano = pretty_midi.Instrument(program=piano_program, name="Piano")

progression = [
    [60, 64, 67],  # C
    [57, 60, 64],  # Am
    [53, 57, 60],  # F
    [55, 59, 62],  # G
]
bar_seconds = 2.0  # 120 BPM 下 4/4 每小节 2 秒

for i, chord in enumerate(progression):
    start = i * bar_seconds
    end = start + bar_seconds
    for pitch in chord:
        piano.notes.append(
            pretty_midi.Note(
                velocity=80,
                pitch=pitch,
                start=start,
                end=end,
            )
        )

pm.instruments.append(piano)

# 5) 鼓组轨（is_drum=True）
drums = pretty_midi.Instrument(program=0, is_drum=True, name="Drums")
step_seconds = 0.125  # 16 分音符
steps = len(progression) * 16

for step in range(steps):
    t = step * step_seconds
    local = step % 16

    if local in (0, 8):  # Kick
        drums.notes.append(pretty_midi.Note(velocity=110, pitch=36, start=t, end=t + 0.05))
    if local in (4, 12):  # Snare
        drums.notes.append(pretty_midi.Note(velocity=100, pitch=38, start=t, end=t + 0.05))
    if local % 2 == 0:  # Closed Hi-Hat
        drums.notes.append(pretty_midi.Note(velocity=70, pitch=42, start=t, end=t + 0.03))

pm.instruments.append(drums)

# 6) 保存
pm.write("arrangement_pretty.mid")
print("Wrote: empty_pretty.mid, arrangement_pretty.mid")
```

## 第四部分：MIDI 二进制 ↔ Python 对象映射

下面表格以 `mido` 为主（最接近字节层）：

| 二进制模式 | 语义 | Python 对象（mido） | 关键字段映射 |
|---|---|---|---|
| `0x8n kk vv` | Note Off | `Message('note_off', channel=n, note=kk, velocity=vv, time=dt)` | `n=通道(0-15)` |
| `0x9n kk vv` | Note On | `Message('note_on', channel=n, note=kk, velocity=vv, time=dt)` | `vv=0` 常等价 Note Off |
| `0xAn kk pp` | Poly Aftertouch | `Message('polytouch', channel=n, note=kk, value=pp, time=dt)` | 每键压力 |
| `0xBn cc vv` | Control Change | `Message('control_change', channel=n, control=cc, value=vv, time=dt)` | 例：`cc=7` 音量 |
| `0xCn pp` | Program Change | `Message('program_change', channel=n, program=pp, time=dt)` | 乐器号 0-127 |
| `0xDn pp` | Channel Pressure | `Message('aftertouch', channel=n, value=pp, time=dt)` | 通道压力 |
| `0xEn ll mm` | Pitch Bend | `Message('pitchwheel', channel=n, pitch=value, time=dt)` | `value=((mm<<7)|ll)-8192` |
| `0xFF 0x51 0x03 tt tt tt` | Tempo Meta | `MetaMessage('set_tempo', tempo=tempo_us_per_qn, time=dt)` | `tempo=int.from_bytes([tt,tt,tt],'big')` |
| `0xFF 0x58 0x04 nn dd cc bb` | Time Signature Meta | `MetaMessage('time_signature', numerator=nn, denominator=2**dd, clocks_per_click=cc, notated_32nd_notes_per_beat=bb, time=dt)` | 分母需做 `2**dd` |
| `0xFF 0x59 0x02 sf mi` | Key Signature Meta | `MetaMessage('key_signature', key='C'/'Gm'..., time=dt)` | `sf/mi` 与调名互转 |
| `0xFF 0x2F 0x00` | End Of Track | `MetaMessage('end_of_track', time=dt)` | 每条 `MTrk` 应结束于此 |
| `0xF0 ... 0xF7` | SysEx | `Message('sysex', data=[...], time=dt)` | 厂商/设备扩展 |

### `delta_time` 与 `msg.time`

- 文件中：`delta_time` 以 VLQ 字节编码。
- `mido` 中：同一 track 内，对应 `msg.time`（ticks 整数）。
- 读取时 `mido` 已解 VLQ；保存时 `mido` 会再编码回 VLQ。

简例：

- 字节：`60 90 3C 40`
- 含义：等待 `0x60=96` ticks 后触发 `note_on(C4, velocity=64)`
- 对象：`Message('note_on', note=60, velocity=64, time=96)`
