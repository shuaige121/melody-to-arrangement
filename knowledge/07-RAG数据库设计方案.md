# 第一部分：RAG 数据模型

## 1. 基本单元定义
- 一个“编曲片段（arrangement fragment）”定义为 `1-4` 小节的 MIDI 事件集合。
- 所有可检索与可生成信息必须可还原为 MIDI 二进制核心字段：`note_number`, `velocity`, `tick`, `channel`, `program`。
- 检索主维度固定为：`情绪(mood) × 段落(section) × 风格(genre) × 乐器(instrument) × 调性(key)`。

## 2. 存储原则（MIDI-first）
- 片段内部只存“可回放的事件事实”，不存无法落地到 MIDI 的抽象文本规则。
- 乐理描述（如和弦功能、张力）作为 `theory` 元数据，仅用于过滤、重排与解释；最终输出仍是 MIDI 参数。
- 每条记录必须具备最小可合成字段：
  - `notes[].note` -> `note_number`
  - `notes[].velocity` -> `velocity`
  - `notes[].start_tick` / `notes[].duration_tick` -> `tick`
  - `notes[].channel` -> `channel`
  - `midi_data.program` -> `program`

## 3. 片段结构（标准 JSON）
```jsonc
{
  "id": "pattern_001",
  "type": "chord_progression | drum_pattern | bass_line | piano_comp | string_pad",
  "midi_data": {
    "notes": [
      {
        "note": 60,
        "velocity": 80,
        "start_tick": 0,
        "duration_tick": 480,
        "channel": 0
      }
    ],
    "program": 0,
    "tempo": 120,
    "time_signature": [4, 4],
    "key": "C_major",
    "ppq": 480
  },
  "tags": {
    "mood": ["happy", "energetic"],
    "section": ["chorus", "verse"],
    "genre": ["pop", "rock"],
    "instrument": "piano",
    "complexity": 3,
    "energy": 4
  },
  "theory": {
    "chord_function": "I-V-vi-IV",
    "scale": [0, 2, 4, 5, 7, 9, 11],
    "tension_level": 2
  }
}
```

## 4. 建议索引键
- 主键：`id`
- 元数据过滤键：`type`, `mood`, `section`, `genre`, `instrument`, `key`, `tempo_range`, `time_signature`
- MIDI 数值键：`note_hist_128`, `velocity_hist`, `ioi_hist`, `pitch_class_hist_12`, `program`

# 第二部分：栅栏系统（Guardrails）

## 1. 调性栅栏（Key Fence）
- 输入：`key = tonic + mode`
- 规则：合法集合 `allowed_pc = scale_pc_set(key)`，任何事件需满足 `note_number % 12 in allowed_pc`。
- 示例：`C_major -> {0,2,4,5,7,9,11}`。

## 2. 和声栅栏（Harmony Fence）
- 输入：当前和弦（如 `G7`）
- 规则：生成候选音集合 `chord_tones + available_tensions`，并按权重推荐：
  - 强推荐：和弦音（root/3rd/5th/7th）
  - 次推荐：调内经过/邻接音
  - 弱推荐：受控张力音（按 `tension_level`）

## 3. 音域栅栏（Register Fence）
- 每个乐器固定 `note_number` 合法区间，越界则回拉到最近合法音。
- 示例：
  - Bass: `36-60`
  - Piano comp: `48-84`
  - String pad: `55-96`
  - Lead vocal placeholder: `60-84`
  - Drum (ch=9): GM 映射 `35-81`

## 4. 节奏栅栏（Rhythm Fence）
- 输入：`time_signature`, `ppq`
- 规则：限定合法落点 `legal_ticks`（如 4/4 + PPQ=480 时，16 分网格为 `0,120,240,...`）。
- 偏移音符允许范围：例如 `swing_offset in [-20, +40] tick`，超出则量化回网格。

## 5. Voice Leading 栅栏
- 对相邻和弦配位，最小化每个声部移动：
  - 目标函数：`sum(abs(note_t - note_t-1))` 最小
  - 约束：单声部跳进不超过 `7` 半音（可配置）
- 如出现平行五八或极端跳进，可触发替代转位重算。

## 6. 在 LLM 编曲中的实施
- Prompt Engineering：
  - 明确输入 `allowed_pc`, `instrument_range`, `legal_ticks`, `current_chord_notes`。
  - 要求输出“仅 MIDI 事件 JSON”，禁止自然语言音名作为最终结果。
- 后处理验证：
  - `validate_key()` / `validate_range()` / `validate_rhythm()` / `validate_voice_leading()` 四阶段校验。
  - 失败事件执行 `repair()`（就近映射、量化、转位替换），再输出多轨 MIDI。

# 第三部分：向量化策略

## 方案 A：直接用 MIDI 二进制特征向量
- `note_number` 直方图：`128` 维
- `velocity` 分布：建议 `16` 桶
- `tick` 间隔（IOI）分布：建议 `16` 或 `32` 桶
- 可附加：`pitch_class_hist_12`, `duration_hist`, `channel/program one-hot`
- 优点：完全 MIDI-first、可解释性高、无需额外 embedding 模型。
- 缺点：语义泛化能力弱，跨风格“相似感”依赖特征工程质量。

## 方案 B：标签多热编码
- 对 `mood × section × genre × instrument × key` 做多热编码（multi-hot / one-hot 组合）。
- 优点：过滤准确、实现简单、标签可控。
- 缺点：只靠标签会丢失实际音高/节奏细节。

## 方案 C：混合向量（推荐）
- `final_vec = concat(midi_feature_vec, tag_multi_hot_vec)`
- 检索时采用“双阶段”：
  - 阶段 1：标签过滤（硬条件）
  - 阶段 2：向量相似度排序（软相似）
- 推荐理由：
  - 保持 MIDI 二进制为核心
  - 兼顾语义维度（情绪/段落/风格/乐器/调性）
  - 对“同风格不同具体音型”的召回更稳定

# 第四部分：技术选型

## 1. 向量数据库对比
- ChromaDB
  - 优势：轻量、Python 体验好、原型快、可本地持久化
  - 风险：超大规模分布式能力不如专用集群方案
- FAISS
  - 优势：高性能 ANN 检索库、索引类型丰富
  - 风险：更偏“库”而非完整数据库，元数据过滤需自建
- Qdrant
  - 优势：向量 + payload 过滤成熟，服务化体验好
  - 风险：引入服务运维复杂度
- Milvus
  - 优势：大规模与分布式能力强
  - 风险：部署与维护成本最高，前期过重

## 2. Python 实现建议
- 推荐：`ChromaDB + Python + uv`
- 原因：与当前阶段（快速建立可迭代的编曲 RAG）匹配，且便于落地“标签过滤 + 向量检索”混合流程。

## 3. Embedding 模型是否需要
- 当前建议：先不引入通用文本 embedding。
- 直接使用“方案 C 混合向量”即可（MIDI 特征 + 标签编码）。
- 何时升级：当数据规模增大且希望跨标签语义泛化时，再增加符号音乐 embedding（例如 MusicBERT 类模型输出）。

## 4. 安装
```bash
uv add chromadb
```

# 第五部分：检索流程

```text
输入: 用户主旋律 MIDI + 目标情绪 + 目标风格
1. 分析主旋律 -> 提取 key, tempo, time_sig
2. 设置栅栏 -> 合法 note_number 集合
3. 检索和弦进行 -> query(mood=target, section=current, genre=target)
4. 检索鼓组 pattern -> query(genre=target, section=current)
5. 检索 bass line -> query(chord_root=X, genre=target)
6. 检索 piano comp -> query(chord=X, genre=target)
7. 组合 + 栅栏验证 -> 输出多轨 MIDI
```

补充执行细节：
- Query 向量构建：`melody_midi_vec + target_tag_vec`
- 过滤条件：`where={mood, section, genre, instrument, key}`
- 结果重排：优先 `key/range/rhythm` 零违规片段，再按相似度排序
- 拼装输出：对齐 `tempo`, `ppq`, `bar_length_tick`，统一写回 MIDI 轨道

# 第六部分：数据填充策略

## 1. 从 knowledge/01-04 自动解析生成 RAG entries
- `knowledge/01`: 提取音阶/调式/音高规则 -> `theory.scale`, `key_fence`
- `knowledge/02`: 提取和弦结构/功能进行 -> `type=chord_progression`
- `knowledge/03`: 提取鼓组矩阵与 tick/velocity -> `type=drum_pattern`
- `knowledge/04`: 提取乐器 program/channel 分配 -> `instrument/program/channel`

## 2. 从开源 MIDI 数据集导入
- 可用数据源：Lakh MIDI Dataset、EMOPIA 等符号音乐数据。
- 导入后统一转为片段级（1-4 小节）并补齐标签：`mood/section/genre/instrument/key`。

## 3. 手动标注 + 自动标注混合
- 自动标注：
  - `key`：基于 pitch class 统计
  - `section`：基于能量/密度分段
  - `mood`：基于速度、力度、音高分布的规则模型
- 手动校正：只校正高价值片段（高频召回候选），降低标注成本。

## 4. Python 脚本示例（从 MD 解析到 RAG entry）
```python
import re
from pathlib import Path


def parse_chord_lines(md_text: str):
    # 匹配类似: - I: C major, 根音 `60`, 和弦 `[60, 64, 67]`
    pattern = re.compile(r"-\s*(\w+):.*?根音\s*`(\d+)`.*?和弦\s*`\[([^\]]+)\]`")
    for degree, root, notes in pattern.findall(md_text):
        note_list = [int(x.strip()) for x in notes.split(",")]
        yield degree, int(root), note_list


def to_rag_entry(idx: int, degree: str, root: int, notes: list[int]):
    midi_notes = []
    for i, n in enumerate(notes):
        midi_notes.append(
            {
                "note": n,
                "velocity": 90,
                "start_tick": 0,
                "duration_tick": 480,
                "channel": 0,
            }
        )

    return {
        "id": f"chord_{idx:04d}",
        "type": "chord_progression",
        "midi_data": {
            "notes": midi_notes,
            "program": 0,
            "tempo": 120,
            "time_signature": [4, 4],
            "key": "C_major",
            "ppq": 480,
        },
        "tags": {
            "mood": ["neutral"],
            "section": ["verse"],
            "genre": ["pop"],
            "instrument": "piano",
            "complexity": 2,
            "energy": 2,
        },
        "theory": {
            "chord_function": degree,
            "scale": [0, 2, 4, 5, 7, 9, 11],
            "tension_level": 1,
        },
    }


def main():
    md = Path("knowledge/02-和声与和弦进行.md").read_text(encoding="utf-8")
    entries = [to_rag_entry(i, d, r, ns) for i, (d, r, ns) in enumerate(parse_chord_lines(md), 1)]
    print(f"generated entries: {len(entries)}")


if __name__ == "__main__":
    main()
```

## 5. 最终落地原则
- 所有入库、检索、重排、生成与修复步骤都以 MIDI 二进制参数为唯一真值层。
- 标签只是检索维度，栅栏是合法性约束，最终输出始终是可回放 MIDI 事件。
