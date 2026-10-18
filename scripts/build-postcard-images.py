"""Create responsive delivery copies of the existing, unchanged wedding photos."""
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
DESTINATION = ROOT / 'images' / 'postcards'


def build():
    DESTINATION.mkdir(parents=True, exist_ok=True)
    sources = sorted((ROOT / 'images' / 'venue').glob('*.jpg')) + sorted((ROOT / 'images' / 'us').glob('*.jpg'))
    total = 0
    for source in sources:
        with Image.open(source) as opened:
            photo = ImageOps.exif_transpose(opened).convert('RGB')
            widths = [480, 960]
            if source.stem in ('hero-drone', 'valley', 'proposal'):
                widths.append(1440)
            for width in widths:
                height = round(photo.height * width / photo.width)
                output = DESTINATION / f'{source.stem}-{width}.webp'
                photo.resize((width, height), Image.Resampling.LANCZOS).save(output, 'WEBP', quality=76, method=6)
                total += output.stat().st_size
    print(f'{len(sources)} original photos; {total:,} bytes across responsive derivatives')


if __name__ == '__main__':
    build()
