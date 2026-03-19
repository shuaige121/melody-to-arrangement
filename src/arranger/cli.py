import click
import mido
import os


@click.group()
@click.version_option(version="2.0.0")
def main():
    """Logic Pro Audio Arranger — AI-powered MIDI arrangement tool.

    用乐理栅栏约束 AI，将主旋律自动编曲为完整多轨 MIDI。
    音乐工作者的编曲助手 — 专注创作，编曲交给 AI。
    """
    pass


@main.command()
@click.option(
    "--input",
    "-i",
    "input_path",
    required=True,
    type=click.Path(exists=True),
    help="Input MIDI file",
)
@click.option(
    "--style",
    "-s",
    default="pop",
    type=click.Choice(["pop", "rock", "ballad", "jazz", "edm", "rnb", "latin", "funk", "country"]),
    help="Music style",
)
@click.option(
    "--mood",
    "-m",
    default="neutral",
    type=click.Choice(["happy", "sad", "energetic", "chill", "epic", "neutral"]),
    help="Target mood",
)
@click.option("--out", "-o", "output_path", default=None, help="Output MIDI file (default: input_arranged.mid)")
def arrange(input_path, style, mood, output_path):
    """Arrange a melody MIDI into a full multi-track arrangement."""
    if output_path is None:
        base = os.path.splitext(input_path)[0]
        output_path = f"{base}_arranged.mid"

    click.echo(f"🎵 Arranging: {input_path}")
    click.echo(f"   Style: {style} | Mood: {mood}")

    try:
        from arranger.engine.arrange import arrange_melody

        result = arrange_melody(input_path, output_path, style=style, mood=mood)
        click.echo(f"✅ Done! Output: {result}")
        size = os.path.getsize(result)
        click.echo(f"   File size: {size} bytes")
    except Exception as e:
        click.echo(f"❌ Error: {e}", err=True)
        raise click.Abort()


@main.command()
@click.option("--input", "-i", "input_path", required=True, type=click.Path(exists=True), help="MIDI file to analyze")
def analyze(input_path):
    """Analyze a MIDI file and show its musical structure."""
    from arranger.midi.parser import parse_midi
    from arranger.analysis.melody import analyze_melody

    notes, meta = parse_midi(input_path)
    tempo_bpm: int | None = None
    try:
        tempo_bpm = int(round(mido.tempo2bpm(int(meta.get("tempo")))))
    except (TypeError, ValueError, ZeroDivisionError):
        tempo_bpm = None

    click.echo(f"📄 File: {input_path}")
    click.echo(f"   Notes: {len(notes)} | PPQ: {meta.get('ppq', 480)}")

    result = analyze_melody(
        notes,
        tempo_bpm=tempo_bpm,
        time_sig=meta.get("time_sig"),
        ppq=meta.get("ppq", 480),
    )
    click.echo(f"🎼 Key: {result.key}")
    click.echo(f"   Tempo: {result.tempo} BPM")
    click.echo(f"   Time Sig: {result.time_sig[0]}/{result.time_sig[1]}")
    click.echo(f"   Bars: {result.total_bars}")
    click.echo(f"   Range: {result.melody_range}")
    click.echo(f"   Density: {result.melody_density}")
    if result.sections:
        click.echo("   Sections:")
        for s in result.sections:
            click.echo(f"     {s['name']}: bars {s['start_bar']}-{s['end_bar']}")


@main.command()
def serve():
    """Start the web server."""
    click.echo("🌐 Starting web server at http://localhost:8000")
    try:
        import uvicorn

        uvicorn.run("arranger.web.app:app", host="0.0.0.0", port=8000, reload=True)
    except ImportError:
        click.echo("❌ Install uvicorn: uv add uvicorn", err=True)


@main.command()
def styles():
    """List available arrangement styles and patterns."""
    try:
        from arranger.engine.tools import AVAILABLE_STRATEGIES

        click.echo("🎨 Available Strategies:")
        for category, options in AVAILABLE_STRATEGIES.items():
            click.echo(f"\n  {category}:")
            if isinstance(options, dict):
                for style, progs in options.items():
                    click.echo(f"    {style}: {', '.join(progs)}")
            elif isinstance(options, list):
                click.echo(f"    {', '.join(str(o) for o in options)}")
    except ImportError:
        click.echo("Engine not ready yet.")


if __name__ == "__main__":
    main()
